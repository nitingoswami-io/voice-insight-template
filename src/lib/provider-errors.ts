/**
 * Turn provider failures into the error contract in docs/DEMO_ACCESS.md.
 *
 * When a provider account is out of credit, or its key is invalid or revoked,
 * a visitor must never see the raw provider text ("429 You exceeded your
 * current quota..."). They get `503 {code: "demo_unavailable"}`, which opens
 * the access dialog, and the owner gets an email (at most once an hour).
 */

import { NextResponse } from "next/server";
import { notifyOwner } from "@/lib/mailer";
import { demoId } from "@/lib/demo-pass";

const CREDIT_WORDS =
  /insufficient[_ ]quota|exceeded your current quota|quota[_ ]exceeded|out of credits?|no credits?|credits? (?:remaining|exhausted|balance)|insufficient (?:balance|funds|credits?)|account balance|billing|payment required|quota_exceeded|spending limit|invalid[_ ]api[_ ]key|incorrect api key|api key (?:is )?(?:invalid|revoked|disabled)|unauthorized/i;

/** Pull an HTTP status out of an SDK error or one of our "failed: 402 ..." messages. */
function statusOf(error: unknown): number | null {
  if (error && typeof error === "object" && "status" in error) {
    const s = (error as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  const m = message.match(/(?:failed[: (]+|\()\s*(\d{3})\b/);
  return m ? Number(m[1]) : null;
}

/** True when the failure means "the demo's account cannot pay", not "this request was bad". */
export function isProviderUnavailable(error: unknown): boolean {
  const status = statusOf(error);
  if (status === 401 || status === 402) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  if (CREDIT_WORDS.test(code)) return true;
  // A plain 429 is a rate limit and passes; a 429 that talks about quota or credit does not.
  return CREDIT_WORDS.test(message);
}

export const UNAVAILABLE_MESSAGE =
  "The live demo is out of API credit right now. Request an access link and it will work as soon as it is topped up.";

let lastAlert = 0;
const ALERT_EVERY_MS = 60 * 60 * 1000;

/** Email the owner that a provider stopped paying, at most once an hour per instance. */
export async function alertOwner(provider: string, error: unknown, now = Date.now()) {
  if (now - lastAlert < ALERT_EVERY_MS) return;
  lastAlert = now;
  const detail = error instanceof Error ? error.message : String(error);
  await notifyOwner(
    `[${demoId()}] OUT OF CREDIT: ${provider}`,
    `${provider} refused a request from the live demo, so visitors now see the "demo paused" dialog.\n\n` +
      `Provider said: ${detail.slice(0, 500)}\n\nTop up the account or rotate the key.`,
  );
}

/** For tests: forget the last alert time. */
export function resetAlertThrottle() {
  lastAlert = 0;
}

/**
 * The catch-block response for a metered route: `demo_unavailable` for a
 * credit or key failure (plus the owner alert), otherwise a 500 with the message.
 */
export async function providerErrorResponse(
  error: unknown,
  provider: string,
  fallback: string,
): Promise<NextResponse> {
  if (isProviderUnavailable(error)) {
    console.error(`[demo-access] ${provider} unavailable:`, error);
    await alertOwner(provider, error);
    return NextResponse.json(
      { error: UNAVAILABLE_MESSAGE, code: "demo_unavailable" },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}
