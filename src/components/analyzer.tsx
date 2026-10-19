"use client";

import { useEffect, useRef, useState } from "react";
import type { SentimentSegment, Utterance, Word } from "@/lib/providers/asr";
import type { CallMetrics } from "@/lib/metrics";
import type {
  Evidence,
  Insight,
  Point,
  VerificationStats,
} from "@/lib/analysis/types";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/verify";
import { Badge, Panel } from "@/components/ui";
import { CallTimeline } from "@/components/charts/call-timeline";
import { TalkShare } from "@/components/charts/talk-share";
import { HeroScore, Meter, Stat } from "@/components/charts/stat";
import { CategoryScores } from "@/components/charts/category-scores";
import { LockButton } from "@/components/lock-button";
import { PLATFORM_MAX_BYTES, formatMb } from "@/lib/limits";
import {
  formatDuration,
  formatPercent,
  formatTimestamp,
  languageName,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  SAMPLE_INSIGHT,
  SAMPLE_METRICS,
  SAMPLE_SENTIMENT,
  SAMPLE_TRANSCRIPT_META,
  SAMPLE_UTTERANCES,
  SAMPLE_VERIFICATION,
} from "@/lib/sample";

type Result = {
  transcript: {
    utterances: Utterance[];
    words?: Word[];
    sentimentSegments?: SentimentSegment[];
    languageCode: string | null;
    durationMs: number | null;
    agentSpeakerLabel: string | null;
  };
  model: string;
  insight: Insight;
  metrics: CallMetrics;
  verification: VerificationStats;
};

type Stage = "idle" | "uploading" | "transcribing" | "analyzing" | "done";


