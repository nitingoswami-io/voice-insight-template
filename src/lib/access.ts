/**
 * Access gate for the paid routes.
 *
 * `/api/transcribe` and `/api/insight` each spend real money at two providers,
 * and a demo link handed to a prospect gets forwarded. Without a gate the URL is
 * an endpoint that will transcribe anything anyone uploads, billed to us.
 *
 * The landing page and contact form stay public deliberately — the gate covers
 * the routes that cost something, not the shop window.
 *
 * Built on Web Crypto rather than `node:crypto` so the same module works in
 * middleware (Edge runtime) and in route handlers (Node).
 */

export const ACCESS_COOKIE = "lisn10_access";

/** Signed payload. Bumping this invalidates every issued cookie at once. */
const PAYLOAD = "lisn10-access-v1";

/** Seven days: long enough for a sales cycle, short enough to expire a leak. */
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 7;

/** Paths the gate protects. Everything else is public. */
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

/**
 * Whether a gate is configured.
 *
 * In production an unset code is treated as "locked", not "open": forgetting to
 * set it on the host must never be the thing that publishes an unmetered
 * endpoint. Locally it stays open so `npm run dev` needs no ceremony.
 */
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

export function gateActive(): boolean {
  return accessConfigured() || process.env.NODE_ENV === "production";
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
