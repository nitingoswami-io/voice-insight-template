import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isProviderUnavailable,
  providerErrorResponse,
  resetAlertThrottle,
} from "@/lib/provider-errors";

beforeEach(() => {
  resetAlertThrottle();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("isProviderUnavailable", () => {
  it("spots out-of-credit and dead-key errors from every provider", () => {
    const cases: unknown[] = [
      Object.assign(new Error("429 You exceeded your current quota"), { status: 429, code: "insufficient_quota" }),
      Object.assign(new Error("401 Incorrect API key provided"), { status: 401 }),
      new Error('AssemblyAI POST /v2/upload failed: 401 {"error":"Authentication error"}'),
      new Error("AssemblyAI POST /v2/transcript failed: 400 Your account balance is negative"),
      new Error("Text-to-speech failed (401)."),
      new Error("Text-to-speech failed (402)."),
      new Error("You have no credits remaining. Add credits to continue."),
    ];
    for (const e of cases) expect(isProviderUnavailable(e)).toBe(true);
  });

  it("leaves ordinary failures alone", () => {
    const cases: unknown[] = [
      Object.assign(new Error("429 Rate limit reached for requests"), { status: 429 }),
      new Error("No speech detected. Try again and speak clearly for at least a second."),
      new Error("Text-to-speech failed (500)."),
      new Error("AssemblyAI GET /v2/transcript/x failed: 404 not found"),
    ];
    for (const e of cases) expect(isProviderUnavailable(e)).toBe(false);
  });
});

describe("providerErrorResponse", () => {
  it("answers 503 demo_unavailable without the provider's text", async () => {
    const res = await providerErrorResponse(
      Object.assign(new Error("429 You exceeded your current quota"), { code: "insufficient_quota" }),
      "OpenAI",
      "fallback",
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("demo_unavailable");
    expect(body.error).not.toMatch(/quota/);
  });

  it("keeps a 500 with the message for anything else", async () => {
    const res = await providerErrorResponse(new Error("boom"), "OpenAI", "fallback");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "boom" });
  });
});
