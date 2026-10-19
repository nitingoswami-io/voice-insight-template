import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assemblyAi } from "@/lib/providers/asr-assemblyai";
import {
  ACCESS_COOKIE,
  accessConfigured,
  uploadLimitFor,
} from "@/lib/access";
import { PLATFORM_MAX_BYTES, formatMb } from "@/lib/limits";

export const maxDuration = 60;

/**
 * Accept the raw audio and start transcription.
 *
 * The bytes are relayed straight to AssemblyAI, which holds them long enough to
 * transcribe. Nothing is stored on our side — the browser keeps its own copy of
 * the file for playback via an object URL, so there is no storage service in
 * this prototype at all.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "audio/mpeg";
    const audio = await request.arrayBuffer();

    if (audio.byteLength === 0) {
      return NextResponse.json({ error: "No audio received" }, { status: 400 });
    }
    // Enforced here, not only in the browser: the client check is a
    // convenience, and anyone can call this route directly.
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    const limit = await uploadLimitFor(token);
    if (audio.byteLength > limit) {
      const size = formatMb(audio.byteLength);
      const error =
        limit < PLATFORM_MAX_BYTES
          ? `That file is ${size}. The public demo accepts up to ${formatMb(limit)} to keep API costs bounded.` +
            (accessConfigured()
              ? " An access code lifts this to 4.5 MB."
              : "") +
            " Or clone the repository and run it with your own keys."
          : `That file is ${size}. This template relays audio through a serverless function, which caps request bodies at 4.5 MB. Use a compressed copy (mono MP3 at 32-64 kbps holds roughly 9-18 minutes).`;
      return NextResponse.json({ error }, { status: 413 });
    }

    const audioUrl = await assemblyAi.upload(audio, contentType);
    const { providerId } = await assemblyAi.submit(audioUrl);

    return NextResponse.json({ id: providerId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start transcription" },
      { status: 500 },
    );
  }
}
