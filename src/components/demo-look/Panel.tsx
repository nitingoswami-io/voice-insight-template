import type { ReactNode } from "react";

/**
 * A ruled section of the tool. Number panels only when the reader works
 * through them in order ("1 · Upload", "2 · Insight").
 */
export function Panel({
  n,
  title,
  description,
  action,
  children,
  className,
}: {
  n?: number;
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dl-panel${className ? ` ${className}` : ""}`}>
      {(title || action) && (
        <header className="dl-panel__head">
          <div>
            {title && (
              <h2 className="dl-panel__title">
                {n != null && <span className="dl-panel__num">{n} ·</span>}
                {title}
              </h2>
            )}
            {description && <p className="dl-panel__desc">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
