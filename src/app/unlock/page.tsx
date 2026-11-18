import Link from "next/link";
import { redirect } from "next/navigation";
import { RequestLinkForm } from "@/components/request-link-form";
import { UnlockForm } from "@/components/unlock-form";
import {
  accessConfigured,
  emailAccessConfigured,
  gateConfigured,
  publicMaxBytes,
  safeNext,
} from "@/lib/access";
import { passDays } from "@/lib/demo-pass";
import { formatMb } from "@/lib/limits";
import { PROJECT_NAME, REPO_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Demo access — ${PROJECT_NAME}`,
};

/**
 * Where access links land and where visitors ask for one (docs/DEMO_ACCESS.md).
 *
 * `?pass=` is handed to /api/access/pass, because only a route handler can set
 * the httpOnly cookie.
 */
export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; pass?: string; expired?: string }>;
}) {
  const { next, pass, expired } = await searchParams;
  const destination = safeNext(next);

  if (pass) {
    redirect(
      `/api/access/pass?pass=${encodeURIComponent(pass)}&next=${encodeURIComponent(destination)}`,
    );
  }

  const byEmail = emailAccessConfigured();
  const byCode = accessConfigured();
  const publicCap = publicMaxBytes();

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-16">
      <span className="dl-label dl-dialog__kicker">Request access</span>
      <h1 className="dl-dialog__title">Get a link to the live demo</h1>
      <p className="dl-dialog__body">
        {publicCap !== null
          ? `The public demo is open to everyone, with files up to ${formatMb(publicCap)}. An access link lifts that to 4.5 MB.`
          : "The live demo runs on paid AssemblyAI, xAI, OpenAI and ElevenLabs credit, so trying it needs a free access link."}{" "}
        Browsing the overview and the sample output is open to everyone.
      </p>

      {expired && (
        <p className="dl-dialog__error mb-4" role="alert">
          That link has expired or is not valid. Request a new one below.
        </p>
      )}

      <div className="dl-panel p-6">
        {byEmail ? (
          <RequestLinkForm passDays={passDays()} />
        ) : gateConfigured() ? (
          <p className="dl-dialog__body">
            Email links are not set up on this deployment. Ask whoever runs it for the access code.
          </p>
        ) : (
          <p className="dl-dialog__body">
            No access gate is set here, so the demo is open.{" "}
            <Link href="/demo">Go to the demo →</Link>
          </p>
        )}

        {byCode && (
          <details className="dl-dialog__paste" open={!byEmail}>
            <summary>Have an access code?</summary>
            <UnlockForm next={destination} />
          </details>
        )}
      </div>

      <p className="dl-dialog__fine">
        Rather use your own keys? <a href={REPO_URL}>Clone the repository and run it yourself</a>.
      </p>
    </div>
  );
}
