import { ANALYSIS_MODEL } from "@/lib/env";
import { structuredCall } from "@/lib/providers/llm";
import type { Utterance, Word } from "@/lib/providers/asr";
import { computeMetrics, type CallMetrics } from "@/lib/metrics";
import {
  insightJsonSchema,
  insightSchema,
  toInsight,
} from "@/lib/analysis/schema";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  formatTranscript,
} from "@/lib/analysis/prompt";
import { combineStats, verifyPoints } from "@/lib/verify";
import type { Insight, VerificationStats } from "@/lib/analysis/types";

export type AnalysisResult = {
  model: string;
  insight: Insight;
  metrics: CallMetrics;
  verification: VerificationStats;
};

/**
 * Run one analysis: prompt the model, then check everything it said against the
 * transcript before any of it is allowed to count.
 */
export async function analyseCall(params: {
  utterances: Utterance[];
  words: Word[];
  agentSpeakerLabel: string | null;
  languageCode: string | null;
  durationMs: number | null;
}): Promise<AnalysisResult> {
  const raw = await structuredCall({
    model: ANALYSIS_MODEL,
    system: SYSTEM_PROMPT,
    user: buildUserPrompt({
      transcript: formatTranscript(params.utterances, params.agentSpeakerLabel),
      languageCode: params.languageCode,
      durationMs: params.durationMs,
    }),
    schemaName: "call_insight",
    jsonSchema: insightJsonSchema() as Record<string, unknown>,
  });

  // Parse defensively. Structured outputs make malformed JSON unlikely, not
  // impossible, and a parse failure must surface as a failed call rather than a
  // half-populated insight card.
  const parsed = insightSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `Model response failed schema validation: ${parsed.error.message}`,
    );
  }

  const insight = toInsight(parsed.data);

  const strengths = verifyPoints(
    insight.strengths,
    params.words,
    params.agentSpeakerLabel,
  );
  const coaching = verifyPoints(
    insight.coaching,
    params.words,
    params.agentSpeakerLabel,
  );
  const verification = combineStats([strengths, coaching]);

  /**
   * Withhold the score when the model made claims and none of them survived
   * verification.
   *
   * The score is the model's own holistic judgement rather than a sum of the
   * points, so nothing forces it to zero automatically — but if we could not
   * confirm a single thing the model said about this call, we have no grounds
   * to publish a number either. Showing 78/100 above an empty card is exactly
   * the unsupported figure this whole layer exists to prevent.
   */
  const nothingSurvived =
    verification.checked > 0 &&
    strengths.kept.length === 0 &&
    coaching.kept.length === 0;

  return {
    model: ANALYSIS_MODEL,
    insight: {
      ...insight,
      strengths: strengths.kept,
      coaching: coaching.kept,
      score: nothingSurvived ? null : insight.score,
      scoreBasis: nothingSurvived
        ? `Not scored: none of the ${verification.checked} quotes the model gave could be confirmed against the transcript.`
        : insight.scoreBasis,
      // Category scores fall with the overall one. They rest on the same
      // unverified reading of the call, so publishing them while withholding
      // the headline would just move the unsupported number down the page.
      categories: nothingSurvived
        ? insight.categories.map((c) => ({
            ...c,
            score: null,
            note: "Not scored — no quote from this call could be confirmed.",
          }))
        : insight.categories,
    },
    metrics: computeMetrics(params.words, params.agentSpeakerLabel),
    verification,
  };
}
