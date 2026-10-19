"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PROJECT_NAME, REPO_URL } from "@/lib/site";

/** Five bars suggesting a waveform. Decorative — the wordmark carries the name. */
function Wordmark() {
  const bars = [8, 15, 22, 13, 6];
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="flex h-6 items-center gap-[2px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[2.5px] rounded-full"
            style={{
              height: h,
              background:
                i % 2 === 0 ? "var(--series-agent)" : "var(--series-customer)",
            }}
          />
        ))}
      </span>
      <span className="text-[17px] font-semibold tracking-tight">
        {PROJECT_NAME}
      </span>
      <span className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)]">
        template
      </span>
    </span>
  );
}

const LINKS = [
  { href: "/#pipeline", label: "Pipeline" },
  { href: "/#concepts", label: "Concepts" },
  { href: "/#verification", label: "Verification" },
  { href: "/#build", label: "Build your own" },
];

export function SiteNav() {
  const pathname = usePathname();
  const onDemo = pathname === "/demo";

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/" aria-label={`${PROJECT_NAME} home`}>
          <Wordmark />
        </Link>

        <nav className="ml-4 hidden gap-6 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <a
          href={REPO_URL}
          className="ml-auto text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          GitHub
        </a>

        <Link
          href="/demo"
          className={cn(
            "rounded-md px-3.5 py-1.5 text-sm transition-opacity",
            onDemo
              ? "border border-[var(--border-strong)] text-[var(--muted)]"
              : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90",
          )}
        >
          {onDemo ? "Demo" : "Run the demo"}
        </Link>
      </div>
    </header>
  );
}
