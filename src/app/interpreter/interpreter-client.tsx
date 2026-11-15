"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Direction = "hi->en" | "en->hi";

type SideKey = "hindi" | "english";

interface SideConfig {
  key: SideKey;
  label: string;
  sublabel: string;
  speaks: "Hindi" | "English";
  direction: Direction;
  accent: string;
}

const SIDES: SideConfig[] = [
  {
    key: "hindi",
    label: "Caller",
    sublabel: "हिन्दी बोलने वाला",
    speaks: "Hindi",
    direction: "hi->en",
    accent: "var(--series-1)",
  },
  {
    key: "english",
    label: "Restaurant",
    sublabel: "English speaker",
    speaks: "English",
    direction: "en->hi",
    accent: "var(--series-2)",
  },
];

interface Turn {
  direction: Direction;
  sourceTranscript: string;
  translation: string;
  audioUrl: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "recording"; side: SideKey }
  | { kind: "processing"; side: SideKey }
  | { kind: "error"; side: SideKey; message: string };

export function InterpreterClient() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [lastTurn, setLastTurn] = useState<Turn | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Autoplay the most recent translation on the opposite side.
  useEffect(() => {
    if (lastTurn && audioElRef.current) {
      audioElRef.current.src = lastTurn.audioUrl;
      audioElRef.current.play().catch(() => {
        // Some browsers block autoplay without a gesture. The user
        // can still hit the play control on the element itself.
      });
    }
  }, [lastTurn]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const beginRecording = useCallback(
    async (side: SideConfig) => {
      if (status.kind !== "idle" && status.kind !== "error") return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        chunksRef.current = [];

        const mime = pickMimeType();
        const recorder = new MediaRecorder(
          stream,
          mime ? { mimeType: mime } : undefined,
        );
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          stopTracks();
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          chunksRef.current = [];
          if (blob.size < 500) {
            setStatus({
              kind: "error",
              side: side.key,
              message: "Too short — hold the button and speak for at least a second.",
            });
            return;
          }
          setStatus({ kind: "processing", side: side.key });
          try {
            const turn = await uploadAndTranslate(blob, side.direction);
            setLastTurn(turn);
            setHistory((h) => [...h, turn]);
            setStatus({ kind: "idle" });
          } catch (e) {
            setStatus({
              kind: "error",
              side: side.key,
              message: e instanceof Error ? e.message : "Pipeline failed.",
            });
          }
        };

        recorder.start();
        setStatus({ kind: "recording", side: side.key });
      } catch (e) {
        setStatus({
          kind: "error",
          side: side.key,
          message:
            e instanceof Error
              ? `Microphone unavailable: ${e.message}`
              : "Microphone unavailable.",
        });
      }
    },
    [status, stopTracks],
  );

  const endRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {SIDES.map((side) => {
        const isRecording =
          status.kind === "recording" && status.side === side.key;
        const isProcessing =
          status.kind === "processing" && status.side === side.key;
        const isError = status.kind === "error" && status.side === side.key;
        const disabled =
          (status.kind === "recording" && status.side !== side.key) ||
          (status.kind === "processing" && status.side !== side.key);

        const theirTranslation =
          lastTurn && lastTurn.direction !== side.direction
            ? lastTurn
            : null;

        return (
          <section
            key={side.key}
            className="dl-panel flex flex-col"
            style={{ borderTopColor: side.accent }}
          >
            <header className="dl-panel__head">
              <div>
                <h2 className="dl-panel__title">{side.label}</h2>
                <p className="dl-panel__desc">
                  {side.sublabel} · speaks {side.speaks}
                </p>
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 p-4">
              <HoldButton
                side={side}
                isRecording={isRecording}
                isProcessing={isProcessing}
                disabled={disabled}
                onPress={() => void beginRecording(side)}
                onRelease={endRecording}
              />

              {theirTranslation && (
                <IncomingBlock
                  direction={theirTranslation.direction}
                  sourceTranscript={theirTranslation.sourceTranscript}
                  translation={theirTranslation.translation}
                />
              )}

              {isError && (
                <p
                  role="alert"
                  className="rounded border border-[var(--bad)] bg-[var(--bad-soft)] px-3 py-2 text-sm text-[var(--bad)]"
                >
                  {status.message}
                </p>
              )}
            </div>
          </section>
        );
      })}

      <section className="dl-panel md:col-span-2">
        <header className="dl-panel__head">
          <div>
            <h2 className="dl-panel__title">Pipeline output</h2>
            <p className="dl-panel__desc">
              Whisper transcript → GPT-4o-mini translation → ElevenLabs audio
            </p>
          </div>
        </header>
        <div className="p-4">
          <audio ref={audioElRef} controls className="w-full" />
          {!lastTurn && (
            <p className="mt-3 text-sm text-[var(--ink-3)]">
              Hold either button to record. The latest translation will play here
              and populate the opposite card.
            </p>
          )}
          {history.length > 0 && (
            <ol className="mt-4 space-y-3 text-sm">
              {history
                .slice()
                .reverse()
                .map((turn, i) => (
                  <li
                    key={history.length - i}
                    className="rounded border border-[var(--rule-soft)] p-3"
                  >
                    <p className="text-xs uppercase tracking-widest text-[var(--ink-3)]">
                      {turn.direction === "hi->en"
                        ? "Caller → Restaurant"
                        : "Restaurant → Caller"}
                    </p>
                    <p className="mt-1">
                      <span className="text-[var(--ink-3)]">heard:</span>{" "}
                      {turn.sourceTranscript}
                    </p>
                    <p>
                      <span className="text-[var(--ink-3)]">said:</span>{" "}
                      {turn.translation}
                    </p>
                  </li>
                ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}

function HoldButton({
  side,
  isRecording,
  isProcessing,
  disabled,
  onPress,
  onRelease,
}: {
  side: SideConfig;
  isRecording: boolean;
  isProcessing: boolean;
  disabled: boolean;
  onPress: () => void;
  onRelease: () => void;
}) {
  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || isProcessing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onPress();
  };
  const handlePointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onRelease();
  };

  const label = isProcessing
    ? "Translating…"
    : isRecording
      ? "Release to send"
      : `Hold to speak ${side.speaks}`;

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={(e) => {
        if (isRecording) handlePointerUp(e);
      }}
      disabled={disabled || isProcessing}
      aria-pressed={isRecording}
      className="relative flex min-h-[7rem] w-full items-center justify-center rounded border-2 px-4 py-6 text-lg font-medium transition select-none disabled:opacity-50"
      style={{
        borderColor: isRecording ? "var(--news-red)" : side.accent,
        background: isRecording ? "var(--news-red-soft)" : "transparent",
        color: isRecording ? "var(--news-red-2)" : "var(--ink)",
        touchAction: "none",
      }}
    >
      {isRecording && (
        <span
          aria-hidden
          className="absolute left-4 inline-block h-3 w-3 animate-pulse rounded-full"
          style={{ background: "var(--news-red)" }}
        />
      )}
      {label}
    </button>
  );
}

function IncomingBlock({
  direction,
  sourceTranscript,
  translation,
}: {
  direction: Direction;
  sourceTranscript: string;
  translation: string;
}) {
  const sourceLang = direction === "hi->en" ? "Hindi" : "English";
  const targetLang = direction === "hi->en" ? "English" : "Hindi";
  return (
    <div className="rounded border border-[var(--rule-soft)] bg-[var(--surface)] p-3 text-sm">
      <p className="text-xs uppercase tracking-widest text-[var(--ink-3)]">
        Incoming · {sourceLang} → {targetLang}
      </p>
      <p className="mt-2 text-[var(--ink-2)]">
        <span className="text-[var(--ink-3)]">they said ({sourceLang}):</span>{" "}
        {sourceTranscript}
      </p>
      <p className="mt-1 text-[var(--ink)]">
        <span className="text-[var(--ink-3)]">you hear ({targetLang}):</span>{" "}
        {translation}
      </p>
    </div>
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

async function uploadAndTranslate(
  blob: Blob,
  direction: Direction,
): Promise<Turn> {
  const ext = blob.type.includes("mp4")
    ? "m4a"
    : blob.type.includes("ogg")
      ? "ogg"
      : "webm";
  const form = new FormData();
  form.append("audio", new File([blob], `utterance.${ext}`, { type: blob.type }));
  form.append("direction", direction);

  const res = await fetch("/api/interpreter/translate", {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as
    | {
        direction: Direction;
        sourceTranscript: string;
        translation: string;
        audioBase64: string;
        audioMimeType: string;
      }
    | { error: string };

  if (!res.ok || "error" in data) {
    throw new Error("error" in data ? data.error : `Request failed (${res.status}).`);
  }

  const audioUrl = `data:${data.audioMimeType};base64,${data.audioBase64}`;
  return {
    direction: data.direction,
    sourceTranscript: data.sourceTranscript,
    translation: data.translation,
    audioUrl,
  };
}
