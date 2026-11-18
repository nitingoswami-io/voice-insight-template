/**
 * "Email me a link" (docs/DEMO_ACCESS.md): validate, rate-limit, sign a pass,
 * email the magic link, copy the owner.
 *
 * Limits live in memory, so on serverless they are per instance — a speed bump,
 * not a wall. Pair them with a firewall rate limit on `/api/access/request` and a
 * hard budget on every provider account.
 */

import { NextResponse } from "next/server";
import { demoId, issuePass, passDays } from "@/lib/demo-pass";
import { escapeHtml, notifyOwner, sendEmail } from "@/lib/mailer";
import { PROJECT_NAME, REPO_URL, SITE_URL } from "@/lib/site";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

const HOUR = 60 * 60 * 1000;
const PER_IP_PER_HOUR = 5;
const EMAIL_COOLDOWN_MS = 10 * 60 * 1000;

const ipHits = new Map<string, number[]>();
const emailLast = new Map<string, number>();

/** True if this request may send an email; records it either way. */
export function allowRequest(ip: string, email: string, now = Date.now()): boolean {
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < HOUR);
  const last = emailLast.get(email) ?? 0;
  if (hits.length >= PER_IP_PER_HOUR || now - last < EMAIL_COOLDOWN_MS) {
    ipHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  emailLast.set(email, now);
  return true;
}

/** For tests. */
export function resetRequestLimits() {
  ipHits.clear();
  emailLast.clear();
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "?"
  );
}

/** Base of the magic link: `DEMO_PUBLIC_URL`, else the origin this request came to. */
export function publicBase(request: Request): string {
  const configured = process.env.DEMO_PUBLIC_URL?.trim().replace(/\/+$/, "");
  return configured || new URL(request.url).origin;
}

function accessEmail(email: string, link: string, days: number) {
  const text = [
    `Hi,`,
    ``,
    `Here is your link to the live ${PROJECT_NAME} demo. It unlocks the demo on the browser you open it in, for ${days} days:`,
    ``,
    link,
    ``,
    `The demo runs on paid API credit, so please keep recordings short. Want to go further? Run it yourself with your own keys: ${REPO_URL}`,
    ``,
    `— Nitin Goswami, ${SITE_URL}`,
    ``,
    `You received this because ${email} asked for access. Ignore it if that wasn't you.`,
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#141414;max-width:520px">
<p>Hi,</p>
<p>Here is your link to the live <strong>${escapeHtml(PROJECT_NAME)}</strong> demo. It unlocks the demo on the browser you open it in, for ${days} days.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#a4161a;color:#f6f1e7;text-decoration:none;font-family:Arial,sans-serif;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px">Open the demo</a></p>
<p style="color:#4f4a43">The demo runs on paid API credit, so please keep recordings short. Want to go further? <a href="${escapeHtml(REPO_URL)}">Run it yourself</a> with your own keys.</p>
<p>— Nitin Goswami, <a href="${escapeHtml(SITE_URL)}">nitingoswami.io</a></p>
<p style="color:#6f685b;font-size:12px">You received this because ${escapeHtml(email)} asked for access. Ignore it if that wasn't you.</p>
</div>`;
  return { text, html };
}

export async function handleAccessRequest(request: Request): Promise<NextResponse> {
  let body: { email?: unknown; reason?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = normaliseEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const accepted = NextResponse.json({ ok: true }, { status: 202 });

  // Honeypot filled in: look successful, do nothing.
  if (typeof body.website === "string" && body.website.trim()) return accepted;

  if (!process.env.DEMO_ACCESS_SECRET) {
    return NextResponse.json(
      { error: "Email access is not set up on this deployment." },
      { status: 409 },
    );
  }

  if (!allowRequest(clientIp(request), email)) return accepted;

  const days = passDays();
  const pass = (await issuePass(email, { days }))!;
  const link = `${publicBase(request)}/unlock?pass=${encodeURIComponent(pass)}&next=/demo`;
  const outOfCredit = body.reason === "demo_unavailable";

  try {
    await sendEmail({
      to: email,
      subject: `Your link to the ${PROJECT_NAME} demo`,
      ...accessEmail(email, link, days),
    });
  } catch (e) {
    console.error(`[demo-access] could not email ${email}: ${e}`);
    return NextResponse.json(
      { error: "Could not send the email just now. Try again in a minute." },
      { status: 502 },
    );
  }

  await notifyOwner(
    `[${demoId()}] ${outOfCredit ? "OUT OF CREDIT — " : ""}access requested by ${email}`,
    `${email} requested access to ${PROJECT_NAME}.` +
      (outOfCredit
        ? "\n\nThey hit the out-of-credit dialog: a provider account needs topping up."
        : ""),
  );
  return accepted;
}
