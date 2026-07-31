import { z } from "zod";

/**
 * Contact submissions.
 *
 * The delivery step is deliberately allowed to fail loudly. A form that accepts
 * a real person's name and phone number, says "thanks, we'll be in touch", and
 * drops the submission on the floor is a lie told to a prospect — and the whole
 * premise of this product is not showing people things it cannot support. If no
 * channel is configured, the route returns an error and the form says so.
 */

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please give your name").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("That email does not look right")).pipe(z.string().max(200)),
  phone: z
    .string()
    .trim()
    .min(1, "Please give a phone number")
    .max(40)
    .refine(
      (v) => {
        // Permissive on formatting, strict on substance: E.164 allows 7–15
        // digits, and a BPO's prospects will type every separator imaginable.
        const digits = v.replace(/\D/g, "");
        return digits.length >= 7 && digits.length <= 15;
      },
      { message: "Include the country code, e.g. +91 98765 43210" },
    ),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Honeypot. Real people never see this field, so a value means a bot. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ContactInput = z.infer<typeof contactSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!(path in out)) out[path] = issue.message;
  }
  return out;
}

export type DeliveryChannel = "webhook" | "brevo" | "resend" | null;

/** Which channel is configured, if any. First match wins. */
export function configuredChannel(): DeliveryChannel {
  if (process.env.CONTACT_WEBHOOK_URL) return "webhook";
  if (process.env.BREVO_API_KEY && process.env.CONTACT_TO_EMAIL) return "brevo";
  if (process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL) return "resend";
  return null;
}

/**
 * Split `"Lisn10 <sales@acme.com>"` into its parts.
 *
 * Brevo wants the display name and address as separate fields, while Resend
 * takes the combined form — so the config stays in one familiar format and each
 * provider gets the shape it expects.
 */
export function parseSender(value: string): { email: string; name?: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const [, name, email] = match;
    return name ? { email, name } : { email };
  }
  return { email: value.trim() };
}

function asText(input: ContactInput, receivedAt: string): string {
  return [
    `New Lisn10 enquiry`,
    ``,
    `Name:    ${input.name}`,
    `Email:   ${input.email}`,
    `Phone:   ${input.phone}`,
    input.company ? `Company: ${input.company}` : null,
    input.message ? `\n${input.message}` : null,
    ``,
    `Received ${receivedAt}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/**
 * Hand the submission to whichever channel is configured.
 *
 * Throws when none is, or when delivery fails — the caller must surface that
 * rather than report success.
 */
export async function deliverContact(
  input: ContactInput,
  receivedAt: string,
): Promise<DeliveryChannel> {
  const channel = configuredChannel();

  if (channel === "webhook") {
    const res = await fetch(process.env.CONTACT_WEBHOOK_URL!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // `text` suits Slack incoming webhooks; the structured fields suit
      // Zapier, Make, and Apps Script. Sending both keeps the target open.
      body: JSON.stringify({
        text: asText(input, receivedAt),
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company || null,
        message: input.message || null,
        receivedAt,
        source: "lisn10-contact-form",
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Contact webhook responded ${res.status}: ${await res.text()}`,
      );
    }
    return "webhook";
  }

  if (channel === "brevo") {
    const sender = parseSender(
      process.env.CONTACT_FROM_EMAIL ?? "Lisn10 <no-reply@lisn10.com>",
    );
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY!,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: process.env.CONTACT_TO_EMAIL }],
        // Replying to the notification should reach the prospect, not us.
        replyTo: { email: input.email, name: input.name },
        subject: `Lisn10 enquiry — ${input.name}${input.company ? ` (${input.company})` : ""}`,
        textContent: asText(input, receivedAt),
      }),
    });
    if (!res.ok) {
      throw new Error(`Brevo responded ${res.status}: ${await res.text()}`);
    }
    return "brevo";
  }

  if (channel === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM_EMAIL ?? "Lisn10 <onboarding@resend.dev>",
        to: [process.env.CONTACT_TO_EMAIL],
        reply_to: input.email,
        subject: `Lisn10 enquiry — ${input.name}${input.company ? ` (${input.company})` : ""}`,
        text: asText(input, receivedAt),
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
    }
    return "resend";
  }

  throw new Error(
    "No contact delivery channel is configured. Set CONTACT_WEBHOOK_URL, or " +
      "BREVO_API_KEY (or RESEND_API_KEY) together with CONTACT_TO_EMAIL. " +
      "See .env.example.",
  );
}
