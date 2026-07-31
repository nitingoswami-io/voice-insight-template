"use client";

import { useMemo, useState } from "react";
import { contactSchema, fieldErrors } from "@/lib/contact";
import { cn } from "@/lib/utils";

type Draft = {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  website: string; // honeypot
};

const EMPTY: Draft = {
  name: "",
  email: "",
  phone: "",
  company: "",
  message: "",
  website: "",
};

const inputStyle =
  "w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--border-strong)]";

export function ContactForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validation = useMemo(() => contactSchema.safeParse(draft), [draft]);
  const errors = useMemo(
    () => (validation.success ? {} : fieldErrors(validation.error)),
    [validation],
  );
  const show = attempted;

  function set(field: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setServerError(null);
    if (!validation.success) return;

    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(payload.error ?? "Could not send your enquiry");
        return;
      }
      setSent(true);
      setDraft(EMPTY);
      setAttempted(false);
    } catch {
      setServerError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-lg border border-[var(--met)] bg-[var(--met-soft)] px-6 py-8 text-center"
      >
        <p className="text-sm font-medium text-[var(--met)]">
          Sent — thank you.
        </p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--met)]">
          Your enquiry reached us. Someone will follow up on the number or email
          you gave.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-5 rounded-md border border-[var(--met)] px-3 py-1.5 text-xs text-[var(--met)]"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field
        label="Full name"
        required
        error={show ? errors.name : undefined}
      >
        <input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="name"
          placeholder="Priya Sharma"
          className={cn(inputStyle, show && errors.name && "border-[var(--not-met)]")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Work email"
          required
          error={show ? errors.email : undefined}
        >
          <input
            type="email"
            value={draft.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
            placeholder="priya@company.com"
            className={cn(
              inputStyle,
              show && errors.email && "border-[var(--not-met)]",
            )}
          />
        </Field>

        <Field
          label="Phone"
          required
          error={show ? errors.phone : undefined}
        >
          <input
            type="tel"
            value={draft.phone}
            onChange={(e) => set("phone", e.target.value)}
            autoComplete="tel"
            placeholder="+91 98765 43210"
            className={cn(
              inputStyle,
              show && errors.phone && "border-[var(--not-met)]",
            )}
          />
        </Field>
      </div>

      <Field label="Company" hint="optional">
        <input
          value={draft.company}
          onChange={(e) => set("company", e.target.value)}
          autoComplete="organization"
          className={inputStyle}
        />
      </Field>

      <Field label="What would you like to know?" hint="optional">
        <textarea
          value={draft.message}
          onChange={(e) => set("message", e.target.value)}
          rows={4}
          placeholder="Languages on your floor, call volume, how you run QA today…"
          className={cn(inputStyle, "resize-y leading-relaxed")}
        />
      </Field>

      {/* Honeypot — positioned off-screen rather than display:none, which some
          bots detect. Real people never reach it; a value means automation. */}
      <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={draft.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </label>
      </div>

      {serverError && (
        <p className="rounded-md border border-[var(--not-met)] bg-[var(--not-met-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--not-met)]">
          {serverError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-[var(--foreground)] px-5 py-2.5 text-sm text-[var(--background)] transition-opacity disabled:opacity-40"
        >
          {sending ? "Sending…" : "Send enquiry"}
        </button>
        <p className="text-xs text-[var(--subtle)]">
          We use these details only to reply to you.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2">
        <span className="text-xs text-[var(--muted)]">
          {label}
          {required && <span className="text-[var(--not-met)]"> *</span>}
        </span>
        {hint && <span className="text-xs text-[var(--subtle)]">{hint}</span>}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {error && (
        <span className="mt-1 block text-xs text-[var(--not-met)]">{error}</span>
      )}
    </label>
  );
}
