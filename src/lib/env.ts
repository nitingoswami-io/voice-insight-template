/**
 * Environment access.
 *
 * Lazy on purpose: reading a missing key throws where it is used, not at import
 * time, so `next build` in an environment without secrets still succeeds.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

export const env = {
  get assemblyAiKey() {
    return required("ASSEMBLYAI_API_KEY");
  },
  get xaiKey() {
    return required("XAI_API_KEY");
  },
} as const;

/** Model used for call analysis. */
export const ANALYSIS_MODEL = process.env.XAI_MODEL ?? "grok-4.5";
