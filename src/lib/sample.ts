import type { SentimentSegment, Utterance } from "@/lib/providers/asr";
import type { CallMetrics } from "@/lib/metrics";
import type { Insight, VerificationStats } from "@/lib/analysis/types";

/**
 * A worked example, so the output can be seen without spending API credit.
 *
 * It is wired to a loud banner in the UI and is never produced by the pipeline —
 * this is illustrative, not a real analysis, and the interface must never let
 * the two be confused.
 *
 * Deliberately self-consistent: every quote below appears verbatim in the
 * transcript, because a sample that violated the pipeline's own premise would be
 * worse than no sample. The one discarded claim is included to show what the
 * verifier does when the model invents something.
 */

const TURNS: Array<[speaker: string, text: string, startMs: number]> = [
  ["A", "Good afternoon, Bharat Telecom, main Priya bol rahi hoon. How may I help you today?", 0],
  ["B", "Haan, mera broadband teen din se band hai. I have called twice already.", 6200],
  ["A", "Teen din? I'm really sorry — that's a long time to be without a connection.", 12400],
  ["B", "Har baar aap log bolte ho engineer aayega, koi nahi aata.", 18900],
  ["A", "I understand your frustration. Let me check the ticket history right now.", 24100],
  ["A", "Okay, I can see two tickets were raised but neither was assigned to a field engineer.", 30500],
  ["B", "To ab kya hoga? Mujhe work from home karna hai.", 38200],
  ["A", "Main aapke liye ek escalation raise kar rahi hoon abhi.", 43800],
  ["A", "The system is a bit slow today, please bear with me one moment.", 49600],
  ["B", "Kitna time lagega? Please give me a proper answer this time.", 62300],
  ["A", "It should be within 24 to 48 hours, but I cannot promise a fixed slot.", 67100],
  ["B", "Theek hai. Please make sure someone actually calls me.", 74800],
  ["A", "I have added your number as the primary contact. Anything else I can help with?", 79400],
  ["B", "Nahi, bas yahi tha. Thank you.", 85600],
];

export const SAMPLE_UTTERANCES: Utterance[] = TURNS.map(
  ([speaker, text, startMs]) => ({
    speaker,
    text,
    startMs,
    // Roughly 380ms per word, close enough for a realistic-looking timeline.
    endMs: startMs + text.split(" ").length * 380,
    confidence: 0.93,
  }),
);

/** Sentence-level, the granularity the provider actually returns. */
export const SAMPLE_SENTIMENT: SentimentSegment[] = [
  { startMs: 0, endMs: 5200, sentiment: "POSITIVE", speaker: "A" },
  { startMs: 6200, endMs: 11000, sentiment: "NEGATIVE", speaker: "B" },
  { startMs: 12400, endMs: 17700, sentiment: "POSITIVE", speaker: "A" },
  { startMs: 18900, endMs: 23000, sentiment: "NEGATIVE", speaker: "B" },
  { startMs: 24100, endMs: 29000, sentiment: "POSITIVE", speaker: "A" },
  { startMs: 30500, endMs: 36200, sentiment: "NEUTRAL", speaker: "A" },
  { startMs: 38200, endMs: 42000, sentiment: "NEGATIVE", speaker: "B" },
  { startMs: 43800, endMs: 48000, sentiment: "POSITIVE", speaker: "A" },
  { startMs: 49600, endMs: 53800, sentiment: "NEGATIVE", speaker: "A" },
  { startMs: 62300, endMs: 66000, sentiment: "NEGATIVE", speaker: "B" },
  { startMs: 67100, endMs: 73000, sentiment: "NEUTRAL", speaker: "A" },
  { startMs: 74800, endMs: 78000, sentiment: "NEUTRAL", speaker: "B" },
  { startMs: 79400, endMs: 84700, sentiment: "POSITIVE", speaker: "A" },
  { startMs: 85600, endMs: 89000, sentiment: "POSITIVE", speaker: "B" },
];

