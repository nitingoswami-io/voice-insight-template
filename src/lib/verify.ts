/**
 * Quote verification — the trust layer.
 *
 * Model output is treated as untrusted input. Before any finding can reach a
 * screen, its quote must be located in the actual transcript, at approximately
 * the claimed time, attributed to the claimed speaker. Findings that fail are
 * dropped and counted; they are never repaired, and never silently discarded.
 *
 * This exists because a QA score influences an agent's review and their pay. A
 * hallucinated quote in that setting is a fabricated accusation against a named
 * employee, which is strictly worse than having no product at all.
 */

import type { Word } from "@/lib/providers/asr";
import type {
  DropReason,
  DroppedQuote,
  Evidence,
  Point,
  VerificationStats,
} from "@/lib/analysis/types";

/**
 * Minimum normalised Levenshtein similarity for a fuzzy quote match. The model
 * routinely reformats punctuation and drops filler words when quoting, so exact
 * match alone would discard many true findings.
 */
export const SIMILARITY_THRESHOLD = 0.85;

/**
 * How far a quote may sit from its claimed timestamp and still be accepted.
 *
 * Calibration matters in both directions. Too strict and we drop true findings
 * over ordinary imprecision, leaving the product looking empty — which erodes
 * trust just as effectively as a false one. Too loose and the timestamp stops
 * disambiguating short, common quotes ("yes", "हाँ") that legitimately occur
 * dozens of times in one call. Five seconds tolerates model imprecision while
 * still catching a claim that something said at 18:40 happened at 02:15.
 */
export const TIMESTAMP_TOLERANCE_MS = 5_000;

/** Below this mean ASR confidence, a finding is badged and left out of aggregates. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Strip combining marks only where the base character is Latin.
 *
 * The usual NFD-then-drop-all-marks trick is actively wrong for Indic scripts:
 * in Devanagari, Tamil and their relatives, combining marks are vowel signs
 * carrying phonemic meaning. Dropping them would collapse का, कि and की all to
 * क, which would make unrelated words match and quietly defeat the whole
 * verifier on exactly the languages this product exists to support.
 */
function stripLatinDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .normalize("NFC");
}

