"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  AccessDialog,
  AccessNotice,
  isAccessReason,
  type AccessReason,
  type AccessRequest,
} from "@/components/demo-look";
import { PROJECT_NAME, REPO_URL } from "@/lib/site";

/**
 * Wires the shared access kit (docs/DEMO_ACCESS.md) to this app's transport:
 * an httpOnly cookie set by the server, so the browser never stores the pass.
 */

/** Thrown by `checkAccess` when a response asks for the access dialog. */
export class AccessNeeded extends Error {
  constructor(
    readonly reason: AccessReason,
    message: string,
  ) {
    super(message);
  }
}

/** Throw `AccessNeeded` if a JSON error body carries an access code. */
export function checkAccess(payload: unknown) {
  const code = (payload as { code?: unknown } | null)?.code;
  if (isAccessReason(code)) {
    const message = (payload as { error?: unknown }).error;
    throw new AccessNeeded(code, typeof message === "string" ? message : code);
  }
}

type Ctx = {
  open: (reason: AccessReason) => void;
  /** True if a metered call may go ahead; otherwise opens the dialog and returns false. */
  ensure: () => boolean;
};
const AccessContext = createContext<Ctx>({ open: () => {}, ensure: () => true });

/** The access dialog for this page. Outside the provider, everything is allowed. */
export function useDemoAccess(): Ctx {
  return useContext(AccessContext);
}

async function requestLink(req: AccessRequest) {
  const res = await fetch("/api/access/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof body.error === "string" ? body.error : "Could not send the link.");
  }
}

/** Hand a pasted pass to the server, which sets the cookie and comes back here. */
function submitPastedPass(token: string): boolean {
  const next = window.location.pathname + window.location.search;
  window.location.assign(
    `/unlock?pass=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`,
  );
  return true;
}

export function DemoAccessProvider({
  providers,
  gated,
  holder,
  passDays,
  children,
}: {
  /** Who bills for this page, e.g. "AssemblyAI and xAI". */
  providers: string;
  /** Whether the gate is on here; the notice only shows when it is. */
  gated: boolean;
  /** Who the cookie's pass is for, verified on the server. The token itself stays httpOnly. */
  holder: { email: string; exp: number } | null;
  passDays: number;
  children: ReactNode;
}) {
  const [reason, setReason] = useState<AccessReason | null>(null);
  const pass = holder ? { email: holder.email, expires: new Date(holder.exp * 1000) } : null;
  const locked = gated && pass === null;
  const open = useCallback((r: AccessReason) => setReason(r), []);
  const ctx = useMemo(
    () => ({
      open,
      ensure: () => {
        if (locked) open("access_required");
        return !locked;
      },
    }),
    [open, locked],
  );

  async function signOut() {
    await fetch("/api/access", { method: "DELETE" }).catch(() => {});
    window.location.reload();
  }

  return (
    <AccessContext.Provider value={ctx}>
      {gated && (
        // The notice brings its own .dl-wrap; inside <main> it lines up with the content instead.
        <div className="mt-4 [&_.dl-notice__inner]:px-3">
          <AccessNotice
            providers={providers}
            pass={pass}
            repoUrl={REPO_URL}
            onRequest={() => open("access_required")}
            onSignOut={pass ? signOut : undefined}
          />
        </div>
      )}
      {children}
      <AccessDialog
        open={reason !== null}
        reason={reason ?? "access_required"}
        demoName={PROJECT_NAME}
        providers={providers}
        repoUrl={REPO_URL}
        passDays={passDays}
        onClose={() => setReason(null)}
        onRequest={requestLink}
        onPass={submitPastedPass}
      />
    </AccessContext.Provider>
  );
}
