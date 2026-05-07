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
    sourceDepth?: string;
    relationshipCoverage?: string;
    modeDepth?: string;
    platformCore?: string;
    categoryBreakdown?: string;
    architectureSignals?: string;
    evidence?: string;
    missingModules?: string;
    sourceFiles?: string;
    configFiles?: string;
    docsFiles?: string;
    metadataFiles?: string;
    relationshipFiles?: string;
    modeFiles?: string;
    delta?: string;
    hint?: string;
  };
}

function formatMs(value?: number): string {
  if (!value) return "0 ms";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}

function score(run: RunComparison["runs"][number]): number {
  const metrics = run.metrics;
  const analysis = run.analysis;
  if (!metrics) return 0;
  return metrics.fileCount
    + metrics.artifactCount * 2
    + (analysis?.representedModuleCount ?? 0) * 10
    + (analysis?.relationshipFiles ?? 0) * 3
    + (analysis?.modeSpecificFiles ?? 0) * 2
    - metrics.warningCount * 4
    + (metrics.zipAvailable ? 8 : 0);
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

function metricsFor(run: RunComparison["runs"][number], max: { files: number; relationships: number; modeFiles: number; platformCore: number }) {
  const metrics = run.metrics;
  const analysis = run.analysis;
  const fileCoverage = clamp(((metrics?.fileCount ?? 0) / Math.max(1, max.files)) * 100);
  const moduleCoverage = analysis?.selectedModuleCount
    ? clamp((analysis.representedModuleCount / analysis.selectedModuleCount) * 100)
    : clamp(((metrics?.artifactCount ?? 0) / 32) * 100);
  const docsPercent = (analysis?.docsFiles ?? 0) / Math.max(1, metrics?.fileCount ?? 1);
  const docsRatio = clamp((Math.min(0.16, docsPercent) / 0.16) * 100);
  const warningsCleanliness = clamp(100 - (metrics?.warningCount ?? 0) * 14);
  const validation = validationScore(metrics?.validationStatus);
  const sourceDepth = clamp(((analysis?.sourceFiles ?? 0) / Math.max(1, metrics?.fileCount ?? 1) / 0.65) * 100);
  const relationshipCoverage = clamp(((analysis?.relationshipFiles ?? 0) / Math.max(1, max.relationships)) * 100);
  const modeDepth = clamp(((analysis?.modeSpecificFiles ?? 0) / Math.max(1, max.modeFiles)) * 100);
  const platformCore = clamp(((analysis?.platformCoreFiles ?? 0) / Math.max(1, max.platformCore)) * 100);
  const architectureCompleteness = clamp((fileCoverage + moduleCoverage + sourceDepth + relationshipCoverage + platformCore + validation + warningsCleanliness) / 7);
  return { fileCoverage, moduleCoverage, docsRatio, warningsCleanliness, validation, architectureCompleteness, sourceDepth, relationshipCoverage, modeDepth, platformCore };
}

function deltaText(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
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
    sourceDepth: "Source depth",
    relationshipCoverage: "Relationship coverage",
    modeDepth: "Mode depth",
    platformCore: "Platform core",
    categoryBreakdown: "Category breakdown",
    architectureSignals: "Architecture signals",
    evidence: "Evidence paths",
    missingModules: "Missing modules",
    sourceFiles: "Source",
    configFiles: "Config",
    docsFiles: "Docs",
    metadataFiles: "Metadata",
    relationshipFiles: "Relations",
    modeFiles: "Mode files",
    delta: "Delta",
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
  const max = {
    files: Math.max(1, ...comparison.runs.map((run) => run.metrics?.fileCount ?? 0)),
    relationships: Math.max(1, ...comparison.runs.map((run) => run.analysis?.relationshipFiles ?? 0)),
    modeFiles: Math.max(1, ...comparison.runs.map((run) => run.analysis?.modeSpecificFiles ?? 0)),
    platformCore: Math.max(1, ...comparison.runs.map((run) => run.analysis?.platformCoreFiles ?? 0))
  };
  const maxTime = Math.max(1, ...comparison.runs.map((run) => run.metrics?.generationTimeMs ?? 0));
  const deltaByRun = new Map(comparison.deltas.map((delta) => [delta.runId, delta]));
  const metricLabels = [
    ["fileCoverage", text.fileCoverage],
    ["moduleCoverage", text.moduleCoverage],
    ["sourceDepth", text.sourceDepth],
    ["relationshipCoverage", text.relationshipCoverage],
    ["modeDepth", text.modeDepth],
    ["platformCore", text.platformCore],
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
          <span>{text.relationshipFiles}</span>
          <span>{text.modeFiles}</span>
          <span>{text.warnings}</span>
          <span>{text.time}</span>
          <span>{text.delta}</span>
        </div>
        {comparison.runs.map((run) => (
          <div className={run.id === strongest?.id ? "compare-row compare-row-rich strongest-row" : "compare-row compare-row-rich"} key={run.id}>
            <strong>{run.projectName} · {run.profileId}</strong>
            <span>{run.mode}</span>
            <span>{run.profileId}</span>
            <span>{run.metrics?.fileCount ?? "-"}</span>
            <span>{run.metrics?.artifactCount ?? "-"}</span>
            <span>{run.analysis?.relationshipFiles ?? "-"}</span>
            <span>{run.analysis?.modeSpecificFiles ?? "-"}</span>
            <span className={(run.metrics?.warningCount ?? 0) > 0 ? "warn-text" : ""}>{run.metrics?.warningCount ?? "-"}</span>
            <span>{formatMs(run.metrics?.generationTimeMs)}</span>
            <span>{deltaByRun.has(run.id) ? deltaText(deltaByRun.get(run.id)?.fileDelta ?? 0) : "base"}</span>
          </div>
        ))}
      </div>

      <div className="compare-bars">
        {comparison.runs.map((run) => (
          <div className="compare-bar-card" key={`${run.id}:bars`}>
            <strong>{run.projectName} · {run.profileId}</strong>
            <span>{text.files}</span>
            <i style={{ width: `${((run.metrics?.fileCount ?? 0) / max.files) * 100}%` }} />
            <span>{text.generationTime}</span>
            <i className="info-bar" style={{ width: `${((run.metrics?.generationTimeMs ?? 0) / maxTime) * 100}%` }} />
          </div>
        ))}
      </div>

      <p className="quiet-note">{text.hint}</p>
      <div className="evaluation-grid">
        {comparison.runs.map((run) => {
          const values = metricsFor(run, max);
          return (
            <article className="evaluation-card" key={`${run.id}:evaluation`}>
              <strong>{run.projectName} · {run.profileId}</strong>
              <div className="compare-mini-stats">
                <span><small>{text.sourceFiles}</small><b>{run.analysis?.sourceFiles ?? 0}</b></span>
                <span><small>{text.configFiles}</small><b>{run.analysis?.configFiles ?? 0}</b></span>
                <span><small>{text.docsFiles}</small><b>{run.analysis?.docsFiles ?? 0}</b></span>
                <span><small>{text.metadataFiles}</small><b>{run.analysis?.metadataFiles ?? 0}</b></span>
              </div>
              {metricLabels.map(([key, label]) => (
                <div className="evaluation-row" key={`${run.id}:${key}`}>
                  <span>{label}</span>
                  <div className="percent-bar"><i style={{ width: `${values[key]}%` }} /></div>
                  <b>{values[key]}%</b>
                </div>
              ))}
              <div className="compare-insights">
                <div>
                  <small>{text.architectureSignals}</small>
                  <p>{run.analysis?.architectureSignals.join(" · ") || "-"}</p>
                </div>
                <div>
                  <small>{text.missingModules}</small>
                  <p>{run.analysis?.missingModules.length ? run.analysis.missingModules.join(", ") : "0"}</p>
                </div>
                <div>
                  <small>{text.evidence}</small>
                  <ul>
                    {(run.analysis?.evidencePaths ?? []).slice(0, 5).map((path) => (
                      <li key={`${run.id}:${path}`}>{path}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
