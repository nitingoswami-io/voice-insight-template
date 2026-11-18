import { formatPassDate, type PassInfo } from "./pass";

/**
 * The disclaimer every metered demo shows under its masthead (docs/DEMO_ACCESS.md):
 * this runs on paid credit, here is how to get in, here is how to run it yourself.
 */
export function AccessNotice({
  providers,
  pass,
  repoUrl,
  onRequest,
  onSignOut,
}: {
  /** Who bills for this demo, e.g. "OpenAI". */
  providers: string;
  pass: PassInfo | null;
  repoUrl: string;
  onRequest: () => void;
  onSignOut?: () => void;
}) {
  return (
    <aside className="dl-notice" aria-label="About access to this live demo">
      <div className="dl-wrap dl-notice__inner">
        <span className="dl-label dl-notice__kicker">{pass ? "Access active" : "Live demo"}</span>
        {pass ? (
          <p className="dl-notice__text">
            Unlocked for <strong>{pass.email}</strong> until {formatPassDate(pass.expires)}. Thanks for trying it.
          </p>
        ) : (
          <p className="dl-notice__text">
            Runs on paid {providers} credit, so trying it needs a free access link sent to your email. Browsing is
            open to everyone.
          </p>
        )}
        <span className="dl-spacer" />
        {pass ? (
          onSignOut && (
            <button type="button" className="dl-notice__link" onClick={onSignOut}>
              Sign out
            </button>
          )
        ) : (
          <>
            <a className="dl-notice__link" href={`${repoUrl}#quick-start`}>
              Run it with your own key
            </a>
            <button type="button" className="dl-btn dl-btn--primary dl-notice__cta" onClick={onRequest}>
              Request access
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
