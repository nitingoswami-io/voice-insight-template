/**
 * Demo access pass helpers for the browser (see docs/DEMO_ACCESS.md).
 *
 * A pass is `v1.<payload>.<signature>`. Only the server can check the signature;
 * here we just read the payload to show who the pass is for and when it ends.
 */

/** Why the access dialog opened: no valid pass, or the provider is out of credit. */
export type AccessReason = "access_required" | "demo_unavailable";

export const ACCESS_CODES: readonly AccessReason[] = ["access_required", "demo_unavailable"];

export function isAccessReason(code: unknown): code is AccessReason {
  return code === "access_required" || code === "demo_unavailable";
}

export type PassInfo = { email: string; expires: Date };

/** Decode a pass for display. Returns null when malformed or already expired. */
export function readPass(token: string | null | undefined): PassInfo | null {
  if (!token) return null;
  const [version, payload] = token.split(".");
  if (version !== "v1" || !payload) return null;
  try {
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json) as { sub?: unknown; exp?: unknown };
    if (typeof data.sub !== "string" || typeof data.exp !== "number") return null;
    const expires = new Date(data.exp * 1000);
    return expires.getTime() > Date.now() ? { email: data.sub, expires } : null;
  } catch {
    return null;
  }
}

/** Pull a pass out of whatever was pasted: the whole emailed link, or the bare token. */
export function extractPass(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const fromUrl = new URL(text).searchParams.get("pass");
    if (fromUrl) return fromUrl;
  } catch {}
  return /^v1\.[\w-]+\.[\w-]+$/.test(text) ? text : null;
}

export function formatPassDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
