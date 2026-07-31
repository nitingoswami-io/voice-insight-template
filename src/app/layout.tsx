import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { CONTACT_ENABLED } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lisn10 — call quality analysis for BPOs",
  description:
    "Every call scored, every claim quoted. Multilingual call quality analysis where each observation carries the audio that proves it.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6">{children}</main>
        <footer className="border-t border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-6 text-xs text-[var(--muted)]">
            <span>Lisn10</span>
            <span className="text-[var(--subtle)]">
              Prototype — not for production use
            </span>
            <span className="ml-auto flex gap-5">
              <Link href="/demo" className="hover:text-[var(--foreground)]">
                Demo
              </Link>
              {CONTACT_ENABLED && (
                <Link href="/contact" className="hover:text-[var(--foreground)]">
                  Contact
                </Link>
              )}
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
