"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UnlockForm({ next }: { next: string }) {
  const router = useRouter();
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
        setError(payload.error ?? "That code is not right.");
        return;
      }
      // Full navigation, so middleware re-runs and sees the new cookie.
      router.replace(next);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
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
