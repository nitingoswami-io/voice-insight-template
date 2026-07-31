import Link from "next/link";
import { UnlockForm } from "@/components/unlock-form";
import { accessConfigured, safeNext } from "@/lib/access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Unlock the demo — Lisn10",
};

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;

  const destination = safeNext(next);

  const configured = accessConfigured();

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-24">
      <h1 className="text-2xl font-medium tracking-tight">Demo access</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
        The demo transcribes and analyses real audio, so it is kept behind a
        code. Ask whoever shared this link, and they will have one.
      </p>

      <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        {configured ? (
          <UnlockForm next={destination} />
        ) : (
          <p className="text-xs leading-relaxed text-[var(--caution)]">
            <strong>This deployment is locked.</strong> No access code is
            configured on the server, so nothing will open it. Set{" "}
            <code className="font-mono">ACCESS_CODE</code> in the hosting
            environment and redeploy. It stays shut rather than leaving paid
            endpoints open to anyone who finds the URL.
          </p>
        )}
        {reason === "unconfigured" && configured && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            A code has since been configured — try it above.
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--subtle)]">
        Nothing else is gated —{" "}
        <Link href="/" className="text-[var(--accent)] hover:underline">
          the overview
        </Link>{" "}
        and{" "}
        <Link href="/contact" className="text-[var(--accent)] hover:underline">
          contact
        </Link>{" "}
        are open to everyone.
      </p>
    </div>
  );
}
