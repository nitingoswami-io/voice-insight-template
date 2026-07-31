import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configuredChannel,
  contactSchema,
  deliverContact,
  fieldErrors,
  parseSender,
} from "@/lib/contact";

const VALID = {
  name: "Priya Sharma",
  email: "priya@example.com",
  phone: "+91 98765 43210",
  company: "",
  message: "",
  website: "",
};

const ENV_KEYS = [
  "CONTACT_WEBHOOK_URL",
  "BREVO_API_KEY",
  "RESEND_API_KEY",
  "CONTACT_TO_EMAIL",
  "CONTACT_FROM_EMAIL",
];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("contactSchema", () => {
  it("accepts a well-formed enquiry", () => {
    expect(contactSchema.safeParse(VALID).success).toBe(true);
  });

  it("accepts the separators real people actually type", () => {
    for (const phone of [
      "+91 98765 43210",
      "(020) 7946 0958",
      "+1-415-555-0132",
      "9876543210",
    ]) {
      expect(contactSchema.safeParse({ ...VALID, phone }).success).toBe(true);
    }
  });

  it("rejects a phone number that cannot be one", () => {
    for (const phone of ["12345", "not a phone", "1234567890123456789"]) {
      const r = contactSchema.safeParse({ ...VALID, phone });
      expect(r.success).toBe(false);
    }
  });

  it("rejects a malformed email and says which field", () => {
    const r = contactSchema.safeParse({ ...VALID, email: "priya@" });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(fieldErrors(r.error).email).toBeTruthy();
  });

  it("requires a name long enough to be one", () => {
    expect(contactSchema.safeParse({ ...VALID, name: "P" }).success).toBe(false);
  });

  it("normalises email case, so duplicates do not slip through", () => {
    const r = contactSchema.safeParse({ ...VALID, email: "Priya@Example.COM" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.email).toBe("priya@example.com");
  });

  it("treats a filled honeypot as invalid", () => {
    expect(
      contactSchema.safeParse({ ...VALID, website: "http://spam.example" })
        .success,
    ).toBe(false);
  });
});

describe("configuredChannel", () => {
  it("reports nothing configured by default", () => {
    expect(configuredChannel()).toBeNull();
  });

  it("prefers a webhook when several are set", () => {
    process.env.CONTACT_WEBHOOK_URL = "https://hooks.example/abc";
    process.env.BREVO_API_KEY = "xkeysib_x";
    process.env.RESEND_API_KEY = "re_x";
    process.env.CONTACT_TO_EMAIL = "sales@example.com";
    expect(configuredChannel()).toBe("webhook");
  });

  it("picks Brevo ahead of Resend when both are set", () => {
    process.env.BREVO_API_KEY = "xkeysib_x";
    process.env.RESEND_API_KEY = "re_x";
    process.env.CONTACT_TO_EMAIL = "sales@example.com";
    expect(configuredChannel()).toBe("brevo");
  });

  it("does not count a half-configured email channel", () => {
    process.env.BREVO_API_KEY = "xkeysib_x"; // no CONTACT_TO_EMAIL
    expect(configuredChannel()).toBeNull();
  });
});

describe("deliverContact", () => {
  const at = "2026-07-30T12:00:00.000Z";

  it("refuses rather than pretending, when nothing is configured", async () => {
    // The point of the whole module: a real person's phone number must never be
    // accepted by a form that has nowhere to send it.
    await expect(deliverContact(VALID, at)).rejects.toThrow(
      /no contact delivery channel is configured/i,
    );
  });

  it("posts to the webhook with both prose and structured fields", async () => {
    process.env.CONTACT_WEBHOOK_URL = "https://hooks.example/abc";
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response("ok", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(deliverContact(VALID, at)).resolves.toBe("webhook");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example/abc");
    const body = JSON.parse(init.body as string);
    expect(body.text).toContain("Priya Sharma");
    expect(body.phone).toBe("+91 98765 43210");
    expect(body.receivedAt).toBe(at);
  });

  it("surfaces a webhook failure instead of swallowing it", async () => {
    process.env.CONTACT_WEBHOOK_URL = "https://hooks.example/abc";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("gone", { status: 410 })),
    );
    await expect(deliverContact(VALID, at)).rejects.toThrow(/410/);
  });

  it("sends via Brevo with the enquirer as reply-to", async () => {
    process.env.BREVO_API_KEY = "xkeysib_x";
    process.env.CONTACT_TO_EMAIL = "sales@example.com";
    process.env.CONTACT_FROM_EMAIL = "Lisn10 <no-reply@lisn10.com>";
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ messageId: "m1" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(deliverContact(VALID, at)).resolves.toBe("brevo");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("xkeysib_x");
    const body = JSON.parse(init.body as string);
    expect(body.sender).toEqual({ email: "no-reply@lisn10.com", name: "Lisn10" });
    expect(body.to).toEqual([{ email: "sales@example.com" }]);
    // Replying to the notification should reach the prospect, not the robot.
    expect(body.replyTo).toEqual({ email: "priya@example.com", name: "Priya Sharma" });
    expect(body.textContent).toContain("+91 98765 43210");
  });

  it("surfaces a Brevo failure instead of swallowing it", async () => {
    process.env.BREVO_API_KEY = "xkeysib_x";
    process.env.CONTACT_TO_EMAIL = "sales@example.com";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unverified sender", { status: 400 })),
    );
    await expect(deliverContact(VALID, at)).rejects.toThrow(/Brevo responded 400/);
  });

  it("sends email via Resend with the enquirer as reply-to", async () => {
    process.env.RESEND_API_KEY = "re_x";
    process.env.CONTACT_TO_EMAIL = "sales@example.com";
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ id: "e1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(deliverContact(VALID, at)).resolves.toBe("resend");

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(["sales@example.com"]);
    // Replying to the notification should reach the prospect, not the robot.
    expect(body.reply_to).toBe("priya@example.com");
  });
});

describe("parseSender", () => {
  it("splits the familiar display-name form Brevo needs apart", () => {
    expect(parseSender("Lisn10 <sales@acme.com>")).toEqual({
      email: "sales@acme.com",
      name: "Lisn10",
    });
  });

  it("accepts a bare address", () => {
    expect(parseSender("  sales@acme.com ")).toEqual({ email: "sales@acme.com" });
  });

  it("omits an empty display name rather than sending a blank one", () => {
    expect(parseSender("<sales@acme.com>")).toEqual({ email: "sales@acme.com" });
  });
});
