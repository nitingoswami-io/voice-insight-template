/**
 * Environment access.
 *
 * Lazy on purpose: reading a missing key throws where it is used, not at import
 * time, so `next build` in an environment without secrets still succeeds.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

export const env = {
  get assemblyAiKey() {
    return required("ASSEMBLYAI_API_KEY");
  },
  get xaiKey() {
    return required("XAI_API_KEY");
  },
  get openAiKey() {
    return required("OPENAI_API_KEY");
  },
  get elevenLabsKey() {
    return required("ELEVENLABS_API_KEY");
  },
} as const;

/** Model used for call analysis. */
export const ANALYSIS_MODEL = process.env.XAI_MODEL ?? "grok-4.5";

/** Models and voices used by the voice interpreter demo. */
export const INTERPRETER_STT_MODEL =
  process.env.INTERPRETER_STT_MODEL ?? "whisper-1";
export const INTERPRETER_TRANSLATE_MODEL =
  process.env.INTERPRETER_TRANSLATE_MODEL ?? "gpt-4o-mini";
export const INTERPRETER_TTS_MODEL =
  process.env.INTERPRETER_TTS_MODEL ?? "eleven_multilingual_v2";

/** Default ElevenLabs voice: Rachel, a multilingual voice. */
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

/**
 * ElevenLabs voice id for a language, from `INTERPRETER_VOICE_<CODE>`
 * (e.g. `INTERPRETER_VOICE_FR`), falling back to the multilingual default.
 */
export function interpreterVoice(lang: string): string {
  return process.env[`INTERPRETER_VOICE_${lang.toUpperCase()}`] || DEFAULT_VOICE;
}
