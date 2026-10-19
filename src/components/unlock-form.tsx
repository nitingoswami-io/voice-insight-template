"use client";

import { useState } from "react";

/** Any shape an error body might arrive in, flattened to something renderable. */
function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const e = (payload as { error?: unknown }).error;
    if (typeof e === "string") return e;
    // Some intermediaries (Vercel's own deployment protection, proxies) return
    // `error` as an object. Rendering that gives React nothing to show, so the
    // form would sit there looking broken with no explanation.
    if (e && typeof e === "object") {
      const m = (e as { message?: unknown }).message;
      if (typeof m === "string") return m;
    }
  }
  return fallback;
}

export function UnlockForm({ next }: { next: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(payload, "That code is not right."));
        setBusy(false);
        return;
      }

      /*
       * A hard navigation, deliberately — not router.replace().
       *
       * A soft navigation resolves from Next's client Router Cache, which
       * already holds the proxy redirect from /demo to here. It would
       * bounce straight back and the form would appear to do nothing, with the
       * new cookie never consulted. A full page load re-runs the proxy against
       * the cookie the browser just stored.
       *
       * `busy` is left set so the button cannot be pressed twice while the
       * browser is on its way.
       */
      window.location.assign(next);
    } catch {
      setError("Could not reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-xs text-[var(--muted)]">Access code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          type="password"
          autoComplete="off"
          autoFocus
          className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--border-strong)]"
        />
      </label>

      {error && (
        <p className="text-xs text-[var(--not-met)]">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy || code.length === 0}
        className="w-full rounded-md bg-[var(--foreground)] px-4 py-2.5 text-sm text-[var(--background)] transition-opacity disabled:opacity-35"
      >
        {busy ? "Checking…" : "Unlock the demo"}
      </button>
    </form>
  );
}
