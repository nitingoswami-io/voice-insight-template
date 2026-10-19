/**
 * Upload size limits, shared by the server routes and the browser.
 *
 * Kept free of server-only imports so the client bundle can use it too.
 */

/** Vercel caps a function's request body at 4.5 MB, and the audio flows through one. */
export const PLATFORM_MAX_BYTES = 4.5 * 1024 * 1024;

export function formatMb(bytes: number): string {
  return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
}
