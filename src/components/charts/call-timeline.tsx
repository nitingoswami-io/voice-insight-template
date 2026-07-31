"use client";

import { useMemo, useRef, useState } from "react";
import type { SentimentSegment, Utterance, Word } from "@/lib/providers/asr";
import type { CallEvent } from "@/lib/metrics";
import type { Evidence, Point } from "@/lib/analysis/types";
import { formatTimestamp } from "@/lib/format";
import { LegendItem } from "@/components/charts/talk-share";
import { cn } from "@/lib/utils";

/**
 * The shape of the call, on one axis.
 *
 * Everything that happened is time-stamped, so it all layers onto a single
 * shared axis rather than scattering into separate widgets: who spoke, where
 * the findings landed, where the dead air and interruptions fell, how the
 * sentiment moved, and where the audio got unclear. Reading down a column tells
 * you what was going on at that moment.
 *
 * Silence is the track showing through — absence drawn as absence, rather than a
 * category invented to fill it.
 */

type Marker = { point: Point; tone: "strength" | "coaching" };

export function CallTimeline({
  utterances,
  words,
  durationMs,
  agentSpeakerLabel,
  events = [],
  sentimentSegments = [],
  strengths = [],
  coaching = [],
  currentMs,
  onSeek,
  onSelectQuote,
  selectedQuote,
}: {
  utterances: Utterance[];
  words?: Word[];
  durationMs: number | null;
  agentSpeakerLabel: string | null;
  events?: CallEvent[];
  sentimentSegments?: SentimentSegment[];
  strengths?: Point[];
  coaching?: Point[];
  currentMs?: number;
  onSeek?: (ms: number) => void;
  onSelectQuote?: (quote: Evidence) => void;
  selectedQuote?: Evidence | null;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; ms: number } | null>(null);

  const total = useMemo(() => {
    if (durationMs && durationMs > 0) return durationMs;
    return utterances.reduce((max, u) => Math.max(max, u.endMs), 0) || 1;
  }, [durationMs, utterances]);

  const ticks = useMemo(() => {
    const target = total / 5;
    const step = [5, 10, 15, 30, 60, 120, 300, 600].find(
      (s) => s * 1000 >= target,
    );
    const stepMs = (step ?? 900) * 1000;
    const out: number[] = [];
    for (let t = 0; t <= total; t += stepMs) out.push(t);
    return out;
  }, [total]);

  const markers: Marker[] = useMemo(
    () => [
      ...strengths.map((point) => ({ point, tone: "strength" as const })),
      ...coaching.map((point) => ({ point, tone: "coaching" as const })),
    ],
    [strengths, coaching],
  );

  const hasSentiment = sentimentSegments.length > 0;

  /** Mean word confidence per slice, for the clarity ribbon. */
  const confidenceBins = useMemo(() => {
    if (!words || words.length === 0) return null;
    const BINS = 60;
    const sums = new Array<number>(BINS).fill(0);
    const counts = new Array<number>(BINS).fill(0);
    for (const w of words) {
      const bin = Math.min(BINS - 1, Math.floor((w.startMs / total) * BINS));
      sums[bin] += w.confidence ?? 1;
      counts[bin]++;
    }
    return sums.map((sum, i) => (counts[i] > 0 ? sum / counts[i] : null));
  }, [words, total]);

  const pct = (ms: number) => `${Math.min((ms / total) * 100, 100)}%`;

  function msFromEvent(e: React.MouseEvent<HTMLDivElement>): number | null {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const ratio = (e.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(total, ratio * total));
  }

  const hoveredUtterance =
    hover &&
    utterances.find((u) => hover.ms >= u.startMs && hover.ms <= u.endMs);

  const hoveredSentiment =
    hover &&
    sentimentSegments.find(
      (seg) => hover.ms >= seg.startMs && hover.ms <= seg.endMs,
    );

  return (
    <figure className="m-0">
      <div className="relative">
        {/* --------------------------------------------------- findings row -- */}
        {markers.length > 0 && (
          <div className="relative mb-1 h-4">
            {markers.map((m, i) => {
              const active = selectedQuote === m.point.quote;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectQuote?.(m.point.quote)}
                  title={`${formatTimestamp(m.point.quote.startMs)} — ${m.point.point}`}
                  aria-label={`${m.tone === "strength" ? "Strength" : "Coaching point"} at ${formatTimestamp(m.point.quote.startMs)}: ${m.point.point}`}
                  className={cn(
                    "absolute top-1 size-2.5 -translate-x-1/2 rounded-full border-2 border-[var(--surface)] transition-transform hover:scale-125",
                    active && "scale-150",
                  )}
                  style={{
                    left: pct(m.point.quote.startMs),
                    background:
                      m.tone === "strength"
                        ? "var(--met)"
                        : "var(--not-met)",
                  }}
                />
              );
            })}
          </div>
        )}

        {/* ------------------------------------------------------ speakers -- */}
        <div
          ref={stripRef}
          className={cn("relative", onSeek && "cursor-pointer")}
          onMouseMove={(e) => {
            const ms = msFromEvent(e);
            if (ms == null) return;
            const rect = e.currentTarget.getBoundingClientRect();
            setHover({ x: e.clientX - rect.left, ms });
          }}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const ms = msFromEvent(e);
            if (ms != null) onSeek?.(ms);
          }}
        >
          <div
            className="relative h-11 w-full overflow-hidden rounded-[4px]"
            style={{ background: "var(--chart-track)" }}
            role="img"
            aria-label={`Call timeline, ${utterances.length} turns over ${formatTimestamp(total)}`}
          >
            {utterances.map((u, i) => {
              const isAgent = u.speaker === agentSpeakerLabel;
              const width = Math.max(((u.endMs - u.startMs) / total) * 100, 0.4);
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full rounded-[3px]"
                  style={{
                    left: pct(u.startMs),
                    width: `calc(${width}% - 2px)`,
                    background: isAgent
                      ? "var(--series-agent)"
                      : "var(--series-customer)",
                  }}
                />
              );
            })}

            {/* Events sit on top of the speech, where they happened. */}
            {events.map((ev, i) => {
              const width = Math.max(
                ((Math.abs(ev.endMs - ev.startMs) / total) * 100),
                0.6,
              );
              const left = Math.min(ev.startMs, ev.endMs);
              return ev.type === "silence" ? (
                <div
                  key={i}
                  className="absolute top-0 h-full border-x border-dotted border-[var(--caution)]"
                  style={{ left: pct(left), width: `${width}%` }}
                  aria-hidden
                />
              ) : (
                <div
                  key={i}
                  className="absolute top-0 h-full w-[3px] bg-[var(--caution)]"
                  style={{ left: pct(left) }}
                  aria-hidden
                />
              );
            })}

            {currentMs != null && currentMs > 0 && (
              <div
                aria-hidden
                className="pointer-events-none absolute top-0 h-full w-[2px] bg-[var(--foreground)]"
                style={{ left: pct(currentMs) }}
              />
            )}
          </div>

          {/* ---------------------------------------------------- sentiment -- */}
          {/*
            Polarity encoded as position against a centre baseline, not as hue.
            The two most separable hues are already spent on speaker identity,
            and every candidate sentiment pair measured closer to customer-orange
            than the legibility floor allows. Up/down survives colourblindness,
            greyscale printing and forced-colors; the tint is only a second cue.
          */}
          {hasSentiment && (
            <div
              className="relative mt-[3px] h-4 w-full"
              role="img"
              aria-label="Sentiment through the call, as classified by the transcription provider: above the line positive, below the line negative"
            >
              <div
                aria-hidden
                className="absolute left-0 top-1/2 h-px w-full"
                style={{ background: "var(--chart-axis)" }}
              />
              {sentimentSegments.map((seg, i) => {
                if (seg.sentiment === "NEUTRAL") return null;
                const positive = seg.sentiment === "POSITIVE";
                const width = Math.max(
                  ((seg.endMs - seg.startMs) / total) * 100,
                  0.4,
                );
                return (
                  <div
                    key={i}
                    className={cn(
                      "absolute h-[7px]",
                      positive ? "bottom-1/2 rounded-t-[2px]" : "top-1/2 rounded-b-[2px]",
                    )}
                    style={{
                      left: pct(seg.startMs),
                      width: `calc(${width}% - 2px)`,
                      background: positive ? "var(--met)" : "var(--not-met)",
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* --------------------------------------------------- confidence -- */}
          {confidenceBins && (
            <div
              className="relative mt-[3px] flex h-1.5 w-full gap-px overflow-hidden rounded-[3px]"
              role="img"
              aria-label="Transcription confidence through the call"
            >
              {confidenceBins.map((c, i) => (
                <span
                  key={i}
                  className="h-full flex-1"
                  style={{
                    // One hue, more-is-darker: a sequential ramp, since this is
                    // magnitude rather than identity.
                    background:
                      c == null
                        ? "var(--chart-track)"
                        : `color-mix(in oklab, var(--series-agent) ${Math.round(c * 100)}%, var(--chart-track))`,
                  }}
                />
              ))}
            </div>
          )}

          {/* ------------------------------------------------------ tooltip -- */}
          {hover && hoveredUtterance && (
            <div
              className="pointer-events-none absolute bottom-full z-20 mb-2 w-64 -translate-x-1/2 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 shadow-lg"
              style={{
                left: `clamp(8rem, ${hover.x}px, calc(100% - 8rem))`,
              }}
            >
              <p className="tnum font-mono text-[10px] text-[var(--subtle)]">
                {formatTimestamp(hoveredUtterance.startMs)} ·{" "}
                {hoveredUtterance.speaker === agentSpeakerLabel
                  ? "Agent"
                  : `Speaker ${hoveredUtterance.speaker}`}
                {hoveredSentiment && (
                  <> · {hoveredSentiment.sentiment.toLowerCase()}</>
                )}
              </p>
              <p className="mt-1 line-clamp-3 text-xs leading-snug">
                {hoveredUtterance.text}
              </p>
            </div>
          )}
        </div>

        <div className="relative mt-1 h-4">
          {ticks.map((t) => (
            <span
              key={t}
              className="tnum absolute font-mono text-[10px] text-[var(--subtle)]"
              style={{
                left: pct(t),
                transform: t === 0 ? "none" : "translateX(-50%)",
              }}
            >
              {formatTimestamp(t)}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
        <LegendItem color="var(--series-agent)" label="Agent" />
        <LegendItem color="var(--series-customer)" label="Customer" />
        <LegendItem color="var(--chart-track)" label="Silence" />
        {markers.length > 0 && (
          <>
            <LegendItem color="var(--met)" label="Strength" />
            <LegendItem color="var(--not-met)" label="Coaching" />
          </>
        )}
        {events.length > 0 && (
          <LegendItem color="var(--caution)" label="Dead air / overtalk" />
        )}
        {hasSentiment && (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span aria-hidden className="text-[var(--met)]">▲</span>
            <span className="text-[var(--muted)]">positive</span>
            <span aria-hidden className="text-[var(--not-met)]">▼</span>
            <span className="text-[var(--muted)]">negative</span>
          </span>
        )}
        {onSeek && (
          <span className="text-xs text-[var(--subtle)]">Click to jump</span>
        )}
      </figcaption>

      {hasSentiment && (
        <p className="mt-1.5 text-[11px] text-[var(--subtle)]">
          Sentiment is the transcription provider&rsquo;s own three-state
          classification, shown above or below the line — never rolled into a
          percentage of ours.
        </p>
      )}
    </figure>
  );
}