const STAGE_COPY: Record<Exclude<Stage, "idle" | "done">, string> = {
  uploading: "Uploading audio",
  transcribing: "Transcribing and separating speakers",
  analyzing: "Analysing the conversation",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Load a worked example so the output can be seen without spending API credit.
 *
 * Gated behind an obvious banner. This is the one place the interface shows
 * something it did not derive from real audio, and it says so continuously
 * rather than once.
 */
function sampleResult(): Result {
  return {
    transcript: {
      utterances: SAMPLE_UTTERANCES,
      sentimentSegments: SAMPLE_SENTIMENT,
      languageCode: SAMPLE_TRANSCRIPT_META.languageCode,
      durationMs: SAMPLE_TRANSCRIPT_META.durationMs,
      agentSpeakerLabel: SAMPLE_TRANSCRIPT_META.agentSpeakerLabel,
    },
    model: "sample — no model was called",
    insight: SAMPLE_INSIGHT,
    metrics: SAMPLE_METRICS,
    verification: SAMPLE_VERIFICATION,
  };
}

/**
 * `maxBytes` mirrors the server's limit for this visitor, so oversized files
 * fail instantly. `gated` shows the lock button. `canUnlock` offers an access
 * code to lift the public-demo cap.
 */
export function Analyzer({
  maxBytes = PLATFORM_MAX_BYTES,
  gated = false,
  canUnlock = false,
}: {
  maxBytes?: number;
  gated?: boolean;
  canUnlock?: boolean;
}) {
  const capped = maxBytes < PLATFORM_MAX_BYTES;
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rowRefs = useRef<Record<number, HTMLLIElement | null>>({});
  const audioUrlRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<Evidence | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [category, setCategory] = useState<string | null>(null);

  const working =
    stage === "uploading" || stage === "transcribing" || stage === "analyzing";

  // Elapsed counter. Transcription has no progress signal, so we show honest
  // elapsed time rather than a progress bar that would be pure animation.
  useEffect(() => {
    if (!working) return;
    const started = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.round((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [working]);

  // Revoke the last object URL on unmount; the rest is handled where the file
  // is chosen, since creating it in an effect would cascade a second render.
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  /**
   * The browser already holds the file, so playback needs no storage service at
   * all — an object URL feeds the player directly.
   */
  function attachAudio(picked: File | null) {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = picked ? URL.createObjectURL(picked) : null;
    audioUrlRef.current = url;
    setAudioUrl(url);
    setCurrentMs(0);
  }

  function chooseFile(picked: File | null) {
    setError(null);
    setResult(null);
    setSelected(null);
    setCategory(null);
    setIsSample(false);
    setStage("idle");
    attachAudio(picked);
    if (!picked) return;
    if (picked.size > maxBytes) {
      setFile(picked);
      setError(
        capped
          ? `That file is ${formatMb(picked.size)}. The public demo accepts up to ${formatMb(maxBytes)} to keep API costs bounded. ` +
              `Try a shorter clip, or clone the repository and run it with your own keys.`
          : `That file is ${formatMb(picked.size)}, over the 4.5 MB limit. ` +
              `Audio is relayed through a serverless function in this template. A mono MP3 at 32–64 kbps holds roughly 9–18 minutes.`,
      );
      return;
    }
    setFile(picked);
  }

  async function analyse() {
    if (!file) return;
    setError(null);
    setResult(null);
    setIsSample(false);
    setElapsed(0);

    try {
      setStage("uploading");
      const started = await fetch("/api/transcribe", {
        method: "POST",
        body: file,
      });
      if (!started.ok) throw new Error((await started.json()).error);
      const { id } = (await started.json()) as { id: string };

      setStage("transcribing");
      for (;;) {
        await sleep(3000);
        const res = await fetch(`/api/status?id=${id}`);
        const status = await res.json();
        if (!res.ok) throw new Error(status.error);
        if (status.state === "failed") throw new Error(status.error);
        if (status.state === "ready") break;
      }

      setStage("analyzing");
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);

      setResult(payload as Result);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStage("idle");
    }
  }

  /** Single place that moves the audio, used by quotes, the timeline and the transcript. */
  function seek(ms: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = ms / 1000;
    setCurrentMs(ms);
    void audio.play().catch(() => {
      /* Autoplay may be blocked; the seek still happened. */
    });
  }

  /**
   * The link that makes the output checkable: clicking a quote seeks the audio
   * to it and scrolls the transcript to the same moment, so any claim can be
   * confirmed or refuted in about two seconds.
   */
  function selectQuote(quote: Evidence) {
    setSelected(quote);
    const utterances = result?.transcript.utterances ?? [];
    const index = utterances.findIndex(
      (u) => quote.startMs < u.endMs && quote.endMs > u.startMs,
    );
    if (index >= 0) {
      rowRefs.current[index]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
    seek(quote.startMs);
  }

  const activeIndex = selected
    ? (result?.transcript.utterances ?? []).findIndex(
        (u) => selected.startMs < u.endMs && selected.endMs > u.startMs,
      )
    : -1;

  return (
    <div className="space-y-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Analyse a call</h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
            Upload a recording. Every observation comes back with the quote that
            backs it — click one to hear it.
          </p>
          {capped && (
            <p className="mt-2 text-xs text-[var(--subtle)]">
              Public demo: files up to {formatMb(maxBytes)} (a few minutes of
              compressed audio).
              {canUnlock && (
                <>
                  {" "}
                  <a href="/unlock" className="text-[var(--accent)] hover:underline">
                    Have an access code?
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        {gated && <LockButton />}
      </header>

      <Panel>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={working}
            className="h-9 rounded-md border border-[var(--border-strong)] px-3 text-sm transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-40"
          >
            {file ? "Choose another…" : "Choose audio…"}
          </button>

          {file && (
            <span className="min-w-0 truncate text-sm text-[var(--muted)]">
              {file.name}{" "}
              <span className="tnum text-[var(--subtle)]">
                ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </span>
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSelected(null);
                setIsSample(true);
                setResult(sampleResult());
                setStage("done");
              }}
              disabled={working}
              className="h-9 rounded-md border border-[var(--border-strong)] px-3 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-40"
            >
              View sample output
            </button>
            <button
              type="button"
              onClick={analyse}
              disabled={!file || working || !!(file && file.size > maxBytes)}
              className="dl-btn dl-btn--primary"
            >
              {working ? "Working…" : "Analyse"}
            </button>
          </div>
        </div>

        {working && <StageBar stage={stage} elapsed={elapsed} />}

        {error && (
          <p className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--not-met)]">
            {error}
          </p>
        )}
      </Panel>

      {result && isSample && (
        <div
          role="status"
          className="rounded-lg border border-[var(--caution)] bg-[var(--caution-soft)] px-5 py-3"
        >
          <p className="text-sm font-medium text-[var(--caution)]">
            Sample output — no audio was analysed
          </p>
          <p className="mt-1 text-xs text-[var(--caution)]">
            Everything below is a worked example written by hand to show the
            interface. No recording was transcribed and no model was called.
            Upload a file and press Analyse for a real result.
          </p>
        </div>
      )}

      {result && (
        <>
          <Panel
            title="Call shape"
            description={
              result.transcript.agentSpeakerLabel
                ? `Speaker ${result.transcript.agentSpeakerLabel} spoke first and is treated as the agent.`
                : "Speakers were not separated on this recording."
            }
            action={
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone="accent">
                  {languageName(result.transcript.languageCode)}
                </Badge>
                <Badge>{formatDuration(result.transcript.durationMs)}</Badge>
              </div>
            }
          >
            <div className="space-y-4 px-5 py-4">
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  preload="metadata"
                  className="w-full"
                  onTimeUpdate={(e) =>
                    setCurrentMs(e.currentTarget.currentTime * 1000)
                  }
                />
              )}
              <CallTimeline
                utterances={result.transcript.utterances}
                words={result.transcript.words}
                durationMs={result.transcript.durationMs}
                agentSpeakerLabel={result.transcript.agentSpeakerLabel}
                events={result.metrics.events}
                sentimentSegments={result.transcript.sentimentSegments}
                strengths={result.insight.strengths}
                coaching={result.insight.coaching}
                currentMs={audioUrl ? currentMs : undefined}
                onSeek={audioUrl ? seek : undefined}
                onSelectQuote={selectQuote}
                selectedQuote={selected}
              />
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <InsightCard
                result={result}
                onSelect={selectQuote}
                selected={selected}
                category={category}
                onSelectCategory={setCategory}
              />
              <MeasuredPanel
                metrics={result.metrics}
                agentLabel={result.transcript.agentSpeakerLabel}
              />
              <ProvenancePanel result={result} />
            </div>

            <TranscriptPanel
              result={result}
              rowRefs={rowRefs}
              activeIndex={activeIndex}
              onSeek={audioUrl ? seek : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ parts -- */

/** Honest staging: no progress bar, because no provider gives us a progress signal. */
function StageBar({
  stage,
  elapsed,
}: {
  stage: Stage;
  elapsed: number;
}) {
  const order: Array<Exclude<Stage, "idle" | "done">> = [
    "uploading",
    "transcribing",
    "analyzing",
  ];
  const activeIndex = order.indexOf(stage as Exclude<Stage, "idle" | "done">);

  return (
    <div className="border-t border-[var(--border)] px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {order.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <span
              key={s}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs",
                active && "text-[var(--accent)]",
                done && "text-[var(--met)]",
                !active && !done && "text-[var(--subtle)]",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  active && "animate-pulse bg-current",
                  done && "bg-current",
                  !active && !done && "border border-current",
                )}
              />
              {STAGE_COPY[s]}
            </span>
          );
        })}
        <span className="tnum ml-auto text-xs text-[var(--subtle)]">
          {elapsed}s
        </span>
      </div>
    </div>
  );
}

function InsightCard({
  result,
  selected,
  onSelect,
  category,
  onSelectCategory,
}: {
  result: Result;
  selected: Evidence | null;
  onSelect: (quote: Evidence) => void;
  category: string | null;
  onSelectCategory: (key: string | null) => void;
}) {
  const { insight } = result;
  const allPoints = [...insight.strengths, ...insight.coaching];
  // Selecting a category narrows the evidence to what actually informed it.
  const filter = (points: Point[]) =>
    category ? points.filter((p) => p.category === category) : points;
  const outcomeTone =
    insight.outcome === "resolved"
      ? "met"
      : insight.outcome === "unresolved"
        ? "notMet"
        : "neutral";

  return (
    <Panel
      title="Insight"
      action={<HeroScore score={insight.score} />}
    >
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm leading-relaxed">{insight.summary}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone={outcomeTone as "met" | "notMet" | "neutral"}>
            {insight.outcome}
          </Badge>
          <span className="text-[var(--muted)]">{insight.customerWanted}</span>
        </div>

        <p className="border-l-2 border-[var(--border)] pl-3 text-xs leading-relaxed text-[var(--subtle)]">
          {insight.scoreBasis}
        </p>

        {insight.categories.length > 0 && (
          <div className="border-t border-[var(--border)] pt-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-xs font-medium">By category</h3>
              {category && (
                <button
                  type="button"
                  onClick={() => onSelectCategory(null)}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
            <CategoryScores
              categories={insight.categories}
              points={allPoints}
              selectedCategory={category}
              onSelectCategory={onSelectCategory}
            />
          </div>
        )}

        <PointList
          heading="What went well"
          points={filter(insight.strengths)}
          tone="met"
          selected={selected}
          onSelect={onSelect}
        />
        <PointList
          heading="Coaching"
          points={filter(insight.coaching)}
          tone="notMet"
          selected={selected}
          onSelect={onSelect}
        />
      </div>
    </Panel>
  );
}

function PointList({
  heading,
  points,
  tone,
  selected,
  onSelect,
}: {
  heading: string;
  points: Point[];
  tone: "met" | "notMet";
  selected: Evidence | null;
  onSelect: (quote: Evidence) => void;
}) {
  if (points.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-medium">{heading}</h3>
        <p className="mt-1 text-xs text-[var(--subtle)]">
          Nothing the transcript supports.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-medium">
        {heading}{" "}
        <span className="tnum font-normal text-[var(--subtle)]">
          {points.length}
        </span>
      </h3>
      <ul className="mt-2 space-y-2">
        {points.map((item, i) => {
          const lowConfidence =
            item.quote.asrConfidence != null &&
            item.quote.asrConfidence < LOW_CONFIDENCE_THRESHOLD;
          return (
            <li key={i} className="flex gap-2.5">
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  tone === "met" ? "bg-[var(--met)]" : "bg-[var(--not-met)]",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed">{item.point}</p>
                {lowConfidence && (
                  <span className="mt-1 inline-block">
                    <Badge
                      tone="caution"
                      title="The audio behind this quote was unclear."
                    >
                      low audio confidence
                    </Badge>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(item.quote)}
                  className={cn(
                    "mt-1.5 block w-full rounded border border-[var(--border)] px-2.5 py-2 text-left transition-colors hover:border-[var(--border-strong)]",
                    selected === item.quote && "border-[var(--accent)]",
                  )}
                >
                  <span className="tnum block font-mono text-[10px] text-[var(--subtle)]">
                    ▶ {formatTimestamp(item.quote.startMs)} · Speaker{" "}
                    {item.quote.speaker}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed">
                    “{item.quote.quoteOriginal}”
                  </span>
                  {item.quote.quoteEnglish &&
                    item.quote.quoteEnglish !== item.quote.quoteOriginal && (
                      <span className="mt-1 block text-xs italic leading-relaxed text-[var(--subtle)]">
                        “{item.quote.quoteEnglish}”
                      </span>
                    )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Measured values, kept visually separate from the model's judgements because
 * they are arithmetic over the word stream rather than an opinion. Deliberately
 * uncoloured and unthresholded: what counts as a healthy talk ratio differs per
 * queue, and we have no basis to assert one.
 */
function MeasuredPanel({
  metrics,
  agentLabel,
}: {
  metrics: CallMetrics;
  agentLabel: string | null;
}) {
  return (
    <Panel
      title="Measured"
      description="Counted from the recording. No model involved."
    >
      <div className="space-y-5 px-5 py-4">
        <TalkShare
          agentMs={metrics.agentTalkMs}
          customerMs={metrics.customerTalkMs}
        />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
          <Stat
            label="Speech rate"
            value={Math.round(metrics.agentWordsPerMinute)}
            unit="wpm"
            hint="Agent words per minute of agent speech"
          />
          <Stat
            label="Longest monologue"
            value={formatDuration(metrics.longestAgentMonologueMs)}
          />
          <Stat
            label="Silence over 3s"
            value={formatDuration(metrics.silenceMs)}
            hint="Measured between turns only — dead air before the first word or after the last is excluded"
          />
          <Stat label="Interruptions" value={metrics.overtalkCount} />
          <Stat
            label="First response"
            value={
              metrics.timeToFirstResponseMs != null
                ? formatDuration(metrics.timeToFirstResponseMs)
                : "—"
            }
            hint="From the customer's first turn to the agent's reply"
          />
          <Stat
            label="Transcription confidence"
            value={formatPercent(metrics.meanWordConfidence)}
          />
        </dl>

        {!agentLabel && (
          <p className="border-t border-[var(--border)] pt-3 text-xs text-[var(--caution)]">
            Speakers were not separated on this recording, so talk share and
            first-response cannot be attributed.
          </p>
        )}
      </div>
    </Panel>
  );
}

/**
 * The verifier's report.
 *
 * Publishing how many of the model's claims were thrown away is the point: it
 * turns hallucination from something invisible into a number on the page.
 */
function ProvenancePanel({ result }: { result: Result }) {
  const [open, setOpen] = useState(false);
  const { checked, dropped } = result.verification;
  const kept = checked - dropped.length;

  return (
    <Panel title="Provenance">
      <div className="space-y-3 px-5 py-4 text-xs text-[var(--muted)]">
        <Meter
          label="Quotes confirmed against the transcript"
          value={kept}
          total={checked}
          tone={dropped.length > 0 ? "caution" : "accent"}
        />

        <p>
          Every quote shown was located in the real transcript before it was
          displayed
          {dropped.length > 0
            ? `. ${dropped.length} claim${dropped.length === 1 ? "" : "s"} could not be confirmed and ${dropped.length === 1 ? "was" : "were"} discarded.`
            : ", and all of them held up."}
        </p>

        {dropped.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-[var(--accent)] hover:underline"
            >
              {open ? "Hide" : "Show"} discarded claims
            </button>
            {open && (
              <ul className="space-y-1.5 border-l-2 border-[var(--border)] pl-3">
                {dropped.map((d, i) => (
                  <li key={i}>
                    <span className="font-mono text-[10px] text-[var(--caution)]">
                      {d.reason.replace(/_/g, " ")}
                      {d.claimedSpeaker && d.actualSpeaker && (
                        <>
                          {" "}
                          — said {d.claimedSpeaker}, transcript says{" "}
                          {d.actualSpeaker}
                        </>
                      )}
                    </span>
                    <span className="block">{d.point}</span>
                    {d.quote && (
                      <span className="block italic">“{d.quote}”</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <p className="border-t border-[var(--border)] pt-2 font-mono text-[10px] text-[var(--subtle)]">
          {result.model} · {languageName(result.transcript.languageCode)} ·{" "}
          {formatDuration(result.transcript.durationMs)}
        </p>
      </div>
    </Panel>
  );
}

function TranscriptPanel({
  result,
  rowRefs,
  activeIndex,
  onSeek,
}: {
  result: Result;
  rowRefs: React.RefObject<Record<number, HTMLLIElement | null>>;
  activeIndex: number;
  onSeek?: (ms: number) => void;
}) {
  const { utterances, agentSpeakerLabel } = result.transcript;

  return (
    <Panel title="Transcript" className="lg:sticky lg:top-20 lg:self-start">
      <ul className="max-h-[40rem] overflow-y-auto px-5 py-2">
        {utterances.map((u, i) => {
          const isAgent = u.speaker === agentSpeakerLabel;
          return (
            <li
              key={i}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className={cn(
                "-mx-2 rounded px-2 py-2 transition-colors",
                i === activeIndex && "evidence-active",
              )}
            >
              <div className="flex items-baseline gap-2.5">
                <button
                  type="button"
                  onClick={() => onSeek?.(u.startMs)}
                  disabled={!onSeek}
                  className="tnum shrink-0 font-mono text-[11px] text-[var(--subtle)] hover:text-[var(--accent)] disabled:hover:text-[var(--subtle)]"
                >
                  {formatTimestamp(u.startMs)}
                </button>
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 text-[11px]"
                  style={{
                    color: isAgent
                      ? "var(--series-agent)"
                      : "var(--series-customer)",
                  }}
                >
                  <span
                    aria-hidden
                    className="size-1.5 rounded-[2px]"
                    style={{
                      background: isAgent
                        ? "var(--series-agent)"
                        : "var(--series-customer)",
                    }}
                  />
                  {isAgent ? "Agent" : `Speaker ${u.speaker}`}
                </span>
              </div>
              <p className="mt-0.5 text-sm leading-relaxed">{u.text}</p>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--subtle)]">
        Shown in the language it was spoken. Nothing here is machine-translated —
        English appears only under the quotes, where it came back alongside the
        observation.
      </p>
    </Panel>
  );
}
