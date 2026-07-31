import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { LegendItem } from "@/components/charts/talk-share";
import { CONTACT_ENABLED } from "@/lib/site";

/**
 * Landing sections.
 *
 * Every claim on this page is one the code actually backs. There are no
 * customer logos, testimonials, accuracy percentages, or adoption counts,
 * because none of those exist yet — and a product whose pitch is "we do not
 * show you things we cannot support" cannot open with invented proof.
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

/* ------------------------------------------------------------------- hero -- */

export function Hero() {
  return (
    <section className="py-20 sm:py-28">
      <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
        <span className="size-1.5 rounded-full bg-[var(--series-agent)]" />
        Call quality analysis for BPOs
      </p>

      <h1 className="max-w-3xl text-4xl font-medium leading-[1.1] tracking-tight sm:text-[52px]">
        Every call scored.
        <br />
        <span className="text-[var(--muted)]">Every claim quoted.</span>
      </h1>

      <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--muted)]">
        Lisn10 turns call recordings into coaching your team leaders can act on —
        in the language the call was actually spoken in, with the audio attached
        to every observation.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/demo"
          className="rounded-md bg-[var(--foreground)] px-5 py-2.5 text-sm text-[var(--background)] transition-opacity hover:opacity-90"
        >
          Analyse a call →
        </Link>
        <Link
          href="#evidence"
          className="rounded-md border border-[var(--border-strong)] px-5 py-2.5 text-sm transition-colors hover:bg-[var(--accent-soft)]"
        >
          Why you can trust the output
        </Link>
      </div>

      <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        {[
          ["99", "languages, auto-detected"],
          ["~50s", "per call, end to end"],
          ["0", "integrations to set up"],
          ["100%", "of claims quote-checked"],
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

/* ----------------------------------------------------------- capabilities -- */

const CAPABILITIES: Array<{ title: string; body: string; visual: ReactNode }> = [
  {
    title: "Any language, undeclared",
    body: "Nobody tags the recording. The language is detected per call — 99 of them — and the call is judged in the language it was spoken in.",
    visual: <ScriptSampler />,
  },
  {
    title: "Speakers separated",
    body: "Agent and customer are split automatically, so talk share, interruptions and every quote are attributed to the right person.",
    visual: <MiniTimeline />,
  },
  {
    title: "Evidence on every claim",
    body: "No observation appears without the verbatim quote, timestamp and speaker behind it. Click one and the audio jumps there.",
    visual: <QuoteCard />,
  },
  {
    title: "Measured kept apart from judged",
    body: "Talk ratio, silence and interruptions are arithmetic over the audio — no model involved. Only the coaching is an opinion, and it is labelled as one.",
    visual: <MeasuredSplit />,
  },
  {
    title: "Nothing is pre-translated",
    body: "Translating before analysis destroys what is being assessed — आप versus तू, usted versus tú, the moment a frustrated customer switches out of English.",
    visual: <RegisterCard />,
  },
  {
    title: "Coaching, not just a number",
    body: "“Showed empathy” helps nobody. Findings name what to do differently, tied to the moment it should have happened.",
    visual: <CoachingCard />,
  },
];

export function Capabilities() {
  return (
    <Section
      id="capabilities"
      eyebrow="Capabilities"
      title="Built for floors that run in six languages before lunch"
      lede="Everything below is a behaviour of the product, not a roadmap item."
    >
      <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((c) => (
          <div key={c.title} className="bg-[var(--surface)] p-6">
            <div className="mb-5 h-[72px]">{c.visual}</div>
            <h3 className="text-sm font-medium">{c.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------- capability mini-visuals */

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

/* ------------------------------------------------------------ how it works -- */

const STEPS = [
  {
    n: "01",
    title: "Upload the recording",
    body: "Drop in an MP3 or M4A. No language tag, no speaker mapping, no metadata.",
  },
  {
    n: "02",
    title: "Transcribe and separate",
    body: "The language is detected and the two speakers are split, with a confidence score on every word.",
  },
  {
    n: "03",
    title: "Analyse in the original language",
    body: "The call is assessed as spoken. Every observation must cite a verbatim quote, a timestamp and a speaker.",
  },
  {
    n: "04",
    title: "Verify before showing",
    body: "Each quote is located in the real transcript. Anything that cannot be found is discarded and counted.",
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how"
      eyebrow="How it works"
      title="Four steps, about fifty seconds"
      lede="One upload to a finished scorecard, with no queue to configure and nothing to integrate first."
    >
      <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <li key={s.n} className="bg-[var(--surface)] p-6">
            <span className="font-mono text-[11px] text-[var(--series-agent)]">
              {s.n}
            </span>
            <h3 className="mt-3 text-sm font-medium">{s.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
              {s.body}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* --------------------------------------------------------------- evidence -- */

export function Evidence() {
  return (
    <Section
      id="evidence"
      eyebrow="Evidence"
      title="Most tools ask you to trust the model. This one checks it."
      lede="A QA score influences an agent's review and their pay. A quote the model invented is a fabricated accusation against a named employee — worse than having no product at all. So model output is treated as untrusted input."
    >
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <h3 className="text-sm font-medium">
            What happens to every claim, before you see it
          </h3>
          <ul className="mt-5 space-y-4">
            {[
              [
                "Is the quote really in the transcript?",
                "Matched against the actual word stream, tolerant of punctuation and reformatting.",
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
            appears on every call, and if nothing survives, no score is shown.
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
              layer exists to catch — and you are told it happened.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------- CTA -- */

export function ClosingCta() {
  return (
    <section className="border-t border-[var(--border)] py-20">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-8 py-12 text-center">
        <h2 className="text-2xl font-medium tracking-tight">
          Run one of your own calls through it
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[var(--muted)]">
          Upload a recording and read the scorecard. Then click a quote and check
          it against the audio yourself — that is the whole pitch.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/demo"
            className="rounded-md bg-[var(--foreground)] px-6 py-2.5 text-sm text-[var(--background)] transition-opacity hover:opacity-90"
          >
            Open the demo →
          </Link>
          {CONTACT_ENABLED && (
            <Link
              href="/contact"
              className="rounded-md border border-[var(--border-strong)] px-6 py-2.5 text-sm transition-colors hover:bg-[var(--accent-soft)]"
            >
              Talk to us
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
