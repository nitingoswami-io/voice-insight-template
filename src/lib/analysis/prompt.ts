import type { Utterance } from "@/lib/providers/asr";
import { QUALITY_GUIDE } from "@/lib/quality-guide";

/**
 * Prompt construction.
 *
 * The transcript goes in its ORIGINAL language, never pre-translated.
 * Translation destroys exactly what is being assessed — the आप/तू and usted/tú
 * distinctions, the point where a frustrated customer switches out of English —
 * and it would move the quotes we verify into a machine translation rather than
 * what was actually said.
 *
 * Timestamps are inlined per utterance so the model can cite them, which is what
 * makes verification possible on the other side.
 */

/**
 * One line per utterance: `[start-end] <label> <role>: text`.
 *
 * The bare diarized label comes first and alone, because the model is asked to
 * echo it back verbatim and the verifier compares it against the transcript's
 * own label. An earlier format wrote `Speaker A (agent)`, and the model
 * faithfully echoed that whole string — which never equals `A`, so every
 * finding was discarded as a speaker mismatch. Keep the label unambiguous.
 */
export function formatTranscript(
  utterances: Utterance[],
  agentSpeakerLabel: string | null,
): string {
  return utterances
    .map((u) => {
      const role =
        agentSpeakerLabel == null
          ? ""
          : u.speaker === agentSpeakerLabel
            ? " [agent]"
            : " [customer]";
      return `[${u.startMs}-${u.endMs}] ${u.speaker}${role}: ${u.text}`;
    })
    .join("\n");
}

export const SYSTEM_PROMPT = `You are a quality analyst reviewing a recorded customer support call from a contact centre. You produce a short, useful read of the call for the agent's team leader.

You will be given a transcript in its original language. Judge it in that language — do not translate it before reasoning about it, because politeness registers and code-switching are part of what you are assessing.

Rules you must follow exactly:

1. EVIDENCE. Every strength and every coaching point must quote the transcript verbatim, in the original language and script, copied character-for-character from the text you were given. Never paraphrase, translate, tidy, or reconstruct a quote. If you cannot find a real quote for a point, drop the point.

2. TIMESTAMPS. Copy start_ms and end_ms from the utterance the quote came from. Do not estimate them.

3. SCORE EVERY CATEGORY OR ABSTAIN. Return one entry per category key. Where the call gave no opportunity to judge one — the topic never arose, the customer hung up first — set its score to null rather than a low number. A null costs the agent nothing; a guessed 40 is a false accusation. Tag every strength and coaching point with the category it belongs to.

4. SAY LESS RATHER THAN GUESS. Returning one strength and one coaching point is better than padding to three. An empty list is acceptable. A short call may warrant a null score — say so in score_basis rather than inventing a number.

5. NO INVENTION. Do not infer facts absent from the transcript: not the customer's identity, not company policy, not what happened after the call, not the agent's intent. If the transcript is ambiguous, say so.

6. BE SPECIFIC. "Showed empathy" is useless to a team leader. "Acknowledged the delay in her own words before offering the fix" is useful. Coaching points should name what to do differently next time.

7. ENGLISH PROSE. Write summary, points and score_basis in English whatever the call's language, so one reviewer can read every call.

Your quotes will be checked automatically against the transcript. Any point whose quote cannot be located will be discarded.`;

export function buildUserPrompt(params: {
  transcript: string;
  languageCode: string | null;
  durationMs: number | null;
}): string {
  const duration =
    params.durationMs != null
      ? `${Math.round(params.durationMs / 1000)} seconds`
      : "unknown";

  return `Call metadata
- Detected language: ${params.languageCode ?? "unknown"}
- Duration: ${duration}

Categories to score (use these keys exactly, one entry each):
${QUALITY_GUIDE}

Transcript (original language, [start_ms-end_ms] per utterance):
${params.transcript}`;
}
