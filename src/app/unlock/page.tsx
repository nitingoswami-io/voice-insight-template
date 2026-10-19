import Link from "next/link";
import { UnlockForm } from "@/components/unlock-form";
import { accessConfigured, safeNext } from "@/lib/access";
import { PROJECT_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Unlock the demo — ${PROJECT_NAME}`,
};

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  const destination = safeNext(next);

  const configured = accessConfigured();

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-24">
      <h1 className="text-2xl font-medium tracking-tight">Demo access</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
        This deployment has an access code set, because the demo spends real
        API credit on every call. Ask whoever runs it for the code — or clone
        the repository and run it yourself with your own keys.
      </p>

      <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        {configured ? (
          <UnlockForm next={destination} />
        ) : (
          <p className="text-[13px] leading-relaxed text-[var(--muted)]">
            No <code className="font-mono">ACCESS_CODE</code> is set here, so
            the demo is open.{" "}
            <Link href="/demo" className="text-[var(--accent)] hover:underline">
              Go to the demo →
            </Link>
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--subtle)]">
        Only the demo and its API routes are ever gated —{" "}
        <Link href="/" className="text-[var(--accent)] hover:underline">
          the overview
        </Link>{" "}
        is open to everyone.
      </p>
    </div>
  );
}
