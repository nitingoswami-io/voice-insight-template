/**
 * Demo access pass v1 (docs/DEMO_ACCESS.md).
 *
 *   v1.<payload>.<signature>
 *   payload   = base64url(JSON {sub, aud, iat, exp})
 *   signature = base64url(HMAC-SHA256(secret, "v1." + payload))
 *
 * Stateless: no session store. Rotating the secret revokes every pass.
 * Web Crypto rather than `node:crypto`, so the proxy and route handlers share it.
 */

export const DEFAULT_DEMO_ID = "voice-insight";

export type VerifiedPass = { email: string; aud: string; exp: number };

/** `DEMO_ACCESS_SECRET`, or `ACCESS_CODE` so a code-only deployment still signs passes. */
export function passSecret(): string | null {
  return process.env.DEMO_ACCESS_SECRET || process.env.ACCESS_CODE || null;
}

export function demoId(): string {
  return process.env.DEMO_ID || DEFAULT_DEMO_ID;
}

export function passDays(): number {
  const days = Number(process.env.DEMO_PASS_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 7;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  return atob(text.replace(/-/g, "+").replace(/_/g, "/"));
}

async function hmac(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

/** Length-independent comparison, so the check cannot be probed byte by byte. */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

/** Sign a pass. Returns null when no secret is configured (the gate is off). */
export async function issuePass(
  email: string,
  opts: { aud?: string; days?: number; now?: number } = {},
): Promise<string | null> {
  const secret = passSecret();
  if (!secret) return null;
  const iat = Math.floor((opts.now ?? Date.now()) / 1000);
  const exp = iat + Math.round((opts.days ?? passDays()) * 86400);
  const json = JSON.stringify({ sub: email, aud: opts.aud ?? demoId(), iat, exp });
  const payload = toBase64Url(new TextEncoder().encode(json));
  return `v1.${payload}.${await hmac(secret, `v1.${payload}`)}`;
}

/** Check signature, expiry and audience. Null for anything that is not a live pass for `aud`. */
export async function verifyPass(
  token: string | null | undefined,
  aud: string = demoId(),
  now: number = Date.now(),
): Promise<VerifiedPass | null> {
  const secret = passSecret();
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, payload, signature] = parts;
  if (!constantTimeEqual(signature, await hmac(secret, `v1.${payload}`))) return null;
  try {
    const bytes = Uint8Array.from(fromBase64Url(payload), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as {
      sub?: unknown;
      aud?: unknown;
      exp?: unknown;
    };
    if (typeof data.sub !== "string" || typeof data.exp !== "number") return null;
    if (data.exp * 1000 <= now) return null;
    if (data.aud !== aud && data.aud !== "*") return null;
    return { email: data.sub, aud: String(data.aud), exp: data.exp };
  } catch {
    return null;
  }
}
