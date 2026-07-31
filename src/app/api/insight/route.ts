import { NextResponse } from "next/server";
import { assemblyAi } from "@/lib/providers/asr-assemblyai";
import { analyseCall } from "@/lib/analysis/run";
import { guessAgentSpeaker } from "@/lib/metrics";

export const maxDuration = 300;

/**
 * Fetch the finished transcript and analyse it.
 *
 * Called once, after polling reports the transcript is ready, so this is the
 * only long request in the app (~20s for the model call) and it still sits well
 * inside the platform's limit.
 */
export async function POST(request: Request) {
  let id: string | undefined;
  try {
    ({ id } = (await request.json()) as { id?: string });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const transcript = await assemblyAi.fetchResult(id);

    if (transcript.utterances.length === 0) {
      return NextResponse.json(
        {
          error:
            "No speech was detected in this recording, so there is nothing to analyse.",
        },
        { status: 422 },
      );
    }

    const agentSpeakerLabel = guessAgentSpeaker(transcript.words);

    const analysis = await analyseCall({
      utterances: transcript.utterances,
      words: transcript.words,
      agentSpeakerLabel,
      languageCode: transcript.languageCode,
      durationMs: transcript.durationMs,
    });

    return NextResponse.json({
      transcript: {
        utterances: transcript.utterances,
        words: transcript.words,
        sentimentSegments: transcript.sentimentSegments,
        languageCode: transcript.languageCode,
        languageConfidence: transcript.languageConfidence,
        durationMs: transcript.durationMs,
        agentSpeakerLabel,
      },
      ...analysis,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