export const SAMPLE_INSIGHT: Insight = {
  categories: [
    { key: "opening", score: 88, note: "Named herself and the company in the first line." },
    { key: "empathy", score: 82, note: "Acknowledged the three-day outage in her own words." },
    { key: "ownership", score: 79, note: "Owned the unassigned tickets rather than deflecting." },
    { key: "listening", score: 74, note: "Did not make the customer repeat the history." },
    { key: "accuracy", score: 71, note: "Gave a range and said plainly she could not promise a slot." },
    { key: "close", score: 52, note: "Did not confirm the pre-arrival call the customer asked for." },
    { key: "hold", score: 44, note: "Told the customer to bear with her instead of asking." },
    { key: "discovery", score: null, note: "The customer stated the problem directly; nothing to discover." },
    { key: "register", score: null, note: "Call was in English throughout; no register choice arose." },
  ],
  summary:
    "The customer's broadband had been down for three days across two previous calls, neither of which resulted in a field engineer being assigned. The agent found the gap in the ticket history, apologised, and raised an escalation, but could only offer a 24-48 hour window with no fixed appointment.",
  customerWanted: "A broadband fault fixed after three days and two failed callbacks.",
  outcome: "unresolved",
  strengths: [
    {
      category: "empathy",
      point:
        "Acknowledged the three-day delay in her own words before moving to the fix, rather than reading a scripted apology.",
      quote: {
        quoteOriginal:
          "Teen din? I'm really sorry — that's a long time to be without a connection.",
        quoteEnglish:
          "Three days? I'm really sorry — that's a long time to be without a connection.",
        startMs: 12400,
        endMs: 17720,
        speaker: "A",
        asrConfidence: 0.93,
      },
    },
    {
      category: "ownership",
      point:
        "Named the actual root cause from the ticket history instead of repeating the previous promise.",
      quote: {
        quoteOriginal:
          "Okay, I can see two tickets were raised but neither was assigned to a field engineer.",
        quoteEnglish:
          "Okay, I can see two tickets were raised but neither was assigned to a field engineer.",
        startMs: 30500,
        endMs: 36200,
        speaker: "A",
        asrConfidence: 0.95,
      },
    },
  ],
  coaching: [
    {
      category: "hold",
      point:
        "Twelve seconds of dead air while the system loaded. Narrate what you are doing, or offer a callback, so the customer is not left listening to silence.",
      quote: {
        quoteOriginal: "The system is a bit slow today, please bear with me one moment.",
        quoteEnglish: "The system is a bit slow today, please bear with me one moment.",
        startMs: 49600,
        endMs: 53780,
        speaker: "A",
        asrConfidence: 0.52,
      },
    },
    {
      category: "close",
      point:
        "Closed without confirming how the customer would be told an engineer was on the way, after two previous callbacks had already failed.",
      quote: {
        quoteOriginal:
          "I have added your number as the primary contact. Anything else I can help with?",
        quoteEnglish:
          "I have added your number as the primary contact. Anything else I can help with?",
        startMs: 79400,
        endMs: 84720,
        speaker: "A",
        asrConfidence: 0.94,
      },
    },
  ],
  score: 68,
  scoreBasis:
    "Based on the opening, the recovery after the complaint, and the close. Whether the escalation was raised correctly cannot be judged from the audio.",
};

export const SAMPLE_METRICS: CallMetrics = {
  agentTalkMs: 34200,
  customerTalkMs: 18600,
  talkRatio: 0.648,
  silenceMs: 12700,
  longestSilenceMs: 12700,
  overtalkCount: 1,
  longestAgentMonologueMs: 8100,
  agentWordsPerMinute: 142,
  timeToFirstResponseMs: 1400,
  meanWordConfidence: 0.93,
  events: [
    { type: "silence", startMs: 49600, endMs: 62300 },
  ],
};

/** One discarded claim, so the provenance panel shows what it is for. */
export const SAMPLE_VERIFICATION: VerificationStats = {
  checked: 5,
  dropped: [
    {
      point: "Confirmed the engineer would arrive on Tuesday morning.",
      reason: "quote_not_found",
      quote: "Engineer Tuesday morning ko definitely aa jayega, I guarantee it.",
    },
  ],
};

export const SAMPLE_TRANSCRIPT_META = {
  languageCode: "hi",
  durationMs: 91_000,
  agentSpeakerLabel: "A",
};