/** Lowercase, fold Latin diacritics, drop punctuation, collapse whitespace. */
export function normalize(input: string): string {
  return stripLatinDiacritics(input)
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

type TranscriptIndex = {
  /** Normalised transcript text, single-spaced. */
  text: string;
  /** For each UTF-16 index in `text`, the index of the word it came from. */
  charToWord: number[];
  /** Char index at which each word begins; -1 for words that normalised away. */
  wordStartChar: number[];
  words: Word[];
};

export function buildTranscriptIndex(words: Word[]): TranscriptIndex {
  let text = "";
  const charToWord: number[] = [];
  const wordStartChar: number[] = new Array(words.length).fill(-1);

  words.forEach((word, i) => {
    const normalised = normalize(word.text);
    if (!normalised) return;

    if (text.length > 0) {
      text += " ";
      charToWord.push(i);
    }
    wordStartChar[i] = text.length;

    // Iterate UTF-16 units so charToWord stays aligned with indexOf/slice.
    for (let k = 0; k < normalised.length; k++) {
      text += normalised[k];
      charToWord.push(i);
    }
  });

  return { text, charToWord, wordStartChar, words };
}

/**
 * Levenshtein distance, abandoned early once it provably exceeds `maxDistance`.
 * The bound is what keeps fuzzy matching affordable across a long call.
 */
function boundedLevenshtein(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  if (a === b) return 0;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      if (current[j] < rowMin) rowMin = current[j];
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  const maxDistance = Math.ceil(longest * (1 - SIMILARITY_THRESHOLD));
  const distance = boundedLevenshtein(a, b, maxDistance);
  return 1 - distance / longest;
}

type Match = { startChar: number; endChar: number; score: number };

function exactOccurrences(haystack: string, needle: string): Match[] {
  const found: Match[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    found.push({ startChar: at, endChar: at + needle.length, score: 1 });
    from = at + 1;
    if (found.length >= 200) break; // pathological repetition guard
  }
  return found;
}

/**
 * Candidate windows for fuzzy matching, anchored on the quote's longest token.
 *
 * Scanning every word start would be quadratic over a long call. Anchoring on a
 * distinctive token cuts the search to a handful of positions in practice, and
 * a fabricated quote — whose tokens appear nowhere — yields no candidates and
 * is rejected immediately, which is exactly the behaviour we want.
 */
function fuzzyCandidates(index: TranscriptIndex, quote: string): Match[] {
  const tokens = quote.split(" ").filter(Boolean);
  if (tokens.length === 0) return [];

  const anchor = tokens.reduce((a, b) => (b.length > a.length ? b : a));
  if (anchor.length < 2) return [];

  const anchorOffset = quote.indexOf(anchor);
  const results: Match[] = [];

  for (const occurrence of exactOccurrences(index.text, anchor)) {
    // Align the window so the anchor sits where it does inside the quote.
    const base = occurrence.startChar - anchorOffset;
    // Try a few window lengths: quoting rarely preserves length exactly.
    for (const slack of [0, -0.1, 0.1]) {
      const length = Math.round(quote.length * (1 + slack));
      const start = Math.max(0, base);
      const end = Math.min(index.text.length, start + length);
      if (end <= start) continue;
      const score = similarity(quote, index.text.slice(start, end));
      if (score >= SIMILARITY_THRESHOLD) {
        results.push({ startChar: start, endChar: end, score });
      }
    }
  }
  return results;
}

type LocatedSpan = {
  startMs: number;
  endMs: number;
  speaker: string | null;
  meanConfidence: number;
  score: number;
};

function spanFromMatch(index: TranscriptIndex, match: Match): LocatedSpan | null {
  const firstWord = index.charToWord[match.startChar];
  const lastWord = index.charToWord[Math.min(match.endChar - 1, index.charToWord.length - 1)];
  if (firstWord == null || lastWord == null) return null;

  const slice = index.words.slice(firstWord, lastWord + 1);
  if (slice.length === 0) return null;

  const confidenceSum = slice.reduce((sum, w) => sum + (w.confidence ?? 1), 0);

  // Majority speaker across the span — diarization can flicker on a single word.
  const tally = new Map<string, number>();
  for (const word of slice) {
    if (!word.speaker) continue;
    tally.set(word.speaker, (tally.get(word.speaker) ?? 0) + 1);
  }
  let speaker: string | null = null;
  let best = 0;
  for (const [label, count] of tally) {
    if (count > best) {
      best = count;
      speaker = label;
    }
  }

  return {
    startMs: slice[0].startMs,
    endMs: slice[slice.length - 1].endMs,
    speaker,
    meanConfidence: confidenceSum / slice.length,
    score: match.score,
  };
}

export type LocateResult =
  | { ok: true; span: LocatedSpan }
  | { ok: false; reason: "quote_not_found" | "timestamp_mismatch" };

/**
 * Locate a quote in the transcript, preferring the occurrence nearest the
 * claimed time. Nearest-first is what makes short, common quotes verifiable:
 * "yes" may occur forty times in a call, and the timestamp is the only thing
 * that distinguishes the one the model meant from a fabrication.
 */
export function locateQuote(
  index: TranscriptIndex,
  quote: string,
  claimedStartMs: number,
  claimedEndMs: number,
): LocateResult {
  const normalised = normalize(quote);
  if (normalised.length < 2) return { ok: false, reason: "quote_not_found" };

  let matches = exactOccurrences(index.text, normalised);
  if (matches.length === 0) matches = fuzzyCandidates(index, normalised);
  if (matches.length === 0) return { ok: false, reason: "quote_not_found" };

  const spans = matches
    .map((m) => spanFromMatch(index, m))
    .filter((s): s is LocatedSpan => s !== null);
  if (spans.length === 0) return { ok: false, reason: "quote_not_found" };

  const claimedMid = (claimedStartMs + claimedEndMs) / 2;
  const distance = (span: LocatedSpan) => {
    // Zero when the claimed window overlaps the real one.
    if (claimedEndMs >= span.startMs && claimedStartMs <= span.endMs) return 0;
    const mid = (span.startMs + span.endMs) / 2;
    return Math.abs(mid - claimedMid);
  };

  const nearest = spans.reduce((a, b) => (distance(b) < distance(a) ? b : a));
  if (distance(nearest) > TIMESTAMP_TOLERANCE_MS) {
    return { ok: false, reason: "timestamp_mismatch" };
  }
  return { ok: true, span: nearest };
}

/**
 * Compare a model-claimed speaker against the transcript's own label.
 *
 * Tolerant on purpose. The model is asked for a bare label but reliably returns
 * decorated variants — "Speaker A", "A (agent)", or just "agent" — and treating
 * those as mismatches discards findings that are entirely correct. The bare
 * label is authoritative when present; role words are resolved against whichever
 * label we believe is the agent.
 */
export function speakerMatches(
  claimed: string | null | undefined,
  actual: string | null | undefined,
  agentSpeakerLabel: string | null,
): boolean {
  if (!claimed || !actual) return true; // nothing to compare

  const strip = (s: string) =>
    s.replace(/^\s*speakers?\s*/i, "").trim().toLowerCase();

  const claimedNorm = strip(claimed);
  const actualNorm = strip(actual);

  // "A (agent)" / "A [agent]" / "A" → "a"
  const bare = claimedNorm.split(/[\s([]/)[0];
  if (bare && bare === actualNorm) return true;

  if (agentSpeakerLabel) {
    const agentNorm = strip(agentSpeakerLabel);
    if (claimedNorm.includes("agent")) return actualNorm === agentNorm;
    if (claimedNorm.includes("customer") || claimedNorm.includes("caller")) {
      return actualNorm !== agentNorm;
    }
  }
  return false;
}

/**
 * Verify one quoted point against the transcript.
 *
 * Returns the evidence snapped to the transcript's own timings and speaker, or
 * the reason it could not be trusted. The model's timestamps are a claim to be
 * checked; the transcript's are the fact, and they are what the audio player
 * seeks to when someone clicks the quote.
 */
export function verifyEvidence(
  index: TranscriptIndex,
  evidence: Evidence,
  hasDiarization: boolean,
  agentSpeakerLabel: string | null,
):
  | { ok: true; evidence: Evidence }
  | { ok: false; reason: DropReason; actualSpeaker?: string } {
  const located = locateQuote(
    index,
    evidence.quoteOriginal,
    evidence.startMs,
    evidence.endMs,
  );
  if (!located.ok) return { ok: false, reason: located.reason };

  // Only enforce speaker attribution when diarization actually ran.
  if (
    hasDiarization &&
    !speakerMatches(evidence.speaker, located.span.speaker, agentSpeakerLabel)
  ) {
    return {
      ok: false,
      reason: "speaker_mismatch",
      actualSpeaker: located.span.speaker ?? undefined,
    };
  }

  return {
    ok: true,
    evidence: {
      ...evidence,
      startMs: located.span.startMs,
      endMs: located.span.endMs,
      speaker: located.span.speaker ?? evidence.speaker,
      asrConfidence: located.span.meanConfidence,
    },
  };
}

/**
 * Verify a list of quoted points, keeping only those whose quote was found.
 *
 * A point whose quote fails is discarded rather than shown without it. An
 * observation with no verifiable quote behind it is precisely what this layer
 * exists to remove — it would read as fact while resting on nothing.
 */
export function verifyPoints(
  points: Point[],
  words: Word[],
  agentSpeakerLabel: string | null = null,
): { kept: Point[]; dropped: DroppedQuote[] } {
  const index = buildTranscriptIndex(words);
  const hasDiarization = words.some((w) => w.speaker);

  const kept: Point[] = [];
  const dropped: DroppedQuote[] = [];

  for (const item of points) {
    const result = verifyEvidence(
      index,
      item.quote,
      hasDiarization,
      agentSpeakerLabel,
    );
    if (result.ok) {
      kept.push({ ...item, quote: result.evidence });
    } else {
      dropped.push({
        point: item.point,
        reason: result.reason,
        quote: item.quote.quoteOriginal,
        ...(result.reason === "speaker_mismatch"
          ? {
              claimedSpeaker: item.quote.speaker,
              actualSpeaker: result.actualSpeaker,
            }
          : {}),
      });
    }
  }

  return { kept, dropped };
}

/** Roll several verified lists into the single report shown on the page. */
export function combineStats(
  results: Array<{ kept: Point[]; dropped: DroppedQuote[] }>,
): VerificationStats {
  return {
    checked: results.reduce((n, r) => n + r.kept.length + r.dropped.length, 0),
    dropped: results.flatMap((r) => r.dropped),
  };
}

/** True when a point rests on audio too unclear to rely on. */
export function isLowConfidence(point: Point): boolean {
  const confidence = point.quote.asrConfidence;
  return confidence != null && confidence < LOW_CONFIDENCE_THRESHOLD;
}
