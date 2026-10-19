import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { PROJECT_NAME, REPO_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${PROJECT_NAME} — an open-source voice-to-insight pipeline`,
  description:
    "An MIT-licensed reference pipeline: speech-to-text, LLM analysis and quote verification, using call-centre quality review as the worked example.",
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
            <span>{PROJECT_NAME}</span>
            <span className="text-[var(--subtle)]">
              MIT-licensed learning template — not for production use
            </span>
            <span className="ml-auto flex gap-5">
              <Link href="/demo" className="hover:text-[var(--foreground)]">
                Demo
              </Link>
              <a href={REPO_URL} className="hover:text-[var(--foreground)]">
                Source
              </a>
              <a
                href={`${REPO_URL}/blob/main/LICENSE`}
                className="hover:text-[var(--foreground)]"
              >
                License
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
