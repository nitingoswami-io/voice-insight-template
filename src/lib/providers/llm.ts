import OpenAI from "openai";
import { env } from "@/lib/env";

/**
 * LLM provider.
 *
 * xAI exposes an OpenAI-compatible surface, so the official OpenAI SDK works
 * against `api.x.ai/v1`. Kept behind this module so a self-hosted open-weight
 * endpoint (vLLM speaks the same protocol) is a base-URL change — useful when
 * transcripts must not leave your own infrastructure.
 */

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: env.xaiKey,
      baseURL: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
    });
  }
  return client;
}

export type StructuredCallParams = {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
};

/** Call the model and return raw JSON text conforming to `jsonSchema`. */
export async function structuredCall(
  params: StructuredCallParams,
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: params.model,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    // Deterministic-leaning: this is a scoring task, not a creative one, and
    // reruns of the same call should not drift.
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: params.schemaName,
        strict: true,
        schema: params.jsonSchema,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Model returned an empty response");
  }
  return content;
}
