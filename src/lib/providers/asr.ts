/**
 * ASR provider interface.
 *
 * The concrete provider sits behind this so a self-hosted Whisper could be
 * swapped in without touching the pipeline.
 */

export type Word = {
  text: string;
  startMs: number;
  endMs: number;
  /** 0-1. Propagated to quotes so unclear audio yields visibly weaker claims. */
  confidence: number;
  /** Diarized speaker label, e.g. "A" / "B". Not a role. */
  speaker: string | null;
};

export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export type Utterance = {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
};

/**
 * The provider's own sentiment classification.
 *
 * A separate series rather than a field on Utterance, because it arrives at
 * sentence granularity — finer than turns — and flattening it onto turns would
 * throw away most of the shape. Surfaced as the provider's three states with
 * attribution, never rolled into a fabricated "happiness" percentage.
 */
export type SentimentSegment = {
  startMs: number;
  endMs: number;
  sentiment: Sentiment;
  speaker: string | null;
};

export type TranscriptResult = {
  providerId: string;
  text: string;
  words: Word[];
  utterances: Utterance[];
  languageCode: string | null;
  languageConfidence: number | null;
  durationMs: number | null;
  sentimentSegments: SentimentSegment[];
};

export type TranscriptStatus =
  | { state: "working" }
  | { state: "ready" }
  | { state: "failed"; error: string };

export interface AsrProvider {
  readonly name: string;
  /** Store raw audio bytes with the provider, returning a URL it can read. */
  upload(audio: ArrayBuffer, contentType: string): Promise<string>;
  /** Enqueue a job. Returns immediately with the provider's job id. */
  submit(audioUrl: string): Promise<{ providerId: string }>;
  /** Cheap status check, used by the client's polling loop. */
  status(providerId: string): Promise<TranscriptStatus>;
  /** Fetch a finished job's full result. */
  fetchResult(providerId: string): Promise<TranscriptResult>;
}
