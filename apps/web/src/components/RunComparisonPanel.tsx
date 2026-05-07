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
    fileCoverage?: string;
    moduleCoverage?: string;
    docsRatio?: string;
    warningsCleanliness?: string;
    validation?: string;
    architectureCompleteness?: string;
    hint?: string;
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

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function validationScore(status?: string): number {
  if (status === "passed") return 100;
  if (status === "passed_with_warnings") return 70;
  if (status === "failed") return 25;
  return 60;
}

function metricsFor(run: RunComparison["runs"][number], maxFiles: number) {
  const metrics = run.metrics;
  const fileCoverage = clamp(((metrics?.fileCount ?? 0) / Math.max(1, maxFiles)) * 100);
  const moduleCoverage = clamp(((metrics?.artifactCount ?? 0) / 32) * 100);
  const docsRatio = clamp((((metrics?.artifactCount ?? 0) > 0 ? Math.min(0.15, 3 / Math.max(1, metrics?.fileCount ?? 1)) : 0) / 0.15) * 100);
  const warningsCleanliness = clamp(100 - (metrics?.warningCount ?? 0) * 14);
  const validation = validationScore(metrics?.validationStatus);
  const architectureCompleteness = clamp((fileCoverage + moduleCoverage + warningsCleanliness + validation + (metrics?.zipAvailable ? 100 : 0)) / 5);
  return { fileCoverage, moduleCoverage, docsRatio, warningsCleanliness, validation, architectureCompleteness };
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
    generationTime: "Generation time",
    fileCoverage: "File coverage",
    moduleCoverage: "Module coverage",
    docsRatio: "Docs ratio",
    warningsCleanliness: "Warnings cleanliness",
    validation: "Validation",
    architectureCompleteness: "Architecture completeness",
    hint: "These are heuristic UI metrics for comparing starter-package completeness."
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
  const metricLabels = [
    ["fileCoverage", text.fileCoverage],
    ["moduleCoverage", text.moduleCoverage],
    ["docsRatio", text.docsRatio],
    ["warningsCleanliness", text.warningsCleanliness],
    ["validation", text.validation],
    ["architectureCompleteness", text.architectureCompleteness]
  ] as const;

  return (
    <div className="comparison-panel redesigned-panel">
      <div className="section-head">
        <div>
          <span className="kicker">{text.title}</span>
          <h2>{comparison.runs.length} {text.runs}</h2>
        </div>
        {strongest ? <span className="status-pill">{text.strongest}: {strongest.projectName} · {strongest.profileId}</span> : null}
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
            <strong>{run.projectName} · {run.profileId}</strong>
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
            <strong>{run.projectName} · {run.profileId}</strong>
            <span>{text.files}</span>
            <i style={{ width: `${((run.metrics?.fileCount ?? 0) / maxFiles) * 100}%` }} />
            <span>{text.generationTime}</span>
            <i className="info-bar" style={{ width: `${((run.metrics?.generationTimeMs ?? 0) / maxTime) * 100}%` }} />
          </div>
        ))}
      </div>

      <p className="quiet-note">{text.hint}</p>
      <div className="evaluation-grid">
        {comparison.runs.map((run) => {
          const values = metricsFor(run, maxFiles);
          return (
            <article className="evaluation-card" key={`${run.id}:evaluation`}>
              <strong>{run.projectName} · {run.profileId}</strong>
              {metricLabels.map(([key, label]) => (
                <div className="evaluation-row" key={`${run.id}:${key}`}>
                  <span>{label}</span>
                  <div className="percent-bar"><i style={{ width: `${values[key]}%` }} /></div>
                  <b>{values[key]}%</b>
                </div>
              ))}
            </article>
          );
        })}
      </div>
    </div>
  );
}
