/**
 * Email for the demo access flow (docs/DEMO_ACCESS.md), via Resend's REST API.
 *
 * No SDK: one POST is the whole integration. Without `RESEND_API_KEY` nothing
 * is sent and the message is logged instead, so the flow works locally.
 */

export type Email = { to: string; subject: string; text: string; html?: string };

const DEFAULT_FROM = "Demo desk <onboarding@resend.dev>";

export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      `[demo-access] RESEND_API_KEY is not set, so this email was not sent.\n` +
        `  to: ${email.to}\n  subject: ${email.subject}\n${email.text}`,
    );
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ACCESS_EMAIL_FROM || DEFAULT_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

/** Send to the owner, if `ACCESS_NOTIFY_EMAIL` is set. Never throws. */
export async function notifyOwner(subject: string, text: string): Promise<void> {
  const to = process.env.ACCESS_NOTIFY_EMAIL;
  if (!to) return;
  await sendEmail({ to, subject, text }).catch((e) =>
    console.error(`[demo-access] owner notification failed: ${e}`),
  );
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
