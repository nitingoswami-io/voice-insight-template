import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { StageStrip, type Stage } from "./StageStrip";

/**
 * The demo masthead: a slim strip that ties the demo to The Inference Times,
 * then the demo's name, its dek, its pipeline and its links.
 *
 * Keep the dek to one sentence. The stages are the demo's real pipeline, in
 * data-flow order (the same five as the design doc's CoALA strip is fine).
 */
export type MastheadLink = { href: string; label: string };

export function Masthead({
  name,
  dek,
  stages,
  links,
  siteUrl,
  postUrl,
  homeHref = "/",
  status,
  titleAs = "h1",
}: {
  name: string;
  dek: string;
  stages?: Stage[];
  links?: MastheadLink[];
  /** The Inference Times home. Leave unset until the URL is confirmed. */
  siteUrl?: string;
  /** This demo's post on the site. */
  postUrl?: string;
  homeHref?: string;
  /** Short right-hand note, e.g. "Public demo · files up to 1.5 MB". */
  status?: ReactNode;
  /** Use "p" when the page has its own <h1>, so there is only one. */
  titleAs?: "h1" | "p";
}) {
  const Title = titleAs;
  return (
    <header className="dl-masthead">
      <div className="dl-wrap">
        <div className="dl-masthead__strip dl-label">
          {siteUrl ? <a href={siteUrl}>The Inference Times</a> : <span>The Inference Times</span>}
          <span aria-hidden>·</span>
          {postUrl ? <a href={postUrl}>Demo desk</a> : <span>Demo desk</span>}
          <span className="dl-spacer" />
          {status && <span>{status}</span>}
          <ThemeToggle />
        </div>
        <div className="dl-masthead__body">
          <a href={homeHref} style={{ color: "inherit", textDecoration: "none" }}>
            <Title className="dl-masthead__title">{name}</Title>
          </a>
          <p className="dl-masthead__dek">{dek}</p>
        </div>
        {Boolean(stages?.length || links?.length) && (
          <div className="dl-masthead__row">
            {stages && <StageStrip stages={stages} />}
            {links && (
              <nav className="dl-masthead__links" aria-label="Project links">
                {links.map((l) => (
                  <a key={l.href} href={l.href}>
                    {l.label}
                  </a>
                ))}
              </nav>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
