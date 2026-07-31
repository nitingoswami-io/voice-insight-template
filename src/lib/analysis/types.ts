/**
 * Shapes shared between the model contract, the verifier and the UI.
 */

/** A quote anchoring a claim to a specific moment in the recording. */
export type Evidence = {
  /**
   * Verbatim, in the original language and script. This is the field the
   * verifier checks against the transcript and the field the UI treats as proof.
   */
  quoteOriginal: string;
  /** English gloss for reviewers who do not speak the language. Never evidence. */
  quoteEnglish: string;
  startMs: number;
  endMs: number;
  /** Diarized label ("A"/"B") the model attributes the quote to. */
  speaker: string;
  /** Mean ASR confidence over the matched span, filled in by the verifier. */
  asrConfidence?: number;
};

/** One observation with the quote that backs it. */
export type Point = {
  point: string;
  quote: Evidence;
  /** Which category this belongs to, so a score can show its own evidence. */
  category?: string;
};

/**
 * A per-category judgement.
 *
 * `score` is null when the call gave no opportunity to assess the category —
 * an abstention, not a zero. A call that ended in twenty seconds should leave
 * most of these blank rather than scoring badly on things that never came up.
 */
export type CategoryScore = {
  key: string;
  score: number | null;
  note: string;
};

export type Outcome = "resolved" | "unresolved" | "unclear";

export type Insight = {
  summary: string;
  categories: CategoryScore[];
  customerWanted: string;
  outcome: Outcome;
  strengths: Point[];
  coaching: Point[];
  /** Null when too little happened on the call to judge it. Never a silent zero. */
  score: number | null;
  /** What the score does and does not rest on, in the model's own words. */
  scoreBasis: string;
};

export type DropReason =
  | "quote_not_found"
  | "timestamp_mismatch"
  | "speaker_mismatch";

export type DroppedQuote = {
  point: string;
  reason: DropReason;
  quote: string;
  /** What the model claimed vs what the transcript says, for speaker_mismatch. */
  claimedSpeaker?: string;
  actualSpeaker?: string;
};

/**
 * The verifier's report, shown on the page. Aggregated over many calls this is a
 * live hallucination rate — but even on one call it tells the reader how much of
 * what the model said survived checking.
 */
export type VerificationStats = {
  checked: number;
  dropped: DroppedQuote[];
};
