import { describe, expect, it } from "vitest";
import type { Word } from "@/lib/providers/asr";
import type { Evidence, Point } from "@/lib/analysis/types";
import {
  buildTranscriptIndex,
  combineStats,
  isLowConfidence,
  locateQuote,
  normalize,
  speakerMatches,
  verifyPoints,
} from "@/lib/verify";

/**
 * Build a word stream from a compact spec: each entry is one speaker turn,
 * words spaced 500ms apart starting at `startMs`.
 */
function turn(
  speaker: string,
  text: string,
  startMs: number,
  confidence = 0.95,
): Word[] {
  return text.split(" ").map((word, i) => ({
    text: word,
    startMs: startMs + i * 500,
    endMs: startMs + i * 500 + 400,
    confidence,
    speaker,
  }));
}

function point(quote: Partial<Evidence>, label = "test point"): Point {
  return {
    point: label,
    quote: {
      quoteOriginal: "",
      quoteEnglish: "",
      startMs: 0,
      endMs: 1000,
      speaker: "A",
      ...quote,
    },
  };
}

describe("normalize", () => {
  it("folds Latin diacritics and punctuation", () => {
    expect(normalize("Café, s'il vous plaît!")).toBe("cafe s il vous plait");
  });

  it("preserves Devanagari vowel signs", () => {
    // The critical case. Naive NFD-and-drop-all-marks would collapse all three
    // to "क", making unrelated Hindi words match each other.
    const ka = normalize("का");
    const ki = normalize("कि");
    const kee = normalize("की");
    expect(new Set([ka, ki, kee]).size).toBe(3);
    expect(ka).not.toBe("क");
  });

  it("preserves Tamil vowel signs", () => {
    expect(normalize("கா")).not.toBe(normalize("கி"));
  });
});

describe("locateQuote", () => {
  const words = [
    ...turn("A", "good morning thank you for calling acme support", 0),
    ...turn("B", "my internet has been down since yesterday", 5000),
    ...turn("A", "i am sorry to hear that let me check your line", 10000),
  ];
  const index = buildTranscriptIndex(words);

  it("finds an exact quote and returns the real span", () => {
    const result = locateQuote(index, "thank you for calling", 1000, 2500);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.span.speaker).toBe("A");
    expect(result.span.startMs).toBe(1000);
  });

  it("tolerates punctuation and case differences", () => {
    expect(locateQuote(index, "Good morning, thank you!", 0, 2000).ok).toBe(true);
  });

  it("rejects a fabricated quote", () => {
    const result = locateQuote(
      index,
      "we will refund you the full amount today",
      1000,
      3000,
    );
    expect(result).toEqual({ ok: false, reason: "quote_not_found" });
  });

  it("rejects a real quote claimed at the wrong time", () => {
    // Said at ~10s; claimed at ~60s.
    const result = locateQuote(index, "i am sorry to hear that", 60000, 62000);
    expect(result).toEqual({ ok: false, reason: "timestamp_mismatch" });
  });

  it("disambiguates a repeated phrase by timestamp", () => {
    const repeated = [
      ...turn("A", "yes", 0),
      ...turn("B", "yes", 20000),
      ...turn("A", "yes", 40000),
    ];
    const result = locateQuote(buildTranscriptIndex(repeated), "yes", 20000, 20400);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.span.speaker).toBe("B");
  });
});

