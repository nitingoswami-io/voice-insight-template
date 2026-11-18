import { NextResponse } from "next/server";
import { providerErrorResponse } from "@/lib/provider-errors";
import { cookies } from "next/headers";
import { interpret } from "@/lib/interpreter/pipeline";
import { LANG_CODES, isLangCode } from "@/lib/interpreter/languages";
import { ACCESS_COOKIE, uploadLimitFor } from "@/lib/access";
import { formatMb } from "@/lib/limits";

export const maxDuration = 60;

/**
 * Run one hop of the voice interpreter.
 *
 * Multipart form in:
 *   - audio:  the recorded utterance (any format Whisper accepts)
 *   - source: language spoken in the audio, e.g. "hi" | "fr" | "en"
 *   - target: language the other side hears; must differ from `source`
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
      { error: "Expected multipart/form-data with 'audio', 'source' and 'target'." },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  const source = form.get("source");
  const target = form.get("target");

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "Missing or empty 'audio' file." }, { status: 400 });
  }
  if (!isLangCode(source) || !isLangCode(target) || source === target) {
    return NextResponse.json(
      {
        error: `Fields 'source' and 'target' must be two different languages from: ${LANG_CODES.join(", ")}.`,
      },
      { status: 400 },
    );
  }
  // Same cap as the analyzer: public mode bounds what an anonymous visitor
  // can send, a valid access cookie lifts it to the platform limit.
  const limit = await uploadLimitFor((await cookies()).get(ACCESS_COOKIE)?.value);
  if (audio.size > limit) {
    return NextResponse.json(
      {
        error: `Recording is ${formatMb(audio.size)}; the limit is ${formatMb(limit)}. Keep utterances short (a few sentences).`,
      },
      { status: 413 },
    );
  }

  try {
    const result = await interpret({ audio, source, target });
    return NextResponse.json(result);
  } catch (error) {
    return providerErrorResponse(error, "OpenAI or ElevenLabs", "Interpreter pipeline failed.");
  }
}
