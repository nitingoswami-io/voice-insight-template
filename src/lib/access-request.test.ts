import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  allowRequest,
  handleAccessRequest,
  normaliseEmail,
  resetRequestLimits,
} from "@/lib/access-request";

const post = (body: unknown, ip = "1.2.3.4") =>
  new Request("https://voice.example/api/access/request", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify(body),
  });

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetRequestLimits();
  vi.stubEnv("DEMO_ACCESS_SECRET", "test-secret-test-secret-test-secret");
  vi.stubEnv("RESEND_API_KEY", "");
  delete process.env.RESEND_API_KEY;
  vi.stubEnv("ACCESS_NOTIFY_EMAIL", "");
  delete process.env.ACCESS_NOTIFY_EMAIL;
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("normaliseEmail", () => {
  it("lower-cases and trims a valid address, rejects junk", () => {
    expect(normaliseEmail("  A@Example.COM ")).toBe("a@example.com");
    for (const bad of ["", "a@b", "no-at.example.com", 42, null, `${"a".repeat(250)}@x.com`]) {
      expect(normaliseEmail(bad)).toBeNull();
    }
  });
});

describe("allowRequest", () => {
  it("allows one email per 10 minutes and 5 per IP per hour", () => {
    const t = 1_000_000;
    expect(allowRequest("ip", "a@x.com", t)).toBe(true);
    expect(allowRequest("ip", "a@x.com", t + 1000)).toBe(false);
    expect(allowRequest("ip", "a@x.com", t + 11 * 60_000)).toBe(true);
    for (const e of ["b", "c", "d"]) expect(allowRequest("ip", `${e}@x.com`, t + 12 * 60_000)).toBe(true);
    expect(allowRequest("ip", "e@x.com", t + 13 * 60_000)).toBe(false);
  });
});

describe("handleAccessRequest", () => {
  it("accepts a valid email and logs the magic link when email is not configured", async () => {
    const res = await handleAccessRequest(post({ email: "a@example.com" }));
    expect(res.status).toBe(202);
    const logged = String(warn.mock.calls[0]?.[0]);
    expect(logged).toMatch(/https:\/\/voice\.example\/unlock\?pass=v1\.[\w.%-]+&next=\/demo/);
  });

  it("rejects a malformed email with 400", async () => {
    expect((await handleAccessRequest(post({ email: "nope" }))).status).toBe(400);
  });

  it("swallows honeypot submissions without sending", async () => {
    const res = await handleAccessRequest(post({ email: "a@example.com", website: "spam" }));
    expect(res.status).toBe(202);
    expect(warn).not.toHaveBeenCalled();
  });

  it("silently accepts a repeat request without sending twice", async () => {
    await handleAccessRequest(post({ email: "a@example.com" }));
    const res = await handleAccessRequest(post({ email: "a@example.com" }));
    expect(res.status).toBe(202);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("sends through Resend with the configured sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ACCESS_EMAIL_FROM", "Demo desk <demos@example.com>");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await handleAccessRequest(post({ email: "a@example.com" }));
    expect(res.status).toBe(202);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["a@example.com"]);
    expect(body.from).toBe("Demo desk <demos@example.com>");
    expect(body.text).toContain("/unlock?pass=v1.");
    vi.unstubAllGlobals();
  });
});
