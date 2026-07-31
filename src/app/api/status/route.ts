import { NextResponse } from "next/server";
import { assemblyAi } from "@/lib/providers/asr-assemblyai";

/**
 * Cheap status check for the browser's polling loop.
 *
 * Polling rather than a webhook is what keeps this prototype free of a public
 * callback URL, a shared secret and an ngrok tunnel during development. The
 * client holds the transcript id between polls, so the server stays stateless
 * and there is no database.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    return NextResponse.json(await assemblyAi.status(id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 },
    );
  }
}
