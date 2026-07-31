export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const total = Math.floor(ms / 1000);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Display name for a detected language code.
 *
 * Falls back to the raw code rather than inventing a name — showing "Unknown"
 * or guessing would be a small lie in a product whose premise is that it does
 * not tell you things it cannot support.
 */
export function languageName(code: string | null): string {
  if (!code) return "—";
  try {
    const display = new Intl.DisplayNames(undefined, { type: "language" });
    return display.of(code) ?? code;
  } catch {
    return code;
  }
}
