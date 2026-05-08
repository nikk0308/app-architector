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
    integrationDepth?: string;
    resourceDepth?: string;
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
    integrationFiles?: string;
    delta?: string;
    hint?: string;
    legend?: string;
    bestFiles?: string;
    fastest?: string;
    weakest?: string;
    bestRelations?: string;
  };
}

const COLORS = ["#d4af37", "#4f8cff", "#22c55e", "#f97316", "#e879f9", "#14b8a6"];

function formatMs(value?: number): string {
  if (!value) return "0 ms";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
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

function metricsFor(run: RunComparison["runs"][number], max: { files: number; relationships: number; integrationFiles: number; resources: number; platformCore: number }) {
  const metrics = run.metrics;
  const analysis = run.analysis;
  const fileCoverage = clamp(((metrics?.fileCount ?? 0) / Math.max(1, max.files)) * 100);
  const moduleCoverage = analysis?.selectedModuleCount
    ? clamp((analysis.representedModuleCount / analysis.selectedModuleCount) * 100)
    : clamp(((metrics?.artifactCount ?? 0) / 70) * 100);
  const docsPercent = (analysis?.docsFiles ?? 0) / Math.max(1, metrics?.fileCount ?? 1);
  const docsRatio = clamp((Math.min(0.16, docsPercent) / 0.16) * 100);
  const warningsCleanliness = clamp(100 - (metrics?.warningCount ?? 0) * 14);
  const validation = validationScore(metrics?.validationStatus);
  const sourceDepth = clamp(((analysis?.sourceFiles ?? 0) / Math.max(1, metrics?.fileCount ?? 1) / 0.72) * 100);
  const relationshipCoverage = clamp(((analysis?.relationshipFiles ?? 0) / Math.max(1, max.relationships)) * 100);
  const integrationDepth = clamp(((analysis?.integrationFiles ?? 0) / Math.max(1, max.integrationFiles)) * 100);
  const resourceDepth = clamp(((analysis?.resourceFiles ?? 0) / Math.max(1, max.resources)) * 100);
  const platformCore = clamp(((analysis?.platformCoreFiles ?? 0) / Math.max(1, max.platformCore)) * 100);
  const architectureCompleteness = clamp((fileCoverage + moduleCoverage + sourceDepth + relationshipCoverage + integrationDepth + resourceDepth + platformCore + validation + warningsCleanliness) / 9);
  return { fileCoverage, moduleCoverage, docsRatio, warningsCleanliness, validation, architectureCompleteness, sourceDepth, relationshipCoverage, integrationDepth, resourceDepth, platformCore };
}

function score(run: RunComparison["runs"][number], max: { files: number; relationships: number; integrationFiles: number; resources: number; platformCore: number }): number {
  const values = metricsFor(run, max);
  return values.architectureCompleteness
    + values.relationshipCoverage * 0.25
    + values.integrationDepth * 0.2
    + values.resourceDepth * 0.15
    - (run.metrics?.warningCount ?? 0) * 2;
}

function runLabel(run: RunComparison["runs"][number]): string {
  return `${run.projectName} · ${run.mode} · ${run.profileId}`;
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
    artifacts: "Plan blocks",
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
    integrationDepth: "Integration depth",
    resourceDepth: "Resource depth",
    platformCore: "Platform core",
    relationshipFiles: "Relationships",
    integrationFiles: "Integration files",
    hint: "These are heuristic UI metrics for comparing starter-package completeness.",
    legend: "Legend",
    bestFiles: "Best for files and structure depth",
    fastest: "Fastest",
    weakest: "Weakest overall",
    bestRelations: "Best relationship coverage"
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

  const max = {
    files: Math.max(1, ...comparison.runs.map((run) => run.metrics?.fileCount ?? 0)),
    relationships: Math.max(1, ...comparison.runs.map((run) => run.analysis?.relationshipFiles ?? 0)),
    integrationFiles: Math.max(1, ...comparison.runs.map((run) => run.analysis?.integrationFiles ?? 0)),
    resources: Math.max(1, ...comparison.runs.map((run) => run.analysis?.resourceFiles ?? 0)),
    platformCore: Math.max(1, ...comparison.runs.map((run) => run.analysis?.platformCoreFiles ?? 0))
  };
  const maxTime = Math.max(1, ...comparison.runs.map((run) => run.metrics?.generationTimeMs ?? 0));
  const metricLabels = [
    ["fileCoverage", text.fileCoverage],
    ["moduleCoverage", text.moduleCoverage],
    ["sourceDepth", text.sourceDepth],
    ["relationshipCoverage", text.relationshipCoverage],
    ["integrationDepth", text.integrationDepth],
    ["resourceDepth", text.resourceDepth],
    ["platformCore", text.platformCore],
    ["docsRatio", text.docsRatio],
    ["warningsCleanliness", text.warningsCleanliness],
    ["validation", text.validation],
    ["architectureCompleteness", text.architectureCompleteness]
  ] as const;
  const runsWithValues = comparison.runs.map((run, index) => ({
    run,
    color: COLORS[index % COLORS.length],
    values: metricsFor(run, max),
    score: score(run, max)
  }));
  const strongest = [...runsWithValues].sort((left, right) => right.score - left.score)[0]?.run;
  const bestFiles = [...comparison.runs].sort((left, right) => (right.metrics?.fileCount ?? 0) - (left.metrics?.fileCount ?? 0))[0];
  const fastest = [...comparison.runs].sort((left, right) => (left.metrics?.generationTimeMs ?? Number.MAX_SAFE_INTEGER) - (right.metrics?.generationTimeMs ?? Number.MAX_SAFE_INTEGER))[0];
  const bestRelations = [...comparison.runs].sort((left, right) => (right.analysis?.relationshipFiles ?? 0) - (left.analysis?.relationshipFiles ?? 0))[0];
  const weakest = [...runsWithValues].sort((left, right) => left.score - right.score)[0]?.run;

  return (
    <div className="comparison-panel redesigned-panel">
      <div className="section-head">
        <div>
          <span className="kicker">{text.title}</span>
          <h2>{comparison.runs.length} {text.runs}</h2>
        </div>
        {strongest ? <span className="status-pill">{text.strongest}: {runLabel(strongest)}</span> : null}
      </div>

      <div className="comparison-legend" aria-label={text.legend}>
        {runsWithValues.map(({ run, color }) => (
          <span key={run.id}><i style={{ background: color }} />{runLabel(run)}</span>
        ))}
      </div>

      <div className="comparison-conclusions">
        {bestFiles ? <span className="conclusion-pill good">{text.bestFiles}: {runLabel(bestFiles)}</span> : null}
        {bestRelations ? <span className="conclusion-pill info">{text.bestRelations}: {runLabel(bestRelations)}</span> : null}
        {fastest ? <span className="conclusion-pill fast">{text.fastest}: {runLabel(fastest)} · {formatMs(fastest.metrics?.generationTimeMs)}</span> : null}
        {weakest ? <span className="conclusion-pill bad">{text.weakest}: {runLabel(weakest)}</span> : null}
      </div>

      <div className="combined-comparison-chart">
        {metricLabels.map(([key, label]) => {
          const sorted = [...runsWithValues].sort((left, right) => right.values[key] - left.values[key]);
          return (
            <div className="combined-metric-row" key={key}>
              <span>{label}</span>
              <div className="combined-bar-track">
                {sorted.map(({ run, color, values }, index) => (
                  <i
                    aria-label={`${runLabel(run)} ${label} ${values[key]}%`}
                    className="combined-bar"
                    key={`${key}:${run.id}`}
                    style={{
                      width: `${values[key]}%`,
                      background: color,
                      top: `${index * 4}px`,
                      zIndex: sorted.length - index
                    }}
                  />
                ))}
              </div>
              <b>{Math.max(...runsWithValues.map((item) => item.values[key]))}%</b>
            </div>
          );
        })}
      </div>

      <div className="compare-run-summaries">
        {runsWithValues.map(({ run, color, values }) => (
          <article key={`${run.id}:summary`}>
            <strong><i style={{ background: color }} />{runLabel(run)}</strong>
            <div className="compare-mini-stats">
              <span><small>{text.files}</small><b>{run.metrics?.fileCount ?? 0}</b></span>
              <span><small>{text.artifacts}</small><b>{run.metrics?.artifactCount ?? 0}</b></span>
              <span><small>{text.relationshipFiles}</small><b>{run.analysis?.relationshipFiles ?? 0}</b></span>
              <span><small>{text.integrationFiles}</small><b>{run.analysis?.integrationFiles ?? 0}</b></span>
              <span><small>{text.warnings}</small><b>{run.metrics?.warningCount ?? 0}</b></span>
              <span><small>{text.time}</small><b>{formatMs(run.metrics?.generationTimeMs)}</b></span>
            </div>
            <div className="evaluation-row">
              <span>{text.architectureCompleteness}</span>
              <div className="percent-bar"><i style={{ width: `${values.architectureCompleteness}%` }} /></div>
              <b>{values.architectureCompleteness}%</b>
            </div>
          </article>
        ))}
      </div>

      <p className="quiet-note">{text.hint}</p>
    </div>
  );
}
