import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { LegendItem } from "@/components/charts/talk-share";
import { REPO_URL } from "@/lib/site";

/**
 * Landing sections.
 *
 * This page is a guided tour of the pipeline, not a pitch. Each section points
 * at the file that implements what it describes, so a reader can go from the
 * idea to the code in one click. Every number on it comes from real runs.
 */

function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-[var(--border)] py-16">
      {eyebrow && (
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--series-agent)]">
          {eyebrow}
        </p>
      )}
      <h2 className="max-w-3xl text-2xl font-medium tracking-tight sm:text-3xl">
        {title}
      </h2>
      {lede && (
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {lede}
        </p>
      )}
      {children}
    </section>
  );
}

/** A repo path rendered as a link to the file on GitHub. */
function SourceLink({ path }: { path: string }) {
  return (
    <a
      href={`${REPO_URL}/blob/main/${path}`}
      className="font-mono text-[11px] text-[var(--accent)] hover:underline"
    >
      {path}
    </a>
  );
}

/* ------------------------------------------------------------------- hero -- */

export function Hero() {
  return (
    <section className="py-20 sm:py-28">
      <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
        <span className="size-1.5 rounded-full bg-[var(--series-agent)]" />
        Open source · MIT licensed · reference implementation
      </p>

      <h1 className="max-w-3xl text-4xl font-medium leading-[1.1] tracking-tight sm:text-[52px]">
        Audio in, grounded insight out.
        <br />
        <span className="text-[var(--muted)]">A pipeline you can read and fork.</span>
      </h1>

      <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--muted)]">
        A working, end-to-end example of speech-to-text followed by LLM
        inference — with every model claim checked against the transcript before
        it is shown. The worked example is call-centre quality review; the
        pattern carries over to any recorded conversation.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/demo"
          className="rounded-md bg-[var(--foreground)] px-5 py-2.5 text-sm text-[var(--background)] transition-opacity hover:opacity-90"
        >
          Run the demo →
        </Link>
        <a
          href={REPO_URL}
          className="rounded-md border border-[var(--border-strong)] px-5 py-2.5 text-sm transition-colors hover:bg-[var(--accent-soft)]"
        >
          Read the source
        </a>
      </div>

      <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        {[
          ["3", "stages: transcribe, infer, verify"],
          ["0", "databases or storage buckets"],
          ["~50s", "per 10-minute call, measured"],
          ["~$0.05", "API cost per 10-minute call"],
        ].map(([v, l]) => (
          <div key={l}>
            <dt className="text-2xl font-medium tracking-tight">{v}</dt>
            <dd className="mt-1 text-xs leading-snug text-[var(--muted)]">{l}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* --------------------------------------------------------------- pipeline -- */

const STEPS = [
  {
    n: "01",
    title: "Upload and transcribe",
    body: "Audio is relayed to the speech-to-text provider. The language is detected, the two speakers are separated, and every word gets a timestamp and a confidence score.",
    path: "src/lib/providers/asr-assemblyai.ts",
  },
  {
    n: "02",
    title: "Measure without a model",
    body: "Talk share, silence and interruptions are plain arithmetic over the word timings. Keeping these out of the LLM makes them repeatable.",
    path: "src/lib/metrics.ts",
  },
  {
    n: "03",
    title: "Infer with structured output",
    body: "The transcript goes to the LLM in its original language with a rubric and a JSON schema. Every observation must cite a verbatim quote, a timestamp and a speaker.",
    path: "src/lib/analysis/prompt.ts",
  },
  {
    n: "04",
    title: "Verify before showing",
    body: "Each quote is located in the real transcript. Anything that cannot be found, is at the wrong time, or is attributed to the wrong speaker is dropped and counted.",
    path: "src/lib/verify.ts",
  },
];

export function Pipeline() {
  return (
    <Section
      id="pipeline"
      eyebrow="The pipeline"
      title="Four stages, each in its own file"
      lede="Three short API routes drive it from the browser: upload, poll for the transcript, then analyse. No queue, no webhook, no database."
    >
      <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <li key={s.n} className="flex flex-col bg-[var(--surface)] p-6">
            <span className="font-mono text-[11px] text-[var(--series-agent)]">
              {s.n}
            </span>
            <h3 className="mt-3 text-sm font-medium">{s.title}</h3>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[var(--muted)]">
              {s.body}
            </p>
            <p className="mt-4">
              <SourceLink path={s.path} />
            </p>
          </li>
        ))}
      </ol>

      <pre className="mt-6 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 font-mono text-[12px] leading-relaxed text-[var(--muted)]">
{`Browser
 ├─ POST /api/transcribe   audio bytes → ASR provider, returns a job id   ~2s
 ├─ GET  /api/status?id=   poll every 3s                                 30-60s
 └─ POST /api/insight      transcript → LLM → verify quotes              ~20s`}
      </pre>
    </Section>
  );
}

