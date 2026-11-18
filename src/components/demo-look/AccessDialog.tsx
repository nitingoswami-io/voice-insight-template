"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { extractPass, type AccessReason } from "./pass";

export type AccessRequest = { email: string; reason: AccessReason; website: string };

const COPY: Record<AccessReason, { kicker: string; title: string; body: (name: string, providers: string) => string }> = {
  access_required: {
    kicker: "Request access",
    title: "Get a link to the live demo",
    body: (name, providers) =>
      `${name} runs on paid ${providers} credit, so the live version needs a free access link. Leave your email and the link arrives in a minute.`,
  },
  demo_unavailable: {
    kicker: "Demo paused",
    title: "The live demo is out of API credit",
    body: (name, providers) =>
      `${name} has used up its ${providers} credit for now, and I've been told. Leave your email and you'll get an access link. It starts working as soon as the credit is topped up.`,
  },
};

/**
 * The one access dialog every demo shows: for a missing pass and for a provider
 * that has run out of credit (docs/DEMO_ACCESS.md).
 *
 * Transport is the demo's business: `onRequest` posts the email, `onPass` stores a
 * pasted link (localStorage + header, or a cookie set by the server).
 */
export function AccessDialog({
  open,
  reason = "access_required",
  demoName,
  providers,
  repoUrl,
  passDays = 7,
  onClose,
  onRequest,
  onPass,
}: {
  open: boolean;
  reason?: AccessReason;
  demoName: string;
  /** Who bills for this demo, e.g. "OpenAI" or "AssemblyAI and xAI". */
  providers: string;
  repoUrl: string;
  passDays?: number;
  onClose: () => void;
  onRequest: (req: AccessRequest) => Promise<void>;
  /** Return false if the pasted link was not a usable pass. */
  onPass?: (token: string) => boolean | Promise<boolean>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    try {
      await onRequest({ email: email.trim(), reason, website });
      setStatus("sent");
    } catch (err) {
      setError((err as Error).message || "Could not send the link. Try again in a minute.");
      setStatus("idle");
    }
  }

  async function usePasted(e: FormEvent) {
    e.preventDefault();
    const token = extractPass(pasted);
    if (!token || !onPass || !(await onPass(token))) {
      setPasteError("That doesn't look like a valid access link. Copy the whole link from the email.");
      return;
    }
    setPasteError(null);
    onClose();
  }

  const copy = COPY[reason];

  return (
    <dialog ref={ref} className="dl-dialog" onClose={onClose} aria-labelledby="dl-access-title">
      <div className="dl-dialog__head">
        <span className="dl-label dl-dialog__kicker">{copy.kicker}</span>
        <button type="button" className="dl-dialog__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <h2 id="dl-access-title" className="dl-dialog__title">
        {status === "sent" ? "Check your inbox" : copy.title}
      </h2>

      {status === "sent" ? (
        <p className="dl-dialog__body">
          The link is on its way to <strong>{email}</strong>. Open it on this device and the demo unlocks for{" "}
          {passDays} days. Nothing after a few minutes? Check your spam folder, or try again in ten minutes.
        </p>
      ) : (
        <>
          <p className="dl-dialog__body">{copy.body(demoName, providers)}</p>
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
            <button type="submit" className="dl-btn dl-btn--primary" disabled={status === "sending" || !email.trim()}>
              {status === "sending" ? "Sending…" : "Email me a link"}
            </button>
          </form>
          <p className="dl-dialog__fine">
            I use your email only to send the link and to see who tries the demos. No newsletter.
          </p>
        </>
      )}

      {onPass && (
        <details className="dl-dialog__paste">
          <summary>Opened the email on another device? Paste the link</summary>
          <form onSubmit={usePasted} className="dl-dialog__form">
            <input
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="https://…?pass=v1…"
              className="dl-input"
              autoComplete="off"
            />
            {pasteError && <p className="dl-dialog__error">{pasteError}</p>}
            <button type="submit" className="dl-btn" disabled={!pasted.trim()}>
              Use this link
            </button>
          </form>
        </details>
      )}

      <p className="dl-dialog__fine">
        Rather use your own key? <a href={repoUrl}>Clone the repo and run it yourself</a>.
      </p>
    </dialog>
  );
}
