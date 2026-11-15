import type { Metadata } from "next";
import { InterpreterClient } from "./interpreter-client";

export const metadata: Metadata = {
  title: "Hindi↔English voice interpreter",
  description:
    "A two-way voice interpreter demo — speak Hindi, the other side hears English, and vice versa.",
};

export default function InterpreterPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-[var(--ink-3)]">
          Voice demo
        </p>
        <h1 className="mt-1 font-[var(--dl-display,serif)] text-3xl text-[var(--ink)]">
          Hindi ↔ English voice interpreter
        </h1>
        <p className="mt-3 max-w-[60ch] text-[var(--ink-2)]">
          Imagine calling a US restaurant without speaking English. Hold the
          button on your side, speak, and the other side hears the translation.
          Each hop runs <strong>Whisper → GPT-4o-mini → ElevenLabs</strong> in a
          single request. Latency is deliberately not optimised — the three
          stages are shown so you can see exactly what the pipeline is doing.
        </p>
      </header>

      <InterpreterClient />

      <footer className="mt-10 border-t border-[var(--rule-soft)] pt-4 text-xs text-[var(--ink-3)]">
        Hold-to-talk uses the browser&apos;s microphone. Audio is sent only to
        OpenAI and ElevenLabs; nothing is stored on our server.
      </footer>
    </div>
  );
}
