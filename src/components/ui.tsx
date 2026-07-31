import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
    <section
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-3.5">
          <div>
            {title && (
              <h2 className="text-sm font-medium tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
            )}
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
