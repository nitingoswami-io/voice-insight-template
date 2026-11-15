/**
 * Hindi↔English voice interpreter pipeline.
 *
 * Three stages, batch, no streaming — the demo deliberately exposes each stage
 * so the UI can show the transcript, the translation, and the synthesized
 * audio side by side. That visibility is the point of the demo.
 *
 *   audio (hi|en) ──► OpenAI Whisper ──► transcript (hi|en)
 *                                           │
 *                                           ▼
 *                              GPT-4o-mini  ──► translation (en|hi)
 *                                           │
 *                                           ▼
 *                              ElevenLabs   ──► audio (en|hi, mp3)
 */

import OpenAI from "openai";
import {
  INTERPRETER_STT_MODEL,
  INTERPRETER_TRANSLATE_MODEL,
  INTERPRETER_TTS_MODEL,
  INTERPRETER_VOICE_EN,
  INTERPRETER_VOICE_HI,
  env,
} from "@/lib/env";

export type Direction = "hi->en" | "en->hi";

export interface InterpretInput {
  audio: File;
  direction: Direction;
}

export interface InterpretResult {
  direction: Direction;
  /** The speaker's own words, in their language. */
  sourceTranscript: string;
  /** The translation, ready to be spoken to the other side. */
  translation: string;
  /** base64-encoded MP3 of the translation. */
  audioBase64: string;
  audioMimeType: "audio/mpeg";
}

const ISO: Record<Direction, { source: "hi" | "en"; target: "hi" | "en" }> = {
  "hi->en": { source: "hi", target: "en" },
  "en->hi": { source: "en", target: "hi" },
};

const LANG_NAME: Record<"hi" | "en", string> = {
  hi: "Hindi",
  en: "English",
};

export async function interpret(input: InterpretInput): Promise<InterpretResult> {
  const { audio, direction } = input;
  const { source, target } = ISO[direction];

  const openai = new OpenAI({ apiKey: env.openAiKey });

  // 1) Whisper STT — passing `language` improves accuracy on short utterances.
  //    We ask for a JSON response so the SDK's return type is uniform; the
  //    `text` field is all we need downstream.
  const stt = await openai.audio.transcriptions.create({
    file: audio,
    model: INTERPRETER_STT_MODEL,
    language: source,
    response_format: "json",
  });
  const sourceTranscript = (stt.text ?? "").trim();

  if (!sourceTranscript) {
    throw new Error(
      "No speech detected. Try again and speak clearly for at least a second.",
    );
  }

  // 2) Translate. The prompt is terse on purpose: no explanations, no quotes,
  //    no transliteration — just the translated utterance, as it would be spoken.
  const translateResp = await openai.chat.completions.create({
    model: INTERPRETER_TRANSLATE_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          `You are a professional ${LANG_NAME[source]}→${LANG_NAME[target]} interpreter for a restaurant phone call.`,
          `Translate the user's utterance into natural, spoken ${LANG_NAME[target]}.`,
          "Return ONLY the translation. No preamble, no quotes, no romanization, no notes.",
          "Preserve numbers, names, dish names and brand names verbatim.",
          "If the source is already in the target language, repeat it unchanged.",
        ].join(" "),
      },
      { role: "user", content: sourceTranscript },
    ],
  });
  const translation = translateResp.choices[0]?.message?.content?.trim() ?? "";

  if (!translation) {
    throw new Error("Translation returned empty text.");
  }

  // 3) ElevenLabs TTS. REST API, no SDK dep — a single POST returns the MP3.
  const voiceId = target === "en" ? INTERPRETER_VOICE_EN : INTERPRETER_VOICE_HI;
  const ttsResp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.elevenLabsKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: translation,
        model_id: INTERPRETER_TTS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );
  if (!ttsResp.ok) {
    const detail = await ttsResp.text().catch(() => "");
    throw new Error(
      `ElevenLabs TTS failed (${ttsResp.status}): ${detail.slice(0, 200)}`,
    );
  }
  const audioBuffer = await ttsResp.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString("base64");

  return {
    direction,
    sourceTranscript,
    translation,
    audioBase64,
    audioMimeType: "audio/mpeg",
  };
}
