/** The same closing line on every demo: how to read it, get it and reuse it. */
export function DemoFooter({
  name,
  repoUrl,
  designDocUrl,
  license = "MIT",
  author = "Nitin Goswami",
}: {
  name: string;
  repoUrl: string;
  designDocUrl?: string;
  license?: string;
  author?: string;
}) {
  return (
    <footer className="dl-footer">
      <div className="dl-wrap dl-footer__inner">
        <span className="dl-label">{name} · a learning demo by {author}</span>
        <span className="dl-spacer" />
        {designDocUrl && <a href={designDocUrl}>Read the design doc</a>}
        <a href={repoUrl}>Source</a>
        <a href={`${repoUrl}/fork`}>Fork</a>
        <a href={`${repoUrl}/blob/main/LICENSE`}>{license} licence</a>
      </div>
    </footer>
  );
}
