import { z } from "zod";
import type { Insight, Point } from "@/lib/analysis/types";
import { CATEGORY_KEYS } from "@/lib/quality-guide";

/**
 * The structured-output contract sent to Grok.
 *
 * Every observation must arrive with a quote attached — the schema makes the
 * evidence present, and the verifier then makes it true.
 */

const evidenceSchema = z.object({
  quote_original: z
    .string()
    .min(2)
    .max(1000)
    .describe(
      "Verbatim quote in the ORIGINAL language and script, copied exactly from the transcript. Do not translate, paraphrase, or correct it.",
    ),
  quote_english: z
    .string()
    .max(1000)
    .describe(
      "Literal English translation of quote_original. If the original is already English, repeat it.",
    ),
  start_ms: z
    .number()
    .int()
    .min(0)
    .describe("Start time in milliseconds, copied from the transcript."),
  end_ms: z
    .number()
    .int()
    .min(0)
    .describe("End time in milliseconds, copied from the transcript."),
  speaker: z
    .string()
    .describe(
      "The bare speaker label the quote belongs to — just the identifier that appears at the start of the transcript line, such as \"A\". Do not include the word Speaker or the [agent]/[customer] role tag.",
    ),
});

const pointSchema = z.object({
  point: z
    .string()
    .min(1)
    .max(300)
    .describe("One sentence in English describing what the agent did."),
  category: z
    .enum(CATEGORY_KEYS as [string, ...string[]])
    .describe("Which category key this observation belongs to."),
  quote: evidenceSchema,
});

const categorySchema = z.object({
  key: z
    .enum(CATEGORY_KEYS as [string, ...string[]])
    .describe("The category key, exactly as given."),
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      "0-100 for this category, or null if the call gave no opportunity to judge it. Null is expected and costs the agent nothing — never score a category low merely because it did not come up.",
    ),
  note: z
    .string()
    .max(200)
    .describe("One short sentence in English justifying the score, or saying why it could not be judged."),
});

export const insightSchema = z.object({
  categories: z
    .array(categorySchema)
    .describe(
      "One entry for every category key given, in any order. Do not invent keys and do not omit any.",
    ),
  summary: z
    .string()
    .max(600)
    .describe(
      "Two or three sentences in English: what the customer wanted and what happened. Describe only what is in the transcript.",
    ),
  customer_wanted: z
    .string()
    .max(200)
    .describe("One line in English stating what the customer called about."),
  outcome: z
    .enum(["resolved", "unresolved", "unclear"])
    .describe(
      "Use 'unclear' when the transcript does not show whether the issue was settled. Do not guess.",
    ),
  strengths: z
    .array(pointSchema)
    .max(3)
    .describe("Up to three things the agent did well. Fewer is fine. Empty is fine."),
  coaching: z
    .array(pointSchema)
    .max(3)
    .describe(
      "Up to three specific, actionable things the agent should do differently. Fewer is fine. Empty is fine.",
    ),
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      "Overall quality 0-100, or null if the call was too short or too unclear to judge fairly. Null is a valid and expected answer for an abandoned call.",
    ),
  score_basis: z
    .string()
    .max(300)
    .describe(
      "One sentence in English saying what the score rests on and what you could not assess.",
    ),
});

export type RawInsight = z.infer<typeof insightSchema>;

/**
 * JSON Schema for the xAI `response_format`. zod 4 emits Draft 2020-12, the
 * dialect xAI's structured outputs are built around.
 */
export function insightJsonSchema() {
  return z.toJSONSchema(insightSchema, { target: "draft-2020-12" });
}

function toPoints(raw: RawInsight["strengths"]): Point[] {
  return raw.map((p) => ({
    point: p.point,
    category: p.category,
    quote: {
      quoteOriginal: p.quote.quote_original,
      quoteEnglish: p.quote.quote_english,
      startMs: p.quote.start_ms,
      endMs: p.quote.end_ms,
      speaker: p.quote.speaker,
    },
  }));
}

/** Map the wire format (snake_case) onto the internal shape. */
export function toInsight(raw: RawInsight): Insight {
  return {
    summary: raw.summary,
    categories: raw.categories.map((c) => ({
      key: c.key,
      score: c.score,
      note: c.note,
    })),
    customerWanted: raw.customer_wanted,
    outcome: raw.outcome,
    strengths: toPoints(raw.strengths),
    coaching: toPoints(raw.coaching),
    score: raw.score,
    scoreBasis: raw.score_basis,
  };
}
