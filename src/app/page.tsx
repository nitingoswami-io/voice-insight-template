import Link from "next/link";
import {
  BuildYourOwn,
  Concepts,
  Hero,
  Pipeline,
  Verification,
} from "@/components/landing/sections";

export default function Home() {
  return (
    <>
      <div className="border-b border-[var(--rule-soft)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[var(--ink-2)]">
            <span className="font-medium text-[var(--ink)]">New demo:</span>{" "}
            Hindi / French ↔ English live voice interpreter — Whisper → GPT-4o-mini →
            ElevenLabs.
          </p>
          <Link
            href="/interpreter"
            className="font-mono text-xs uppercase tracking-widest text-[var(--news-red)] hover:underline"
          >
            Try it →
          </Link>
        </div>
      </div>
      <Hero />
      <Pipeline />
      <Concepts />
      <Verification />
      <BuildYourOwn />
    </>
  );
}