describe("verifyPoints", () => {
  const words = [
    ...turn("A", "good morning you are speaking with priya from acme", 0),
    ...turn("B", "i have been waiting three days for this to be fixed", 6000),
    ...turn("A", "i completely understand your frustration", 12000),
  ];

  it("keeps a grounded point and snaps it to the transcript's timings", () => {
    const { kept, dropped } = verifyPoints(
      [
        point({
          quoteOriginal: "good morning you are speaking with priya",
          startMs: 200, // deliberately imprecise
          endMs: 3200,
          speaker: "A",
        }),
      ],
      words,
    );

    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
    // Snapped to the transcript's own timings, not the model's claim.
    expect(kept[0].quote.startMs).toBe(0);
    expect(kept[0].quote.asrConfidence).toBeCloseTo(0.95);
  });

  it("drops a fabricated quote and records why", () => {
    const { kept, dropped } = verifyPoints(
      [
        point({
          quoteOriginal: "i have issued a full refund to your card",
          startMs: 12000,
          endMs: 14000,
          speaker: "A",
        }),
      ],
      words,
    );

    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toBe("quote_not_found");
  });

  it("drops a real quote attributed to the wrong speaker", () => {
    const { kept, dropped } = verifyPoints(
      [
        point({
          quoteOriginal: "i completely understand your frustration",
          startMs: 12000,
          endMs: 14000,
          speaker: "B", // actually spoken by A
        }),
      ],
      words,
    );

    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toBe("speaker_mismatch");
  });

  it("keeps the grounded point and drops the invented one from the same list", () => {
    const { kept, dropped } = verifyPoints(
      [
        point(
          { quoteOriginal: "i completely understand your frustration", startMs: 12000, endMs: 14000 },
          "Acknowledged the frustration",
        ),
        point(
          { quoteOriginal: "your connection is now fully restored", startMs: 15000, endMs: 17000 },
          "Confirmed the fix",
        ),
      ],
      words,
    );

    expect(kept.map((k) => k.point)).toEqual(["Acknowledged the frustration"]);
    expect(dropped.map((d) => d.point)).toEqual(["Confirmed the fix"]);
  });

  it("verifies Hindi evidence", () => {
    const hindi = [
      ...turn("A", "नमस्ते सर आपकी क्या मदद कर सकता हूं", 0),
      ...turn("B", "मेरा बिल गलत आया है", 5000),
    ];
    const { kept } = verifyPoints(
      [point({ quoteOriginal: "नमस्ते सर आपकी क्या मदद", startMs: 0, endMs: 2500 })],
      hindi,
    );
    expect(kept).toHaveLength(1);
  });

  it("verifies code-switched Hinglish evidence", () => {
    const hinglish = [
      ...turn("A", "sir aapka refund process हो चुका है please check karein", 0),
    ];
    const { kept } = verifyPoints(
      [point({ quoteOriginal: "aapka refund process हो चुका है", startMs: 500, endMs: 3000 })],
      hinglish,
    );
    expect(kept).toHaveLength(1);
  });

  it("skips speaker checks when diarization did not run", () => {
    const undiarized = words.map((w) => ({ ...w, speaker: null }));
    const { kept } = verifyPoints(
      [
        point({
          quoteOriginal: "good morning you are speaking with priya",
          startMs: 0,
          endMs: 3000,
          speaker: "A",
        }),
      ],
      undiarized,
    );
    expect(kept).toHaveLength(1);
  });
});

describe("combineStats", () => {
  it("totals what was checked and what was thrown away", () => {
    const stats = combineStats([
      { kept: [point({})], dropped: [] },
      {
        kept: [],
        dropped: [{ point: "p", reason: "quote_not_found", quote: "q" }],
      },
    ]);
    expect(stats.checked).toBe(2);
    expect(stats.dropped).toHaveLength(1);
  });
});

describe("isLowConfidence", () => {
  it("flags a point resting on unclear audio", () => {
    expect(isLowConfidence(point({ asrConfidence: 0.42 }))).toBe(true);
  });

  it("does not flag clean audio", () => {
    expect(isLowConfidence(point({ asrConfidence: 0.95 }))).toBe(false);
  });
});

describe("speakerMatches", () => {
  // Regression: the prompt used to render "Speaker A (agent)", the model
  // faithfully echoed that whole string, and every finding on a real call was
  // discarded as a mismatch. The bare label is authoritative when present.
  it("accepts the decorated forms a model actually returns", () => {
    for (const claimed of ["A", "Speaker A", "speaker a", "A (agent)", "A [agent]"]) {
      expect(speakerMatches(claimed, "A", "A")).toBe(true);
    }
  });

  it("resolves bare role words against the agent label", () => {
    expect(speakerMatches("agent", "A", "A")).toBe(true);
    expect(speakerMatches("agent", "B", "A")).toBe(false);
    expect(speakerMatches("customer", "B", "A")).toBe(true);
    expect(speakerMatches("customer", "A", "A")).toBe(false);
  });

  it("still rejects a genuinely wrong label", () => {
    expect(speakerMatches("B", "A", "A")).toBe(false);
  });

  it("skips the check when either side is missing", () => {
    expect(speakerMatches("", "A", "A")).toBe(true);
    expect(speakerMatches("A", null, "A")).toBe(true);
  });
});
