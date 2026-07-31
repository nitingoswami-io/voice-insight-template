import { env } from "@/lib/env";
import type {
  AsrProvider,
  Sentiment,
  TranscriptResult,
  TranscriptStatus,
  Utterance,
  Word,
} from "@/lib/providers/asr";

const API = "https://api.assemblyai.com/v2";

type RawWord = {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string | null;
};

type RawUtterance = {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
};

type RawSentiment = {
  start: number;
  end: number;
  sentiment: Sentiment;
  speaker?: string | null;
};

type RawTranscript = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  text: string | null;
  words: RawWord[] | null;
  utterances: RawUtterance[] | null;
  language_code: string | null;
  language_confidence: number | null;
  audio_duration: number | null;
  sentiment_analysis_results: RawSentiment[] | null;
  error: string | null;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: env.assemblyAiKey,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(
      `AssemblyAI ${init?.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as T;
}

export const assemblyAi: AsrProvider = {
  name: "assemblyai",

  /**
   * Hand the audio to AssemblyAI directly.
   *
   * This is what lets the prototype run with no storage service at all: they
   * hold the bytes long enough to transcribe them, and the browser keeps its own
   * copy via an object URL for playback.
   */
  async upload(audio: ArrayBuffer): Promise<string> {
    const res = await fetch(`${API}/upload`, {
      method: "POST",
      headers: {
        authorization: env.assemblyAiKey,
        "content-type": "application/octet-stream",
      },
      body: audio,
    });
    if (!res.ok) {
      throw new Error(`AssemblyAI upload failed: ${res.status} ${await res.text()}`);
    }
    const { upload_url } = (await res.json()) as { upload_url: string };
    return upload_url;
  },

  async submit(audioUrl: string) {
    const created = await call<RawTranscript>("/transcript", {
      method: "POST",
      body: JSON.stringify({
        audio_url: audioUrl,

        // Language-agnostic by design: the uploader never declares a language,
        // and we never pre-translate.
        language_detection: true,

        // Diarization gives us "A"/"B". Role assignment happens in our code.
        speaker_labels: true,

        // Provider-measured sentiment per utterance. Shown as their three-state
        // label with attribution, not converted into a score of our own.
        sentiment_analysis: true,
      }),
    });
    return { providerId: created.id };
  },

  async status(providerId: string): Promise<TranscriptStatus> {
    const t = await call<RawTranscript>(`/transcript/${providerId}`);
    if (t.status === "error") {
      return { state: "failed", error: t.error ?? "Transcription failed" };
    }
    return t.status === "completed" ? { state: "ready" } : { state: "working" };
  },

  async fetchResult(providerId: string): Promise<TranscriptResult> {
    const t = await call<RawTranscript>(`/transcript/${providerId}`);

    if (t.status === "error") {
      throw new Error(`AssemblyAI transcription failed: ${t.error}`);
    }
    if (t.status !== "completed") {
      throw new Error(`Transcript ${providerId} is ${t.status}, not completed`);
    }

    // AssemblyAI reports times in milliseconds and duration in seconds.
    const words: Word[] = (t.words ?? []).map((w) => ({
      text: w.text,
      startMs: w.start,
      endMs: w.end,
      confidence: w.confidence,
      speaker: w.speaker ?? null,
    }));

    const utterances: Utterance[] = (t.utterances ?? []).map((u) => ({
      speaker: u.speaker,
      text: u.text,
      startMs: u.start,
      endMs: u.end,
      confidence: u.confidence,
    }));

    // Sentiment arrives per sentence in its own array, not on the utterances.
    const sentimentSegments = (t.sentiment_analysis_results ?? []).map((r) => ({
      startMs: r.start,
      endMs: r.end,
      sentiment: r.sentiment,
      speaker: r.speaker ?? null,
    }));

    return {
      providerId: t.id,
      text: t.text ?? "",
      words,
      utterances,
      languageCode: t.language_code,
      languageConfidence: t.language_confidence,
      durationMs: t.audio_duration != null ? t.audio_duration * 1000 : null,
      sentimentSegments,
    };
  },
};
