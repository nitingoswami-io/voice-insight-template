/** The pipeline as a row of small-caps stages. Mark the running stage active. */
export type Stage = { label: string; active?: boolean };

export function StageStrip({ stages }: { stages: Stage[] }) {
  return (
    <ol className="dl-stages" aria-label="Pipeline">
      {stages.map((s) => (
        <li key={s.label}>
          <span className="dl-stage" data-active={s.active ? "true" : undefined}>
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
