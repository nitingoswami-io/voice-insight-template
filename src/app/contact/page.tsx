import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { configuredChannel } from "@/lib/contact";
import { CONTACT_ENABLED } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact — Lisn10",
  description: "Talk to us about call quality analysis for your floor.",
};

export default function ContactPage() {
  // Hidden rather than deleted. Without the form this page offers no way to make
  // contact, so it 404s as a whole instead of standing as a dead end.
  if (!CONTACT_ENABLED) notFound();

  const channel = configuredChannel();

  return (
    <div className="py-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Talk to us</h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--muted)]">
            Tell us about your floor — the languages your agents work in, roughly
            how many calls you handle, and how quality is reviewed today. We will
            come back to you on the number or email you leave.
          </p>

          <dl className="mt-10 space-y-6">
            {[
              [
                "Pricing",
                "Usage-based, and we would rather quote against your real call mix than post a number that turns out to be wrong for you.",
              ],
              [
                "Trying it first",
                "The demo runs a real recording end to end. No account, no integration, nothing to install.",
              ],
              [
                "Your recordings",
                "Nothing is stored by this prototype. Audio is transcribed and the result lives in your browser session only.",
              ],
            ].map(([term, detail]) => (
              <div key={term}>
                <dt className="text-sm font-medium">{term}</dt>
                <dd className="mt-1 max-w-md text-[13px] leading-relaxed text-[var(--muted)]">
                  {detail}
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href="/demo"
            className="mt-10 inline-block rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm transition-colors hover:bg-[var(--accent-soft)]"
          >
            Try the demo first →
          </Link>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          {channel === null && (
            <p className="mb-6 rounded-md border border-[var(--caution)] bg-[var(--caution-soft)] px-3 py-2.5 text-xs leading-relaxed text-[var(--caution)]">
              <strong>Not yet connected.</strong> No delivery channel is
              configured, so this form cannot reach anyone — submissions will be
              refused rather than silently dropped. Set{" "}
              <code className="font-mono">CONTACT_WEBHOOK_URL</code>, or{" "}
              <code className="font-mono">BREVO_API_KEY</code> with{" "}
              <code className="font-mono">CONTACT_TO_EMAIL</code>.
            </p>
          )}
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
