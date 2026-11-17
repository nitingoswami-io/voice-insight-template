import { afterEach, describe, expect, it, vi } from "vitest";
import { LANG_CODES, isLangCode } from "./languages";
import { translationPrompt } from "./pipeline";
import { interpreterVoice } from "@/lib/env";
import { isProtectedPath } from "@/lib/access";

describe("interpreter languages", () => {
  it("ships Hindi, French and English", () => {
    expect(LANG_CODES).toEqual(expect.arrayContaining(["hi", "fr", "en"]));
  });

  it("accepts only registered codes", () => {
    expect(isLangCode("fr")).toBe(true);
    expect(isLangCode("de")).toBe(false);
    expect(isLangCode("toString")).toBe(false);
    expect(isLangCode(null)).toBe(false);
  });

  it("names both languages in the prompt and forbids answering", () => {
    const prompt = translationPrompt("fr", "en");
    expect(prompt).toContain("French→English");
    expect(prompt).toMatch(/never answer/i);
  });
});

describe("interpreterVoice", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the per-language env var when set", () => {
    vi.stubEnv("INTERPRETER_VOICE_FR", "french-voice");
    expect(interpreterVoice("fr")).toBe("french-voice");
  });

  it("falls back to the multilingual default", () => {
    vi.stubEnv("INTERPRETER_VOICE_FR", "");
    expect(interpreterVoice("fr")).toBe("21m00Tcm4TlvDq8ikWAM");
  });
});

describe("access gate", () => {
  it("covers the metered interpreter routes", () => {
    expect(isProtectedPath("/interpreter")).toBe(true);
    expect(isProtectedPath("/api/interpreter/translate")).toBe(true);
  });
});
