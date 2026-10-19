import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A ruled panel in the shared demo-look style (thick top rule, hairline sides,
 * small-caps title). Same API as before, so callers did not change.
 */
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("dl-panel", className)}>
      {(title || action) && (
        <header className="dl-panel__head">
          <div>
            {title && <h2 className="dl-panel__title">{title}</h2>}
            {description && <p className="dl-panel__desc">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "caution" | "accent" | "met" | "notMet";
  title?: string;
}) {
  const tones = {
    neutral: "border-[var(--border)] text-[var(--muted)]",
    caution: "border-transparent bg-[var(--caution-soft)] text-[var(--caution)]",
    accent: "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]",
    met: "border-transparent bg-[var(--met-soft)] text-[var(--met)]",
    notMet: "border-transparent bg-[var(--not-met-soft)] text-[var(--not-met)]",
  };
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-none",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
