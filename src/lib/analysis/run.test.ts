import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Utterance, Word } from "@/lib/providers/asr";

const structuredCall = vi.fn();
vi.mock("@/lib/providers/llm", () => ({
  structuredCall: (...args: unknown[]) => structuredCall(...args),
}));

const { analyseCall } = await import("@/lib/analysis/run");

/**
 * End-to-end guard on the analysis path: model output → schema validation →
 * verification. This is the test that fails loudly if anyone loosens the
 * verifier, because it is the only place the whole chain runs together.
 */

const SPOKEN: Array<[string, string, number]> = [
  ["A", "good morning you are speaking with priya from acme support", 0],
  ["B", "my connection has been dropping for three days", 6000],
  ["A", "that sounds really frustrating let me run a line test now", 12000],
];

const words: Word[] = SPOKEN.flatMap(([speaker, text, start]) =>
  text.split(" ").map((word, i) => ({
    text: word,
    startMs: start + i * 400,
    endMs: start + i * 400 + 350,
    confidence: 0.94,
    speaker,
  })),
);

const utterances: Utterance[] = SPOKEN.map(([speaker, text, start]) => ({
  speaker,
  text,
  startMs: start,
  endMs: start + text.split(" ").length * 400,
  confidence: 0.94,
}));

function quote(text: string, startMs: number, endMs: number, speaker = "A") {
  return {
    quote_original: text,
    quote_english: text,
    start_ms: startMs,
    end_ms: endMs,
    speaker,
  };
}

const CATEGORIES = [
  { key: "opening", score: 80, note: "Named herself and the company." },
  { key: "empathy", score: 70, note: "Acknowledged the frustration." },
  { key: "discovery", score: null, note: "The customer stated the problem directly." },
];

function respond(over: Record<string, unknown> = {}) {
  structuredCall.mockResolvedValue(
    JSON.stringify({
      categories: CATEGORIES,
      summary: "Customer reported a dropping connection.",
      customer_wanted: "A fix for a connection that keeps dropping.",
      outcome: "unclear",
      strengths: [],
      coaching: [],
      score: 70,
      score_basis: "Judged on the opening and the acknowledgement.",
      ...over,
    }),
  );
}

const run = () =>
  analyseCall({
    utterances,
    words,
    agentSpeakerLabel: "A",
    languageCode: "en",
    durationMs: 20000,
  });

beforeEach(() => structuredCall.mockReset());

describe("analyseCall", () => {
  it("keeps a grounded point", async () => {
    respond({
      strengths: [
        {
          point: "Gave name and company up front.",
          category: "empathy",
          quote: quote("good morning you are speaking with priya", 0, 3600),
        },
      ],
    });

    const result = await run();
    expect(result.insight.strengths).toHaveLength(1);
    expect(result.verification.dropped).toHaveLength(0);
  });

  it("discards a fabricated point before it can reach the page", async () => {
    respond({
      coaching: [
        {
          point: "Promised a replacement router within 24 hours.",
          category: "ownership",
          // Nothing remotely like this was said on the call.
          quote: quote("i will send a replacement router within 24 hours", 12000, 15000),
        },
      ],
    });

    const result = await run();
    expect(result.insight.coaching).toHaveLength(0);
    expect(result.verification.dropped[0].reason).toBe("quote_not_found");
  });

  it("keeps the grounded point and drops the invented one from the same response", async () => {
    respond({
      strengths: [
        {
          point: "Acknowledged the frustration directly.",
          category: "empathy",
          quote: quote("that sounds really frustrating", 12000, 13200),
        },
        {
          point: "Confirmed the fault was fixed.",
          category: "empathy",
          quote: quote("your connection is now fully restored", 15000, 17000),
        },
      ],
    });

    const result = await run();
    expect(result.insight.strengths.map((s) => s.point)).toEqual([
      "Acknowledged the frustration directly.",
    ]);
    expect(result.verification.checked).toBe(2);
    expect(result.verification.dropped).toHaveLength(1);
  });

  it("carries a null score through rather than inventing a number", async () => {
    respond({ score: null, score_basis: "The call ended before anything could be judged." });
    const result = await run();
    expect(result.insight.score).toBeNull();
  });

  it("computes measured metrics alongside the judgement", async () => {
    respond();
    const result = await run();
    expect(result.metrics.talkRatio).toBeGreaterThan(0);
    expect(result.metrics.meanWordConfidence).toBeCloseTo(0.94);
  });

  it("fails loudly when the model returns something off-schema", async () => {
    structuredCall.mockResolvedValue(JSON.stringify({ summary: "ok" }));
    await expect(run()).rejects.toThrow(/schema validation/i);
  });
});

describe("score withholding", () => {
  it("withholds the score when nothing the model said could be verified", async () => {
    // Regression from the first live run: every quote was discarded, the card
    // rendered empty, and a 78/100 sat on top of it.
    respond({
      score: 78,
      score_basis: "Solid open and clear empathy.",
      strengths: [
        {
          point: "Gave a warm greeting.",
          category: "empathy",
          quote: quote("this was never said anywhere on the call", 0, 2000),
        },
      ],
    });

    const result = await run();
    expect(result.insight.strengths).toHaveLength(0);
    expect(result.insight.score).toBeNull();
    expect(result.insight.scoreBasis).toMatch(/could be confirmed/i);
  });

  it("keeps the score when at least one claim survives", async () => {
    respond({
      score: 78,
      strengths: [
        {
          point: "Gave name and company up front.",
          category: "empathy",
          quote: quote("good morning you are speaking with priya", 0, 3600),
        },
      ],
    });

    const result = await run();
    expect(result.insight.score).toBe(78);
  });

  it("leaves a no-claims response alone rather than nulling its score", async () => {
    // Nothing was checked, so there is nothing to have failed.
    respond({ score: 55, strengths: [], coaching: [] });
    const result = await run();
    expect(result.insight.score).toBe(55);
  });
});

describe("category scores", () => {
  it("carries through per-category scores and abstentions", async () => {
    respond();
    const result = await run();
    const byKey = new Map(result.insight.categories.map((c) => [c.key, c]));
    expect(byKey.get("opening")?.score).toBe(80);
    // An abstention stays null rather than becoming a zero.
    expect(byKey.get("discovery")?.score).toBeNull();
  });

  it("withholds every category score when nothing could be verified", async () => {
    // Categories rest on the same unverified reading as the headline score, so
    // publishing them while withholding the headline would just move the
    // unsupported number further down the page.
    respond({
      strengths: [
        {
          point: "Gave a warm greeting.",
          category: "opening",
          quote: quote("this was never said anywhere on the call", 0, 2000),
        },
      ],
    });

    const result = await run();
    expect(result.insight.score).toBeNull();
    expect(result.insight.categories.every((c) => c.score === null)).toBe(true);
    expect(result.insight.categories[0].note).toMatch(/no quote.*confirmed/i);
  });

  it("keeps category scores when at least one claim survives", async () => {
    respond({
      strengths: [
        {
          point: "Gave name and company up front.",
          category: "opening",
          quote: quote("good morning you are speaking with priya", 0, 3600),
        },
      ],
    });
    const result = await run();
    expect(result.insight.categories.find((c) => c.key === "opening")?.score).toBe(80);
  });

  it("tags surviving points with their category so a score can show its evidence", async () => {
    respond({
      strengths: [
        {
          point: "Acknowledged the frustration.",
          category: "empathy",
          quote: quote("that sounds really frustrating", 12000, 13200),
        },
      ],
    });
    const result = await run();
    expect(result.insight.strengths[0].category).toBe("empathy");
  });
});
