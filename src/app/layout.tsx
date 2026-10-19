import type { Metadata } from "next";
import { DemoFooter, Masthead, THEME_BOOT_SCRIPT } from "@/components/demo-look";
import { publicMaxBytes } from "@/lib/access";
import { formatMb } from "@/lib/limits";
import { DESIGN_DOC_URL, POST_URL, PROJECT_NAME, REPO_URL, SITE_URL } from "@/lib/site";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: `${PROJECT_NAME} — an open-source voice-to-insight pipeline`,
  description:
    "An MIT-licensed reference pipeline: speech-to-text, LLM analysis and quote verification, using call-centre quality review as the worked example.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cap = publicMaxBytes();

  return (
    <html lang="en" className={`${fontVariables} h-full`} suppressHydrationWarning>
      <head>
        {/* Applies the saved edition before first paint, so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="dl-page flex min-h-full flex-col">
        <Masthead
          name={PROJECT_NAME}
          titleAs="p"
          siteUrl={SITE_URL}
          postUrl={POST_URL}
          dek="An open-source pipeline: speech-to-text, an LLM, and a verifier that checks every quote against the recording."
          stages={[
            { label: "Transcribe" },
            { label: "Measure" },
            { label: "Infer" },
            { label: "Verify" },
          ]}
          links={[
            { href: "/", label: "Overview" },
            { href: "/demo", label: "Run the demo" },
            { href: DESIGN_DOC_URL, label: "Design doc" },
            { href: REPO_URL, label: "Source" },
          ]}
          status={cap !== null ? `Public demo · files up to ${formatMb(cap)}` : undefined}
        />
        <main className="dl-wrap flex-1">{children}</main>
        <DemoFooter name={PROJECT_NAME} repoUrl={REPO_URL} designDocUrl={DESIGN_DOC_URL} />
      </body>
    </html>
  );
}
