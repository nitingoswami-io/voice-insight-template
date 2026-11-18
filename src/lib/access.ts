/**
 * Optional access gate for the routes that call metered APIs.
 *
 * `/api/transcribe` and `/api/insight` spend credit on your AssemblyAI and xAI
 * accounts; `/api/interpreter/*` spends OpenAI and ElevenLabs credit. Run locally,
 * that is fine. Deploy a fork to a public URL and anyone who finds it can spend
 * your credit.
 *
 * The gate follows docs/DEMO_ACCESS.md: the access cookie holds a signed demo
 * pass (see demo-pass.ts). Visitors get one by requesting a link by email
 * (`DEMO_ACCESS_SECRET`), or by typing a shared `ACCESS_CODE`. Leaving both
 * unset keeps everything open.
 *
 * The landing page stays public either way — the gate covers only the routes
 * that cost something.
 *
 * Public mode (`PUBLIC_MAX_MB`) is the middle ground for a hosted demo: the
 * routes are open to everyone, but uploads are capped at that size. A valid
 * pass lifts the cap back to the platform limit.
 */

import { PLATFORM_MAX_BYTES } from "@/lib/limits";
import {
  constantTimeEqual,
  issuePass,
  passDays,
  passSecret,
  verifyPass,
  type VerifiedPass,
} from "@/lib/demo-pass";

export { constantTimeEqual };

export const ACCESS_COOKIE = "voice_insight_access";

/** Cookie lifetime matches the pass: `DEMO_PASS_DAYS`, seven by default. */
export function accessMaxAge(): number {
  return Math.round(passDays() * 60 * 60 * 24);
}

/**
 * API routes the gate protects when it is on: exactly the ones that spend
 * credit. The pages themselves stay public (docs/DEMO_ACCESS.md, rule 1), so a
 * visitor can look around, view the sample output and then ask for a link.
 */
export const PROTECTED_PREFIXES = [
  "/api/transcribe",
  "/api/status",
  "/api/insight",
  "/api/interpreter",
];

/** Pages the unlock flow may send someone back to. */
export const DEMO_PAGES = ["/demo", "/interpreter"];

function underPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isProtectedPath(pathname: string): boolean {
  return underPrefix(pathname, PROTECTED_PREFIXES);
}

/** Whether a shared access code is configured (the "Have an access code?" form). */
export function accessConfigured(): boolean {
  return Boolean(process.env.ACCESS_CODE);
}

/** Whether passes can be signed at all: `DEMO_ACCESS_SECRET` or `ACCESS_CODE`. */
export function gateConfigured(): boolean {
  return passSecret() !== null;
}

/** Whether visitors can request a link by email. */
export function emailAccessConfigured(): boolean {
  return Boolean(process.env.DEMO_ACCESS_SECRET);
}

/**
 * Where the unlock form may send someone afterwards.
 *
 * The `next` parameter is attacker-controlled — it arrives in a URL anyone can
 * craft and share. Without this, `?next=https://evil.example` would turn the
 * unlock page into an open redirect wearing our domain, which is exactly the
 * shape a credible phishing link needs. Only same-origin demo pages are allowed
 * through; anything else falls back to the demo.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/demo";
  // Reject protocol-relative ("//evil.example") and absolute URLs alike.
  if (!next.startsWith("/") || next.startsWith("//")) return "/demo";
  if (next.includes("\\") || next.includes("\n") || next.includes("\r")) {
    return "/demo";
  }
  const path = next.split("?")[0];
  return underPrefix(path, DEMO_PAGES) ? next : "/demo";
}

/**
 * Whether the gate is on.
 *
 * Opt-in: on when `DEMO_ACCESS_SECRET` or `ACCESS_CODE` is set, in any
 * environment, unless public mode is on. A fresh fork works on first deploy.
 */
export function gateActive(): boolean {
  return gateConfigured() && !publicMode();
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

/** The pass behind an access cookie, or null. */
export async function readAccess(
  token: string | undefined | null,
): Promise<VerifiedPass | null> {
  return verifyPass(token);
}

/** A pass for someone who typed the shared access code. */
export async function issueToken(): Promise<string | null> {
  return issuePass("access-code");
}

export async function isValidToken(
  token: string | undefined | null,
): Promise<boolean> {
  return (await verifyPass(token)) !== null;
}

export async function isValidCode(input: string): Promise<boolean> {
  const code = process.env.ACCESS_CODE;
  if (!code) return false;
  return constantTimeEqual(input, code);
}
