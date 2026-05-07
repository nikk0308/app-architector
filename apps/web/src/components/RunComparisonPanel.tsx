import type { RunComparison } from "@mag/shared";

interface RunComparisonPanelProps {
  comparison: RunComparison | null;
  selectedCount: number;
  loading: boolean;
  error: string | null;
  labels?: {
    empty: string;
    loading: string;
    title: string;
    strongest: string;
    runs?: string;
    run?: string;
    mode?: string;
    platform?: string;
    files?: string;
    artifacts?: string;
    warnings?: string;
    time?: string;
    currentSelection?: string;
    generationTime?: string;
  };
}

function formatMs(value?: number): string {
  if (!value) return "0 ms";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}

function score(run: RunComparison["runs"][number]): number {
  const metrics = run.metrics;
  if (!metrics) return 0;
  return metrics.fileCount + metrics.artifactCount * 2 - metrics.warningCount * 4 + (metrics.zipAvailable ? 8 : 0);
}

export function RunComparisonPanel({ comparison, selectedCount, loading, error, labels }: RunComparisonPanelProps) {
  const text = labels ?? {
    empty: "Select at least two runs to compare.",
    loading: "Building comparison...",
    title: "Run comparison",
    strongest: "Most complete run",
    runs: "runs",
    run: "Run",
    mode: "Mode",
    platform: "Platform",
    files: "Files",
    artifacts: "Artifacts",
    warnings: "Warnings",
    time: "Time",
    currentSelection: "Current selection",
    generationTime: "Generation time"
  };

  if (loading) {
    return <div className="empty-state">{text.loading}</div>;
  }

  if (error) {
    return <div className="empty-state error-muted">{error}</div>;
  }

  if (!comparison) {
    return <div className="empty-state">{text.empty} {text.currentSelection}: {selectedCount}.</div>;
  }

  const strongest = [...comparison.runs].sort((left, right) => score(right) - score(left))[0];
  const maxFiles = Math.max(1, ...comparison.runs.map((run) => run.metrics?.fileCount ?? 0));
  const maxTime = Math.max(1, ...comparison.runs.map((run) => run.metrics?.generationTimeMs ?? 0));

  return (
    <div className="comparison-panel redesigned-panel">
      <div className="section-head">
        <div>
          <span className="kicker">{text.title}</span>
          <h2>{comparison.runs.length} {text.runs}</h2>
        </div>
        {strongest ? <span className="status-pill">{text.strongest}: {strongest.projectName}</span> : null}
      </div>

      <div className="compare-table">
        <div className="compare-row compare-head">
          <span>{text.run}</span>
          <span>{text.mode}</span>
          <span>{text.platform}</span>
          <span>{text.files}</span>
          <span>{text.artifacts}</span>
          <span>{text.warnings}</span>
          <span>{text.time}</span>
        </div>
        {comparison.runs.map((run) => (
          <div className={run.id === strongest?.id ? "compare-row strongest-row" : "compare-row"} key={run.id}>
            <strong>{run.projectName}</strong>
            <span>{run.mode}</span>
            <span>{run.profileId}</span>
            <span>{run.metrics?.fileCount ?? "-"}</span>
            <span>{run.metrics?.artifactCount ?? "-"}</span>
            <span className={(run.metrics?.warningCount ?? 0) > 0 ? "warn-text" : ""}>{run.metrics?.warningCount ?? "-"}</span>
            <span>{formatMs(run.metrics?.generationTimeMs)}</span>
          </div>
        ))}
      </div>

      <div className="compare-bars">
        {comparison.runs.map((run) => (
          <div className="compare-bar-card" key={`${run.id}:bars`}>
            <strong>{run.projectName}</strong>
            <span>{text.files}</span>
            <i style={{ width: `${((run.metrics?.fileCount ?? 0) / maxFiles) * 100}%` }} />
            <span>{text.generationTime}</span>
            <i className="info-bar" style={{ width: `${((run.metrics?.generationTimeMs ?? 0) / maxTime) * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
