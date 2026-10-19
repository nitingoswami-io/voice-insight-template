import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  constantTimeEqual,
  gateActive,
  isProtectedPath,
  isValidCode,
  isValidToken,
  issueToken,
  accessConfigured,
  publicMaxBytes,
  publicMode,
  safeNext,
  uploadLimitFor,
} from "@/lib/access";
import { PLATFORM_MAX_BYTES } from "@/lib/limits";

beforeEach(() => {
  vi.stubEnv("ACCESS_CODE", "");
  delete process.env.ACCESS_CODE;
  vi.stubEnv("PUBLIC_MAX_MB", "");
  delete process.env.PUBLIC_MAX_MB;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const setNodeEnv = (value: string) => vi.stubEnv("NODE_ENV", value);
const setCode = (value: string) => vi.stubEnv("ACCESS_CODE", value);

describe("isProtectedPath", () => {
  it("covers the demo and every route that calls a metered API", () => {
    for (const p of [
      "/demo",
      "/demo/anything",
      "/api/transcribe",
      "/api/status",
      "/api/insight",
    ]) {
      expect(isProtectedPath(p)).toBe(true);
    }
  });

  it("leaves the overview and the unlock flow open", () => {
    // Gating the unlock route would leave no way in.
    for (const p of ["/", "/unlock", "/api/access"]) {
      expect(isProtectedPath(p)).toBe(false);
    }
  });

  it("does not treat a lookalike prefix as protected", () => {
    expect(isProtectedPath("/demonstration")).toBe(false);
    expect(isProtectedPath("/api/transcribe-something-else")).toBe(false);
  });
});

describe("gateActive", () => {
  it("stays open in development when no code is set", () => {
    setNodeEnv("development");
    expect(gateActive()).toBe(false);
  });

  it("stays open in production when no code is set — the gate is opt-in", () => {
    // A fresh fork should work on its first deploy. Setting a code is a
    // documented step before sharing a public URL.
    setNodeEnv("production");
    expect(gateActive()).toBe(false);
    expect(accessConfigured()).toBe(false);
  });

  it("is active in production once a code exists", () => {
    setNodeEnv("production");
    setCode("let-me-in-please");
    expect(gateActive()).toBe(true);
  });

  it("is active in development once a code exists", () => {
    setNodeEnv("development");
    setCode("let-me-in-please");
    expect(gateActive()).toBe(true);
  });
});

describe("constantTimeEqual", () => {
  it("matches identical strings", () => {
    expect(constantTimeEqual("abc123", "abc123")).toBe(true);
  });

  it("rejects different strings, including different lengths", () => {
    expect(constantTimeEqual("abc123", "abc124")).toBe(false);
    expect(constantTimeEqual("abc", "abc123")).toBe(false);
    expect(constantTimeEqual("", "abc")).toBe(false);
  });

  it("handles multi-byte characters without throwing", () => {
    expect(constantTimeEqual("नमस्ते", "नमस्ते")).toBe(true);
    expect(constantTimeEqual("नमस्ते", "வணக்கம்")).toBe(false);
  });
});

describe("tokens", () => {
  it("issues nothing when no code is configured", async () => {
    expect(await issueToken()).toBeNull();
  });

  it("round-trips a token for the configured code", async () => {
    setCode("correct-horse-battery-staple");
    const token = await issueToken();
    expect(token).toBeTruthy();
    expect(await isValidToken(token)).toBe(true);
  });

  it("never leaks the code into the cookie value", async () => {
    setCode("correct-horse-battery-staple");
    const token = (await issueToken())!;
    expect(token).not.toContain("correct-horse");
  });

  it("invalidates every token when the code changes", async () => {
    setCode("first-code-value");
    const old = await issueToken();
    setCode("second-code-value");
    expect(await isValidToken(old)).toBe(false);
  });

  it("rejects a missing or junk token", async () => {
    setCode("correct-horse-battery-staple");
    expect(await isValidToken(undefined)).toBe(false);
    expect(await isValidToken("")).toBe(false);
    expect(await isValidToken("not-a-real-token")).toBe(false);
  });

  it("rejects any token when the gate is unconfigured", async () => {
    expect(await isValidToken("anything-at-all")).toBe(false);
  });
});

describe("isValidCode", () => {
  it("accepts the configured code and nothing else", async () => {
    setCode("s3cret-demo-code");
    expect(await isValidCode("s3cret-demo-code")).toBe(true);
    expect(await isValidCode("s3cret-demo-cod")).toBe(false);
    expect(await isValidCode("")).toBe(false);
  });

  it("refuses everything when no code is configured", async () => {
    expect(await isValidCode("")).toBe(false);
    expect(await isValidCode("guess")).toBe(false);
  });
});

describe("safeNext", () => {
  it("keeps a legitimate protected destination", () => {
    expect(safeNext("/demo")).toBe("/demo");
    expect(safeNext("/demo?x=1")).toBe("/demo?x=1");
  });

  it("refuses an absolute URL — this is the open-redirect guard", () => {
    // Without this the unlock page becomes a redirector wearing our own
    // domain, which is precisely what a convincing phishing link needs.
    expect(safeNext("https://evil.example")).toBe("/demo");
    expect(safeNext("http://evil.example/x")).toBe("/demo");
  });

  it("refuses a protocol-relative URL", () => {
    expect(safeNext("//evil.example")).toBe("/demo");
  });

  it("refuses backslash and newline smuggling", () => {
    expect(safeNext("/\\evil.example")).toBe("/demo");
    expect(safeNext("/demo\nLocation: https://evil.example")).toBe("/demo");
  });

  it("refuses a same-origin path the gate does not protect", () => {
    // No point bouncing someone to a public page through the unlock flow.
    expect(safeNext("/unlock")).toBe("/demo");
    expect(safeNext("/")).toBe("/demo");
  });

  it("falls back when nothing was given", () => {
    expect(safeNext(null)).toBe("/demo");
    expect(safeNext("")).toBe("/demo");
  });
});

describe("public mode", () => {
  const MB = 1024 * 1024;
  const setPublic = (value: string) => vi.stubEnv("PUBLIC_MAX_MB", value);

  it("is off by default, with the platform limit for everyone", async () => {
    expect(publicMode()).toBe(false);
    expect(await uploadLimitFor(undefined)).toBe(PLATFORM_MAX_BYTES);
  });

  it("opens the gate even when an access code is set", () => {
    // The code now lifts the cap instead of guarding the door.
    setCode("let-me-in-please");
    setPublic("1.5");
    expect(publicMode()).toBe(true);
    expect(gateActive()).toBe(false);
  });

  it("caps anonymous visitors and lifts the cap for a valid cookie", async () => {
    setCode("let-me-in-please");
    setPublic("1.5");
    expect(await uploadLimitFor(undefined)).toBe(1.5 * MB);
    expect(await uploadLimitFor("forged-token")).toBe(1.5 * MB);
    expect(await uploadLimitFor(await issueToken())).toBe(PLATFORM_MAX_BYTES);
  });

  it("never raises the cap above the platform limit", () => {
    setPublic("50");
    expect(publicMaxBytes()).toBe(PLATFORM_MAX_BYTES);
  });

  it("ignores a value that is not a positive number", () => {
    // A typo should neither remove the cap silently nor block every upload.
    for (const bad of ["abc", "0", "-2"]) {
      setPublic(bad);
      expect(publicMaxBytes()).toBeNull();
    }
  });
});
