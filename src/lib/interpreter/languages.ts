/**
 * Languages the interpreter can hear and speak.
 *
 * Shared by the browser (dropdowns) and the server (validation, prompts,
 * voice selection), so it has no server-only imports. Adding a language is one
 * entry here plus, optionally, an `INTERPRETER_VOICE_<CODE>` env var — Whisper,
 * GPT-4o-mini and ElevenLabs multilingual v2 all cover far more than three.
 */

export const LANGUAGES = {
  en: { name: "English", native: "English" },
  hi: { name: "Hindi", native: "हिन्दी" },
  fr: { name: "French", native: "Français" },
} as const;

/** ISO-639-1 code, which is also what Whisper's `language` hint expects. */
export type LangCode = keyof typeof LANGUAGES;

export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

export function isLangCode(value: unknown): value is LangCode {
  return typeof value === "string" && Object.hasOwn(LANGUAGES, value);
}
