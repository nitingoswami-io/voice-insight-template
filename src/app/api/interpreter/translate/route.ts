import { NextResponse } from "next/server";
import { interpret, type Direction } from "@/lib/interpreter/pipeline";
import { PLATFORM_MAX_BYTES, formatMb } from "@/lib/limits";

export const maxDuration = 60;

/**
 * Run one hop of the Hindi↔English interpreter.
 *
 * Multipart form in:
 *   - audio:     the recorded utterance (any format Whisper accepts)
 *   - direction: "hi->en" | "en->hi"
 *
 * JSON out:
 *   - sourceTranscript: what Whisper heard
 *   - translation:      what the other side will hear, as text
 *   - audioBase64:      the same translation as MP3 bytes (base64), ready to
 *                       drop into an <audio src="data:audio/mpeg;base64,..." />.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with 'audio' and 'direction'." },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  const direction = form.get("direction");

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "Missing or empty 'audio' file." }, { status: 400 });
  }
  if (direction !== "hi->en" && direction !== "en->hi") {
    return NextResponse.json(
      { error: "Field 'direction' must be 'hi->en' or 'en->hi'." },
      { status: 400 },
    );
  }
  if (audio.size > PLATFORM_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Recording is ${formatMb(audio.size)}. The function request body caps at ${formatMb(PLATFORM_MAX_BYTES)}. Keep utterances under ~45s or use a lower-bitrate recorder.`,
      },
      { status: 413 },
    );
  }

  try {
    const result = await interpret({ audio, direction: direction as Direction });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Interpreter pipeline failed.",
      },
      { status: 500 },
    );
  }
}
