import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A measured value. Proportional figures, not tabular — equal-width digits make
 * a large standalone number look loose.
 *
 * Deliberately uncoloured: these are counts and proportions, not judgements, and
 * a red "73%" would assert a threshold we have no basis to set.
 */
export function Stat({
  label,
  value,
  unit,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className} title={hint}>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1">
        <span className="text-xl leading-none">{value}</span>
        {unit && <span className="text-xs text-[var(--subtle)]">{unit}</span>}
      </dd>
    </div>
  );
}

/**
 * The number the card leads with. A hero figure rather than a gauge or dial:
 * a gauge spends a lot of pixels and an arbitrary needle position to convey one
 * scalar, and invites the reader to infer a red/green zone that does not exist.
 */
export function HeroScore({
  score,
  outOf = 100,
}: {
  score: number | null;
  outOf?: number;
}) {
  if (score == null) {
    return (
      <div className="text-right">
        <span className="text-sm text-[var(--subtle)]">not scored</span>
      </div>
    );
  }
  return (
    <div className="text-right leading-none">
      <span className="text-[44px] font-medium tracking-tight">{score}</span>
      <span className="ml-1 text-sm text-[var(--subtle)]">/ {outOf}</span>
    </div>
  );
}

/**
 * A single proportion against its whole — the verifier's keep rate.
 *
 * A meter on one track, not a two-slice pie: the reader needs "how much of it
 * held up", which a filled track answers directly.
 */
export function Meter({
  label,
  value,
  total,
  tone = "accent",
}: {
  label: string;
  value: number;
  total: number;
  tone?: "accent" | "caution";
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <span className="tnum text-xs">
          {value}
          <span className="text-[var(--subtle)]"> / {total}</span>
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--chart-track)" }}
        role="img"
        aria-label={`${label}: ${value} of ${total}`}
      >
        <div
          className={cn(
            "h-full rounded-full",
            tone === "caution" ? "bg-[var(--caution)]" : "bg-[var(--met)]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
