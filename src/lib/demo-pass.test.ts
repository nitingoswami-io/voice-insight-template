import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issuePass, verifyPass } from "@/lib/demo-pass";
import { extractPass, readPass } from "@/components/demo-look/pass";

beforeEach(() => {
  vi.stubEnv("DEMO_ACCESS_SECRET", "test-secret-test-secret-test-secret");
  vi.stubEnv("ACCESS_CODE", "");
  delete process.env.ACCESS_CODE;
  vi.stubEnv("DEMO_ID", "");
  delete process.env.DEMO_ID;
});
afterEach(() => vi.unstubAllEnvs());

describe("demo pass v1", () => {
  it("round-trips an email for this demo", async () => {
    const pass = (await issuePass("a@example.com"))!;
    expect(pass).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
    const v = await verifyPass(pass);
    expect(v?.email).toBe("a@example.com");
    expect(v?.aud).toBe("voice-insight");
  });

  it("is readable (not secret) by the browser kit", async () => {
    const pass = (await issuePass("a@example.com"))!;
    expect(readPass(pass)?.email).toBe("a@example.com");
    expect(extractPass(`https://x.example/unlock?pass=${pass}&next=/demo`)).toBe(pass);
  });

  it("rejects a tampered payload or signature", async () => {
    const pass = (await issuePass("a@example.com"))!;
    const [v, payload, sig] = pass.split(".");
    const forged = btoa(JSON.stringify({ sub: "b@example.com", aud: "voice-insight", iat: 0, exp: 9e9 }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await verifyPass(`${v}.${forged}.${sig}`)).toBeNull();
    expect(await verifyPass(`${v}.${payload}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(await verifyPass("v2." + payload + "." + sig)).toBeNull();
    expect(await verifyPass("junk")).toBeNull();
  });

  it("rejects an expired pass", async () => {
    const pass = (await issuePass("a@example.com", { days: 1, now: Date.now() - 2 * 86400_000 }))!;
    expect(await verifyPass(pass)).toBeNull();
  });

  it("rejects a pass for another demo, but honours a site-wide one", async () => {
    const other = (await issuePass("a@example.com", { aud: "rag-demo" }))!;
    expect(await verifyPass(other)).toBeNull();
    const site = (await issuePass("a@example.com", { aud: "*" }))!;
    expect(await verifyPass(site)).not.toBeNull();
  });

  it("is revoked by rotating the secret", async () => {
    const pass = (await issuePass("a@example.com"))!;
    vi.stubEnv("DEMO_ACCESS_SECRET", "a-completely-different-secret-value");
    expect(await verifyPass(pass)).toBeNull();
  });

  it("falls back to ACCESS_CODE as the key, and issues nothing with neither", async () => {
    vi.stubEnv("DEMO_ACCESS_SECRET", "");
    delete process.env.DEMO_ACCESS_SECRET;
    expect(await issuePass("a@example.com")).toBeNull();
    vi.stubEnv("ACCESS_CODE", "code-only-deployment");
    expect(await verifyPass(await issuePass("access-code"))).not.toBeNull();
  });
});
