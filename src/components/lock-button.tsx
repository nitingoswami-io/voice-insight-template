"use client";

import { useState } from "react";

/**
 * Give the demo back its lock.
 *
 * The access cookie is httpOnly and lasts a week, so without this the only way
 * to re-lock a machine is to go digging in browser settings — awkward on a
 * shared machine, or when you simply want to check the gate still works.
 */
export function LockButton() {
  const [busy, setBusy] = useState(false);

  async function lock() {
    setBusy(true);
    // Swallowed deliberately: we leave either way, and a bare try/finally would
    // let the rejection escape as an unhandled promise error in the console.
    // Worst case the cookie survives until it expires, and the user is off the
    // protected page regardless.
    await fetch("/api/access", { method: "DELETE" }).catch(() => {});
    // Hard navigation so the proxy re-runs without the cookie, rather than a
    // soft one that would resolve from the client router cache.
    window.location.assign("/");
  }

  return (
    <button
      type="button"
      onClick={lock}
      disabled={busy}
      title="Sign out of the demo on this browser"
      className="rounded border border-[var(--border-strong)] px-2.5 py-1 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-40"
    >
      {busy ? "Locking…" : "Lock demo"}
    </button>
  );
}