/* --------------------------------------------------------------- concepts -- */

const CONCEPTS: Array<{
  title: string;
  body: string;
  visual: ReactNode;
  path: string;
}> = [
  {
    title: "Language detection, not declaration",
    body: "Nobody tags the recording. The ASR provider detects the language per file, so mixed-language datasets need no preprocessing.",
    visual: <ScriptSampler />,
    path: "src/lib/providers/asr-assemblyai.ts",
  },
  {
    title: "Speaker diarization",
    body: "Two speakers are split automatically. Diarization gives labels (A/B), not roles — the template guesses the agent and says that it is a guess.",
    visual: <MiniTimeline />,
    path: "src/lib/metrics.ts",
  },
  {
    title: "Evidence-carrying output",
    body: "The JSON schema makes a quote, timestamp and speaker mandatory on every observation. In the UI, clicking a quote seeks the audio to that moment.",
    visual: <QuoteCard />,
    path: "src/lib/analysis/schema.ts",
  },
  {
    title: "Measured kept apart from judged",
    body: "Deterministic metrics and model opinions are computed separately and labelled separately, so a reader always knows which is which.",
    visual: <MeasuredSplit />,
    path: "src/lib/metrics.ts",
  },
  {
    title: "No pre-translation",
    body: "Translating before inference destroys what is being assessed — आप versus तू, usted versus tú, a switch out of English. The model reads the original.",
    visual: <RegisterCard />,
    path: "src/lib/analysis/prompt.ts",
  },
  {
    title: "A rubric as data",
    body: "One list of categories drives the prompt, the output schema and the chart. Change the list and you have a different analyser.",
    visual: <CoachingCard />,
    path: "src/lib/quality-guide.ts",
  },
];

