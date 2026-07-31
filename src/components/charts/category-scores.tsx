"use client";

import { useMemo } from "react";
import type { CategoryScore, Point } from "@/lib/analysis/types";
import { categoryLabel } from "@/lib/quality-guide";
import { cn } from "@/lib/utils";

/**
 * Per-category scores as sorted horizontal bars.
 *
 * A bar chart rather than a radar: radar encodes value as radius while the eye
 * reads area, so it exaggerates highs and flatters lows, and the silhouette
 * changes meaning if the axis order changes. Sorted bars put the weakest
 * category at the bottom where a coach will find it first.
 *
 * One hue for every bar, not a value ramp — colouring darker-where-bigger would
 * double-encode length as lightness and spend the only free channel on
 * information the bar already carries.
 *
 * Categories the call gave no chance to judge are listed separately rather than
 * drawn as an empty bar, because a zero-length bar reads as a zero score.
 */
export function CategoryScores({
  categories,
  points,
  onSelectCategory,
  selectedCategory,
}: {
  categories: CategoryScore[];
  /** Strengths and coaching combined, so a bar can offer its own evidence. */
  points: Point[];
  onSelectCategory?: (key: string | null) => void;
  selectedCategory?: string | null;
}) {
  const { scored, notObserved } = useMemo(() => {
    const scored = categories
      .filter((c): c is CategoryScore & { score: number } => c.score != null)
      .sort((a, b) => b.score - a.score);
    const notObserved = categories.filter((c) => c.score == null);
    return { scored, notObserved };
  }, [categories]);

  const evidenceCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of points) {
      if (!p.category) continue;
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return counts;
  }, [points]);

  if (scored.length === 0 && notObserved.length === 0) return null;

  return (
    <div className="space-y-4">
      {scored.length > 0 && (
        <ul className="space-y-2.5">
          {scored.map((c) => {
            const n = evidenceCount.get(c.key) ?? 0;
            const selected = selectedCategory === c.key;
            const clickable = n > 0 && !!onSelectCategory;
            return (
              <li key={c.key}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() =>
                    onSelectCategory?.(selected ? null : c.key)
                  }
                  title={c.note}
                  className={cn(
                    "block w-full rounded px-1.5 py-1 text-left transition-colors",
                    clickable && "hover:bg-[var(--accent-soft)]",
                    selected && "bg-[var(--accent-soft)]",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xs">
                      {categoryLabel(c.key)}
                      {n > 0 && (
                        <span className="ml-1.5 text-[var(--subtle)]">
                          {n} quote{n === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                    <span className="tnum shrink-0 text-xs">{c.score}</span>
                  </span>
                  <span
                    className="mt-1 block h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--chart-track)" }}
                    role="img"
                    aria-label={`${categoryLabel(c.key)}: ${c.score} out of 100`}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${c.score}%`,
                        background: "var(--series-agent)",
                      }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {notObserved.length > 0 && (
        <div className="border-t border-[var(--border)] pt-3">
          <p className="text-xs text-[var(--muted)]">
            Not observable on this call —{" "}
            <span className="text-[var(--subtle)]">
              excluded rather than scored zero
            </span>
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {notObserved.map((c) => (
              <li
                key={c.key}
                title={c.note}
                className="text-xs text-[var(--subtle)]"
              >
                — {categoryLabel(c.key)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
