import { describe, expect, it } from "vitest";
import { computeMetrics, guessAgentSpeaker } from "@/lib/metrics";
import type { Word } from "@/lib/providers/asr";

function words(
  spec: Array<[speaker: string, text: string, startMs: number]>,
  confidence = 0.95,
): Word[] {
  return spec.flatMap(([speaker, text, startMs]) =>
    text.split(" ").map((word, i) => ({
      text: word,
      startMs: startMs + i * 500,
      endMs: startMs + i * 500 + 400,
      confidence,
      speaker,
    })),
  );
}

describe("computeMetrics", () => {
  it("returns zeroes for an empty word stream rather than NaN", () => {
    const m = computeMetrics([], "A");
    expect(m.talkRatio).toBe(0);
    expect(m.agentWordsPerMinute).toBe(0);
    expect(Number.isNaN(m.meanWordConfidence)).toBe(false);
  });

  it("splits talk time by speaker", () => {
    const m = computeMetrics(
      words([
        ["A", "one two three four", 0],
        ["B", "five six", 10000],
      ]),
      "A",
    );
    expect(m.agentTalkMs).toBeGreaterThan(m.customerTalkMs);
    expect(m.talkRatio).toBeGreaterThan(0.5);
  });

  it("counts silences longer than the threshold and ignores natural pauses", () => {
    const m = computeMetrics(
      words([
        ["A", "hello", 0],
        ["B", "hi", 900], // short pause, not silence
        ["A", "still there", 12000], // ~11s gap
      ]),
      "A",
    );
    expect(m.longestSilenceMs).toBeGreaterThan(3000);
    expect(m.silenceMs).toBe(m.longestSilenceMs);
  });

  it("counts an interruption when a speaker starts before the other finishes", () => {
    const overlapping: Word[] = [
      { text: "i", startMs: 0, endMs: 3000, confidence: 0.9, speaker: "A" },
      { text: "but", startMs: 2000, endMs: 2500, confidence: 0.9, speaker: "B" },
    ];
    expect(computeMetrics(overlapping, "A").overtalkCount).toBe(1);
  });

  it("measures time from the customer's turn to the agent's reply", () => {
    const m = computeMetrics(
      words([
        ["B", "my bill is wrong", 0],
        ["A", "let me check", 6000],
      ]),
      "A",
    );
    expect(m.timeToFirstResponseMs).toBeGreaterThan(3000);
  });

  it("reports mean word confidence for gating on poor audio", () => {
    const m = computeMetrics(words([["A", "muffled words here", 0]], 0.4), "A");
    expect(m.meanWordConfidence).toBeCloseTo(0.4);
  });
});

describe("guessAgentSpeaker", () => {
  it("assumes whoever speaks first is the agent", () => {
    expect(guessAgentSpeaker(words([["B", "hello", 0], ["A", "hi", 2000]]))).toBe("B");
  });

  it("returns null when diarization produced no labels", () => {
    const unlabelled = words([["A", "hello", 0]]).map((w) => ({
      ...w,
      speaker: null,
    }));
    expect(guessAgentSpeaker(unlabelled)).toBeNull();
  });
});
