import { NextResponse } from "next/server";
import { assemblyAi } from "@/lib/providers/asr-assemblyai";

export const maxDuration = 60;

/** Vercel caps function request bodies at 4.5 MB, and the audio flows through here. */
const MAX_BYTES = 4.5 * 1024 * 1024;

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
    if (audio.byteLength > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `That file is ${(audio.byteLength / 1024 / 1024).toFixed(1)} MB. This prototype relays audio through a serverless function, which caps request bodies at 4.5 MB. Use a compressed copy (mono MP3 at 32-64 kbps holds roughly 9-18 minutes).`,
        },
        { status: 413 },
      );
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