export function Concepts() {
  return (
    <Section
      id="concepts"
      eyebrow="Concepts"
      title="Techniques worth borrowing"
      lede="Each of these is a design decision you will face in any voice-to-insight system. Each one links to where it is implemented."
    >
      <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
        {CONCEPTS.map((c) => (
          <div key={c.title} className="flex flex-col bg-[var(--surface)] p-6">
            <div className="mb-5 h-[72px]">{c.visual}</div>
            <h3 className="text-sm font-medium">{c.title}</h3>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[var(--muted)]">
              {c.body}
            </p>
            <p className="mt-4">
              <SourceLink path={c.path} />
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------- concept mini-visuals */

function ScriptSampler() {
  const samples = ["नमस्ते सर", "வணக்கம்", "¿Bueno?", "مرحبا", "Good morning"];
  return (
    <div className="flex h-full flex-wrap content-center gap-1.5">
      {samples.map((s, i) => (
        <span
          key={s}
          className="rounded border border-[var(--border)] px-2 py-1 text-[13px]"
          style={{
            color: i === 0 ? "var(--series-agent)" : undefined,
            borderColor: i === 0 ? "var(--series-agent)" : undefined,
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function MiniTimeline() {
  // Illustrative proportions — a schematic of the form, not data from a call.
  const turns = [
    [0, 18, true],
    [20, 30, false],
    [52, 14, true],
    [68, 9, false],
    [80, 20, true],
  ] as const;
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <div
        className="relative h-7 w-full overflow-hidden rounded-[4px]"
        style={{ background: "var(--chart-track)" }}
      >
        {turns.map(([left, width, isAgent], i) => (
          <div
            key={i}
            className="absolute top-0 h-full rounded-[3px]"
            style={{
              left: `${left}%`,
              width: `calc(${width}% - 2px)`,
              background: isAgent
                ? "var(--series-agent)"
                : "var(--series-customer)",
            }}
          />
        ))}
      </div>
      <div className="flex gap-4">
        <LegendItem color="var(--series-agent)" label="Agent" />
        <LegendItem color="var(--series-customer)" label="Customer" />
      </div>
    </div>
  );
}

function QuoteCard() {
  return (
    <div className="flex h-full items-center">
      <div className="w-full rounded border border-[var(--border)] px-2.5 py-2">
        <span className="tnum block font-mono text-[10px] text-[var(--subtle)]">
          0:14 · Speaker A
        </span>
        <span className="mt-1 block text-[12px] leading-snug">
          “I am really sorry, that is a long time to be without a connection.”
        </span>
      </div>
    </div>
  );
}

function MeasuredSplit() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      <div className="flex items-center gap-2">
        <Badge tone="accent">measured</Badge>
        <span className="tnum text-xs text-[var(--muted)]">
          73% talk · 5.2s silence
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge>judged</Badge>
        <span className="text-xs text-[var(--muted)]">
          empathy, ownership, close
        </span>
      </div>
    </div>
  );
}

function RegisterCard() {
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <div className="flex items-center gap-2 text-[15px]">
        <span className="text-[var(--met)]">आप</span>
        <span className="text-xs text-[var(--subtle)]">formal</span>
        <span className="ml-auto text-[var(--not-met)]">तू</span>
        <span className="text-xs text-[var(--subtle)]">familiar</span>
      </div>
      <p className="text-[11px] leading-snug text-[var(--subtle)]">
        Both become “you” in English. One is a politeness violation.
      </p>
    </div>
  );
}

function CoachingCard() {
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <p className="flex gap-2 text-[12px] leading-snug">
        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--not-met)]" />
        Ask permission before a wait, rather than only telling the customer to
        bear with you.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- verification -- */

export function Verification() {
  return (
    <Section
      id="verification"
      eyebrow="Verification"
      title="Treat model output as untrusted input"
      lede="In quality review, an invented quote becomes a false claim about a named person. So the pipeline does not trust the LLM: every quote is checked against the transcript before it reaches the page."
    >
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <h3 className="text-sm font-medium">
            Three checks on every claim
          </h3>
          <ul className="mt-5 space-y-4">
            {[
              [
                "Is the quote really in the transcript?",
                "Fuzzy-matched against the word stream, tolerant of punctuation and reformatting.",
              ],
              [
                "Was it said when the model says it was?",
                "Checked against the nearest real occurrence — which is what makes short, repeated phrases verifiable.",
              ],
              [
                "Did the right person say it?",
                "Compared against the diarized speaker at that moment.",
              ],
            ].map(([q, a], i) => (
              <li key={q} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] font-mono text-[10px]">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[13px] font-medium">{q}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--muted)]">
                    {a}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-[var(--border)] pt-4 text-[13px] leading-relaxed text-[var(--muted)]">
            Anything that fails is <strong>dropped and counted</strong>. The count
            is shown with every result, and if nothing survives, no score is
            shown. See <SourceLink path="src/lib/verify.ts" /> and its tests.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="font-mono text-[11px] text-[var(--met)]">KEPT</p>
            <p className="mt-2 text-[13px] leading-snug">
              Owned the failure by stating the prior tickets were never assigned.
            </p>
            <div className="mt-2 rounded border border-[var(--border)] px-2.5 py-2">
              <span className="tnum block font-mono text-[10px] text-[var(--subtle)]">
                0:31 · Speaker A · conf 1.00
              </span>
              <span className="mt-1 block text-[12px] leading-snug">
                “I can see 2 tickets were raised, but neither one was assigned…”
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--caution)] bg-[var(--caution-soft)] p-6">
            <p className="font-mono text-[11px] text-[var(--caution)]">
              DISCARDED — QUOTE NOT FOUND
            </p>
            <p className="mt-2 text-[13px] leading-snug text-[var(--caution)]">
              “I have issued a full refund to your card.”
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--caution)]">
              Plausible, well-formed, and never said on the call. This is what the
              verification step exists to catch — and the reader is told it
              happened.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------- build your own -- */

const ADAPT: Array<{ title: string; body: string; path: string }> = [
  {
    title: "Swap the speech-to-text provider",
    body: "Implement the four-method AsrProvider interface — upload, submit, status, fetchResult — for Whisper, Deepgram or anything else.",
    path: "src/lib/providers/asr.ts",
  },
  {
    title: "Swap the LLM",
    body: "The client speaks the OpenAI-compatible protocol, so another hosted model or a self-hosted vLLM endpoint is a base-URL and model-name change.",
    path: "src/lib/providers/llm.ts",
  },
  {
    title: "Change the use case",
    body: "Replace the rubric and the system prompt to review sales calls, interviews, clinic visits or lectures. The verifier does not care what the domain is.",
    path: "src/lib/quality-guide.ts",
  },
];

export function BuildYourOwn() {
  return (
    <Section
      id="build"
      eyebrow="Build your own"
      title="Where to make it your own"
      lede="The call-centre framing lives in a rubric and a prompt. The pipeline around them is generic, and each provider sits behind a small seam."
    >
      <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] lg:grid-cols-3">
        {ADAPT.map((a) => (
          <div key={a.title} className="flex flex-col bg-[var(--surface)] p-6">
            <h3 className="text-sm font-medium">{a.title}</h3>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[var(--muted)]">
              {a.body}
            </p>
            <p className="mt-4">
              <SourceLink path={a.path} />
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 font-mono text-[12px] leading-relaxed">
{`git clone ${REPO_URL}.git
cd voice-insight-template
npm install
cp .env.example .env.local   # add two API keys
npm run dev`}
        </pre>
        <div className="flex flex-col justify-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-[13px] leading-relaxed text-[var(--muted)]">
            You need an AssemblyAI key for transcription and an xAI key for
            analysis; both offer free credit. Tests run with no keys and no
            network.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`${REPO_URL}/blob/main/docs/ARCHITECTURE.md`}
              className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] transition-opacity hover:opacity-90"
            >
              Architecture guide
            </a>
            <a
              href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}
              className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm transition-colors hover:bg-[var(--accent-soft)]"
            >
              Contributing
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
