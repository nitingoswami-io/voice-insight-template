import { formatDuration } from "@/lib/format";

/**
 * Agent vs customer share of speech.
 *
 * A horizontal stacked bar rather than a pie: two slices is a documented
 * anti-pattern — a pie makes the reader compare angles when the whole point is
 * one proportion, and it reads as decoration. The bar carries the same fact,
 * direct-labels both values so nothing depends on hover, and sits in a row of
 * other bars for free comparison.
 *
 * No "healthy range" marker: what counts as a good talk ratio differs per queue
 * and we have no basis to assert one.
 */
export function TalkShare({
  agentMs,
  customerMs,
}: {
  agentMs: number;
  customerMs: number;
}) {
  const total = agentMs + customerMs;
  if (total === 0) {
    return (
      <p className="text-xs text-[var(--subtle)]">No speech detected.</p>
    );
  }

  const agentPct = (agentMs / total) * 100;
  const customerPct = 100 - agentPct;
  // Below this a segment cannot hold its own label without clipping.
  const LABEL_FITS = 16;

  return (
    <figure className="m-0">
      <div
        className="flex h-9 w-full gap-[2px] overflow-hidden"
        role="img"
        aria-label={`Agent spoke ${Math.round(agentPct)} percent of the time, customer ${Math.round(customerPct)} percent`}
      >
        <div
          className="flex items-center justify-start rounded-l-[4px] pl-2.5"
          style={{ width: `${agentPct}%`, background: "var(--series-agent)" }}
          title={`Agent — ${formatDuration(agentMs)}`}
        >
          {agentPct >= LABEL_FITS && (
            <span className="text-xs font-medium text-white">
              {Math.round(agentPct)}%
            </span>
          )}
        </div>
        <div
          className="flex items-center justify-end rounded-r-[4px] pr-2.5"
          style={{
            width: `${customerPct}%`,
            background: "var(--series-customer)",
          }}
          title={`Customer — ${formatDuration(customerMs)}`}
        >
          {customerPct >= LABEL_FITS && (
            <span className="text-xs font-medium text-white">
              {Math.round(customerPct)}%
            </span>
          )}
        </div>
      </div>

      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        <LegendItem color="var(--series-agent)" label="Agent" value={formatDuration(agentMs)} />
        <LegendItem
          color="var(--series-customer)"
          label="Customer"
          value={formatDuration(customerMs)}
        />
      </figcaption>
    </figure>
  );
}

export function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-[2px]"
        style={{ background: color }}
      />
      <span className="text-[var(--muted)]">{label}</span>
      {value && <span className="tnum text-[var(--foreground)]">{value}</span>}
    </span>
  );
}
