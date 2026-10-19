/**
 * Deterministic call measurements.
 *
 * Everything here is arithmetic over the ASR word stream — no model is
 * involved. These numbers are exact, and the UI renders them differently from
 * judged scores for that reason. Blending measured and judged values into a
 * single "score" is how call-QA tools manufacture false confidence.
 */

import type { Word } from "@/lib/providers/asr";

/**
 * A moment worth marking on the timeline.
 *
 * The counts alone are not coachable — "5.2 seconds of silence" tells a team
 * leader nothing they can act on, whereas a mark at 0:49 lets them point at the
 * screen and play it.
 */
export type CallEvent = {
  type: "silence" | "interruption";
  startMs: number;
  endMs: number;
};

export type CallMetrics = {
  agentTalkMs: number;
  customerTalkMs: number;
  /** Agent share of total speech, 0-1. Not a judgement, just a proportion. */
  talkRatio: number;
  silenceMs: number;
  longestSilenceMs: number;
  overtalkCount: number;
  longestAgentMonologueMs: number;
  agentWordsPerMinute: number;
  /** Null when the agent never spoke first, so there is nothing to respond to. */
  timeToFirstResponseMs: number | null;
  meanWordConfidence: number;
  /** Where the silences and interruptions actually fell. */
  events: CallEvent[];
};

/** Gaps longer than this count as silence rather than natural pausing. */
const SILENCE_THRESHOLD_MS = 3_000;

/** A turn separated by less than this from the previous one is a continuation. */
const TURN_GAP_MS = 800;

type Turn = { speaker: string | null; startMs: number; endMs: number; words: number };

function toTurns(words: Word[]): Turn[] {
  const turns: Turn[] = [];
  for (const word of words) {
    const last = turns[turns.length - 1];
    if (last && last.speaker === word.speaker && word.startMs - last.endMs < TURN_GAP_MS) {
      last.endMs = Math.max(last.endMs, word.endMs);
      last.words++;
    } else {
      turns.push({
        speaker: word.speaker,
        startMs: word.startMs,
        endMs: word.endMs,
        words: 1,
      });
    }
  }
  return turns;
}

/**
 * Silence is measured strictly between turns. Dead air before the first word or
 * after the last is deliberately excluded: we do not know whether the recording
 * starts at connect time or at ring, so counting it would attribute the
 * platform's behaviour to the agent.
 */
export function computeMetrics(
  words: Word[],
  agentSpeakerLabel: string | null,
): CallMetrics {
  const empty: CallMetrics = {
    agentTalkMs: 0,
    customerTalkMs: 0,
    talkRatio: 0,
    silenceMs: 0,
    longestSilenceMs: 0,
    overtalkCount: 0,
    longestAgentMonologueMs: 0,
    agentWordsPerMinute: 0,
    timeToFirstResponseMs: null,
    meanWordConfidence: 0,
    events: [],
  };
  if (words.length === 0) return empty;

  const sorted = [...words].sort((a, b) => a.startMs - b.startMs);
  const turns = toTurns(sorted);

  let agentTalkMs = 0;
  let customerTalkMs = 0;
  let agentWords = 0;
  let longestAgentMonologueMs = 0;

  for (const turn of turns) {
    const length = Math.max(0, turn.endMs - turn.startMs);
    if (agentSpeakerLabel != null && turn.speaker === agentSpeakerLabel) {
      agentTalkMs += length;
      agentWords += turn.words;
      longestAgentMonologueMs = Math.max(longestAgentMonologueMs, length);
    } else if (turn.speaker != null) {
      customerTalkMs += length;
    }
  }

  // Silence and overtalk from the gaps between consecutive turns.
  let silenceMs = 0;
  let longestSilenceMs = 0;
  let overtalkCount = 0;
  const events: CallEvent[] = [];
  for (let i = 1; i < turns.length; i++) {
    const gap = turns[i].startMs - turns[i - 1].endMs;
    if (gap < 0 && turns[i].speaker !== turns[i - 1].speaker) {
      // Next speaker began before the previous finished: an interruption.
      overtalkCount++;
      events.push({
        type: "interruption",
        startMs: turns[i].startMs,
        endMs: turns[i - 1].endMs,
      });
    } else if (gap >= SILENCE_THRESHOLD_MS) {
      silenceMs += gap;
      longestSilenceMs = Math.max(longestSilenceMs, gap);
      events.push({
        type: "silence",
        startMs: turns[i - 1].endMs,
        endMs: turns[i].startMs,
      });
    }
  }

  // Time from the customer's first word to the agent's first word after it.
  let timeToFirstResponseMs: number | null = null;
  if (agentSpeakerLabel != null) {
    const firstCustomer = turns.find(
      (t) => t.speaker != null && t.speaker !== agentSpeakerLabel,
    );
    if (firstCustomer) {
      const reply = turns.find(
        (t) => t.speaker === agentSpeakerLabel && t.startMs >= firstCustomer.endMs,
      );
      if (reply) timeToFirstResponseMs = reply.startMs - firstCustomer.endMs;
    }
  }

  const totalTalk = agentTalkMs + customerTalkMs;
  const confidenceSum = sorted.reduce((sum, w) => sum + (w.confidence ?? 1), 0);

  return {
    agentTalkMs,
    customerTalkMs,
    talkRatio: totalTalk > 0 ? agentTalkMs / totalTalk : 0,
    silenceMs,
    longestSilenceMs,
    overtalkCount,
    longestAgentMonologueMs,
    agentWordsPerMinute:
      agentTalkMs > 0 ? agentWords / (agentTalkMs / 60_000) : 0,
    timeToFirstResponseMs,
    meanWordConfidence: confidenceSum / sorted.length,
    events,
  };
}

/**
 * Guess which diarized label is the agent: on an inbound support call the agent
 * almost always speaks first, delivering the greeting.
 *
 * This is a heuristic, and the UI says so next to the timeline. A
 * stereo recording with agent and customer on separate channels removes the
 * guess entirely and should be preferred where the telephony platform offers it.
 */
export function guessAgentSpeaker(words: Word[]): string | null {
  for (const word of words) {
    if (word.speaker) return word.speaker;
  }
  return null;
}
