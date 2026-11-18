"use client";

import { useState, type FormEvent } from "react";

/** The inline "email me a link" form on /unlock: the same request as the access dialog. */
export function RequestLinkForm({ passDays }: { passDays: number }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/access/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), reason: "access_required", website }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof body.error === "string" ? body.error : "Could not send the link.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className="dl-dialog__body" role="status">
        The link is on its way to <strong>{email}</strong>. Open it on this device and the demo
        unlocks for {passDays} days. Nothing after a few minutes? Check your spam folder.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="dl-dialog__form">
      <label className="dl-field">
        <span className="dl-label">Email</span>
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="dl-input"
        />
      </label>
      {/* Honeypot: hidden from people, filled in by naive bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="dl-honeypot"
        aria-hidden
      />
      {error && <p className="dl-dialog__error">{error}</p>}
      <button type="submit" className="dl-btn dl-btn--primary" disabled={busy || !email.trim()}>
        {busy ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
