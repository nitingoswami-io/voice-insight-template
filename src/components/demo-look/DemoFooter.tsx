import { SITE_URL } from "./Masthead";

/** The same closing line on every demo: how to read it, get it and reuse it. */
export function DemoFooter({
  name,
  repoUrl,
  designDocUrl,
  license = "MIT",
  author = "Nitin Goswami",
  siteUrl = SITE_URL,
}: {
  name: string;
  repoUrl: string;
  designDocUrl?: string;
  license?: string;
  author?: string;
  siteUrl?: string;
}) {
  return (
    <footer className="dl-footer">
      <div className="dl-wrap dl-footer__inner">
        <span className="dl-label">
          {name} · a learning demo by <a href={siteUrl}>{author}</a>
        </span>
        <span className="dl-spacer" />
        <a href={`${siteUrl}/demos`}>More demos</a>
        {designDocUrl && <a href={designDocUrl}>Read the design doc</a>}
        <a href={repoUrl}>Source</a>
        <a href={`${repoUrl}/fork`}>Fork</a>
        <a href={`${repoUrl}/blob/main/LICENSE`}>{license} licence</a>
      </div>
    </footer>
  );
}
