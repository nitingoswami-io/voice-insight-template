/**
 * Optional access gate for the routes that call metered APIs.
 *
 * `/api/transcribe` and `/api/insight` spend credit on your AssemblyAI and xAI
 * accounts. Run locally, that is fine. Deploy a fork to a public URL and anyone
 * who finds it can spend your credit. Setting `ACCESS_CODE` puts a shared code
 * in front of those routes; leaving it unset keeps everything open.
 *
 * The landing page stays public either way — the gate covers only the routes
 * that cost something.
 *
 * Public mode (`PUBLIC_MAX_MB`) is the middle ground for a hosted demo: the
 * routes are open to everyone, but uploads are capped at that size. A valid
 * access cookie lifts the cap back to the platform limit.
 *
 * Built on Web Crypto rather than `node:crypto` so the module stays portable
 * across runtimes — the proxy and the route handlers both import it.
 */

import { PLATFORM_MAX_BYTES } from "@/lib/limits";

export const ACCESS_COOKIE = "voice_insight_access";

/** Signed payload. Bumping this invalidates every issued cookie at once. */
const PAYLOAD = "voice-insight-access-v1";

/** Seven days: long enough to be convenient, short enough to expire a leak. */
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 7;

/** Paths the gate protects when it is on. Everything else is public. */
export const PROTECTED_PREFIXES = [
  "/demo",
  "/api/transcribe",
  "/api/status",
  "/api/insight",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Whether an access code is configured. */
export function accessConfigured(): boolean {
  return Boolean(process.env.ACCESS_CODE);
}

/**
 * Where the unlock form may send someone afterwards.
 *
 * The `next` parameter is attacker-controlled — it arrives in a URL anyone can
 * craft and share. Without this, `?next=https://evil.example` would turn the
 * unlock page into an open redirect wearing our domain, which is exactly the
 * shape a credible phishing link needs. Only same-origin paths that the gate
 * actually protects are allowed through; anything else falls back to the demo.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/demo";
  // Reject protocol-relative ("//evil.example") and absolute URLs alike.
  if (!next.startsWith("/") || next.startsWith("//")) return "/demo";
  if (next.includes("\\") || next.includes("\n") || next.includes("\r")) {
    return "/demo";
  }
  const path = next.split("?")[0];
  return isProtectedPath(path) ? next : "/demo";
}

/**
 * Whether the gate is on.
 *
 * Opt-in: on exactly when `ACCESS_CODE` is set, in any environment. A fresh
 * fork works on first deploy; set a code before sharing a public URL.
 */
export function gateActive(): boolean {
  return accessConfigured() && !publicMode();
}

/**
 * The public upload cap in bytes, or null when public mode is off.
 *
 * Never above the platform limit, and ignored when the value is not a positive
 * number — a typo should not silently remove the cap or block every upload.
 */
export function publicMaxBytes(): number | null {
  const raw = process.env.PUBLIC_MAX_MB;
  if (!raw) return null;
  const mb = Number(raw);
  if (!Number.isFinite(mb) || mb <= 0) return null;
  return Math.min(Math.round(mb * 1024 * 1024), PLATFORM_MAX_BYTES);
}

/** Whether the demo is open to everyone with a capped upload size. */
export function publicMode(): boolean {
  return publicMaxBytes() !== null;
}

/** The largest upload this visitor may send, given their access cookie. */
export async function uploadLimitFor(
  token: string | undefined | null,
): Promise<number> {
  const cap = publicMaxBytes();
  if (cap === null) return PLATFORM_MAX_BYTES;
  return (await isValidToken(token)) ? PLATFORM_MAX_BYTES : cap;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The cookie value is an HMAC of a fixed payload keyed by the access code, so a
 * stolen cookie never reveals the code and no session store is needed.
 */
async function sign(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(code),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(PAYLOAD),
  );
  return toBase64Url(signature);
}

/** Length-independent comparison, so the check cannot be probed byte by byte. */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  // Comparing lengths first would leak them; fold the difference into the result.
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export async function issueToken(): Promise<string | null> {
  const code = process.env.ACCESS_CODE;
  return code ? sign(code) : null;
}

export async function isValidToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const expected = await issueToken();
  if (!expected) return false;
  return constantTimeEqual(token, expected);
}

export async function isValidCode(input: string): Promise<boolean> {
  const code = process.env.ACCESS_CODE;
  if (!code) return false;
  return constantTimeEqual(input, code);
}
