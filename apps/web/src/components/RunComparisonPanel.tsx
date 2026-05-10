import type { RunComparison } from "@mag/shared";
import type { CSSProperties } from "react";

interface RunComparisonPanelProps {
  comparison: RunComparison | null;
  selectedCount: number;
  loading: boolean;
  error: string | null;
  labels?: Partial<ComparisonLabels>;
}

interface ComparisonLabels {
  [key: string]: string;
  empty: string;
  loading: string;
  title: string;
  strongest: string;
  runs: string;
  run: string;
  mode: string;
  platform: string;
  files: string;
  artifacts: string;
  warnings: string;
  time: string;
  currentSelection: string;
  generationTime: string;
  fileCoverage: string;
  moduleCoverage: string;
  docsRatio: string;
  warningsCleanliness: string;
  validation: string;
  architectureCompleteness: string;
  sourceDepth: string;
  relationshipCoverage: string;
  relationshipEdges: string;
  integrationDepth: string;
  resourceDepth: string;
  platformCore: string;
  relationshipFiles: string;
  integrationFiles: string;
  legend: string;
  bestOverall: string;
  bestFiles: string;
  fastest: string;
  weakest: string;
  bestRelations: string;
  strengths: string;
  needsAttention: string;
  structure: string;
  quality: string;
  documentation: string;
  speed: string;
}

const COLORS = ["#d4af37", "#4f8cff", "#22c55e", "#a855f7"];

const DEFAULT_LABELS: ComparisonLabels = {
  empty: "Select 2-4 runs to compare.",
  loading: "Building comparison...",
  title: "Architecture Health Comparison",
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
  relationshipCoverage: "File relationships",
  relationshipEdges: "Relations",
  integrationDepth: "Integration depth",
  resourceDepth: "UI and resources",
  platformCore: "Platform core",
  relationshipFiles: "Relations",
  integrationFiles: "Integrations",
  legend: "Legend",
  bestOverall: "Best overall",
  bestFiles: "Best for files and structure depth",
  fastest: "Fastest",
  weakest: "Weakest in this comparison",
  bestRelations: "Best relationship coverage",
  strengths: "Strengths",
  needsAttention: "Needs attention",
  structure: "Structure",
  quality: "Quality",
  documentation: "Documentation",
  speed: "Speed"
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatMs(value?: number): string {
  if (!value) return "0 ms";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}

function generationModeLabel(mode?: string): string {
  if (mode === "commercial") return "GPT";
  if (mode === "hf-open") return "Qwen";
  if (mode === "hybrid") return "Hybrid";
  if (mode === "baseline") return "Baseline";
  return mode ?? "Baseline";
}

function validationScore(status?: string): number {
  if (status === "passed") return 100;
  if (status === "passed_with_warnings") return 72;
  if (status === "failed") return 25;
  return 60;
}

function RunCategoryPills({ run }: { run: RunComparison["runs"][number] }) {
  return (
    <span className="history-pills">
      <i>{generationModeLabel(run.mode)}</i>
      <i>{run.profileId}</i>
    </span>
  );
}

function runMetrics(run: RunComparison["runs"][number], max: {
  files: number;
  relationships: number;
  integrations: number;
  resources: number;
  platformCore: number;
  fastestTime: number;
}) {
  const analysis = run.analysis;
  const metrics = run.metrics;
  const fileCount = metrics?.fileCount ?? 0;
  const relationEdges = analysis?.relationshipEdgeCount ?? analysis?.relationshipFiles ?? 0;
  const relationshipCoverageFromGraph = analysis?.relationshipCoveragePercent;
  const fileCoverage = clamp((fileCount / Math.max(1, max.files)) * 100);
  const moduleCoverage = analysis?.selectedModuleCount
    ? clamp((analysis.representedModuleCount / analysis.selectedModuleCount) * 100)
    : clamp(((metrics?.artifactCount ?? 0) / 90) * 100);
  const sourceDepth = clamp(((analysis?.sourceFiles ?? 0) / Math.max(1, fileCount) / 0.72) * 100);
  const relationshipCoverage = typeof relationshipCoverageFromGraph === "number"
    ? clamp(relationshipCoverageFromGraph)
    : clamp((relationEdges / Math.max(1, max.relationships)) * 100);
  const integrationDepth = clamp(((analysis?.integrationFiles ?? 0) / Math.max(1, max.integrations)) * 100);
  const resourceDepth = clamp(((analysis?.resourceFiles ?? 0) / Math.max(1, max.resources)) * 100);
  const platformCore = clamp(((analysis?.platformCoreFiles ?? 0) / Math.max(1, max.platformCore)) * 100);
  const docsPercent = (analysis?.docsFiles ?? 0) / Math.max(1, fileCount);
  const docsRatio = clamp((Math.min(0.16, docsPercent) / 0.16) * 100);
  const warningsCleanliness = clamp(100 - (metrics?.warningCount ?? 0) * 14);
  const validation = validationScore(metrics?.validationStatus);
  const speed = clamp((max.fastestTime / Math.max(max.fastestTime, metrics?.generationTimeMs ?? max.fastestTime)) * 100);
  const architectureCompleteness = clamp(
    fileCoverage * 0.12
    + moduleCoverage * 0.14
    + sourceDepth * 0.12
    + relationshipCoverage * 0.18
    + integrationDepth * 0.1
    + resourceDepth * 0.08
    + platformCore * 0.08
    + docsRatio * 0.08
    + warningsCleanliness * 0.05
    + validation * 0.05
  );

  return {
    fileCoverage,
    moduleCoverage,
    sourceDepth,
    relationshipCoverage,
    integrationDepth,
    resourceDepth,
    platformCore,
    docsRatio,
    warningsCleanliness,
    validation,
    speed,
    architectureCompleteness,
    relationEdges
  };
}

function Icon({ type }: { type: "trophy" | "bolt" | "warning" }) {
  if (type === "bolt") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 10-13h-7l1-7Z" /></svg>;
  }
  if (type === "warning") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3Zm0 6v6m0 3h.01" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v3h3a5 5 0 0 1-5 5h-.3A6 6 0 0 1 13 14.7V18h4v2H7v-2h4v-3.3A6 6 0 0 1 9.3 12H9a5 5 0 0 1-5-5h3V4Zm0 5V7H6a3 3 0 0 0 1 2Zm10 0a3 3 0 0 0 1-2h-1v2Z" /></svg>;
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="health-metric-row">
      <span>{label}</span>
      <i><b style={{ width: `${value}%`, background: color }} /></i>
      <strong>{value}%</strong>
    </div>
  );
}

function pickStrengths(values: ReturnType<typeof runMetrics>, text: ComparisonLabels): string[] {
  return [
    values.fileCoverage >= 85 ? text.fileCoverage : undefined,
    values.moduleCoverage >= 85 ? text.moduleCoverage : undefined,
    values.relationshipCoverage >= 85 ? text.relationshipCoverage : undefined,
    values.validation >= 85 ? text.validation : undefined,
    values.platformCore >= 85 ? text.platformCore : undefined
  ].filter((item): item is string => Boolean(item)).slice(0, 3);
}

function pickAttention(values: ReturnType<typeof runMetrics>, run: RunComparison["runs"][number], text: ComparisonLabels): string[] {
  return [
    values.docsRatio <= 60 ? `${text.docsRatio} (${values.docsRatio}%)` : undefined,
    values.relationshipCoverage <= 60 ? `${text.relationshipCoverage} (${values.relationshipCoverage}%)` : undefined,
    values.integrationDepth <= 60 ? `${text.integrationDepth} (${values.integrationDepth}%)` : undefined,
    (run.metrics?.warningCount ?? 0) > 0 ? `${text.warnings}: ${run.metrics?.warningCount ?? 0}` : undefined,
    values.validation <= 70 ? `${text.validation} (${values.validation}%)` : undefined
  ].filter((item): item is string => Boolean(item)).slice(0, 3);
}

export function RunComparisonPanel({ comparison, selectedCount, loading, error, labels }: RunComparisonPanelProps) {
  const text: ComparisonLabels = { ...DEFAULT_LABELS, ...labels } as ComparisonLabels;

  if (loading) {
    return <div className="empty-state">{text.loading}</div>;
  }

  if (error) {
    return <div className="empty-state error-muted">{error}</div>;
  }

  if (!comparison) {
    return <div className="empty-state">{text.empty} {text.currentSelection}: {selectedCount}.</div>;
  }

  const runs = comparison.runs.slice(0, 4);
  const max = {
    files: Math.max(1, ...runs.map((run) => run.metrics?.fileCount ?? 0)),
    relationships: Math.max(1, ...runs.map((run) => run.analysis?.relationshipEdgeCount ?? run.analysis?.relationshipFiles ?? 0)),
    integrations: Math.max(1, ...runs.map((run) => run.analysis?.integrationFiles ?? 0)),
    resources: Math.max(1, ...runs.map((run) => run.analysis?.resourceFiles ?? 0)),
    platformCore: Math.max(1, ...runs.map((run) => run.analysis?.platformCoreFiles ?? 0)),
    fastestTime: Math.max(1, Math.min(...runs.map((run) => run.metrics?.generationTimeMs ?? Number.MAX_SAFE_INTEGER)))
  };
  const cards = runs.map((run, index) => ({
    run,
    color: COLORS[index % COLORS.length],
    values: runMetrics(run, max)
  }));
  const sortedByScore = [...cards].sort((left, right) => right.values.architectureCompleteness - left.values.architectureCompleteness);
  const best = sortedByScore[0];
  const weakest = sortedByScore[sortedByScore.length - 1];
  const fastest = [...cards].sort((left, right) => (left.run.metrics?.generationTimeMs ?? Number.MAX_SAFE_INTEGER) - (right.run.metrics?.generationTimeMs ?? Number.MAX_SAFE_INTEGER))[0];


  return (
    <div className="comparison-panel redesigned-panel health-comparison-panel">
      <div className="comparison-title-block">
        <h2>{text.title}</h2>
        <p>{runs.length} {text.runs}</p>
      </div>

      <div className="health-highlights">
        {best ? (
          <article className="health-highlight best">
            <Icon type="trophy" />
            <span className="run-categories-head-info"><small>{text.bestOverall}</small><strong>{best.run.projectName}</strong><RunCategoryPills run={best.run} /></span>
            <b>{best.values.architectureCompleteness}%</b>
          </article>
        ) : null}
        {fastest ? (
          <article className="health-highlight fast">
            <Icon type="bolt" />
            <span className="run-categories-head-info"><small>{text.fastest}</small><strong>{fastest.run.projectName}</strong><RunCategoryPills run={fastest.run} /></span>
            <b>{formatMs(fastest.run.metrics?.generationTimeMs)}</b>
          </article>
        ) : null}
        {weakest ? (
          <article className="health-highlight weak">
            <Icon type="warning" />
            <span className="run-categories-head-info"><small>{text.weakest}</small><strong>{weakest.run.projectName}</strong><RunCategoryPills run={weakest.run} /></span>
            <b>{weakest.values.architectureCompleteness}%</b>
          </article>
        ) : null}
      </div>

      <div className="health-card-grid">
        {cards.map(({ run, color, values }) => {
          const strengths = pickStrengths(values, text);
          const attention = pickAttention(values, run, text);
          return (
            <article className="architecture-health-card" key={run.id} style={{ "--run-color": color, "--score": `${values.architectureCompleteness}%` } as CSSProperties}>
              <div className="health-card-head">
                <span className="run-color-dot" />
                <div className="run-categories-head-info">
                  <h3>{run.projectName}</h3>
                  <RunCategoryPills run={run} />
                </div>
              </div>
              <div className="health-card-main">
                <div className="score-donut"><strong>{values.architectureCompleteness}%</strong></div>
                <div className="health-metric-groups">
                  <section>
                    <h4>{text.structure}</h4>
                    <MetricBar label={text.fileCoverage} value={values.fileCoverage} color={color} />
                    <MetricBar label={text.moduleCoverage} value={values.moduleCoverage} color={color} />
                    <MetricBar label={text.sourceDepth} value={values.sourceDepth} color={color} />
                    <MetricBar label={text.relationshipCoverage} value={values.relationshipCoverage} color={color} />
                    <MetricBar label={text.integrationDepth} value={values.integrationDepth} color={color} />
                  </section>
                  <section>
                    <h4>{text.platform}</h4>
                    <MetricBar label={text.resourceDepth} value={values.resourceDepth} color={color} />
                    <MetricBar label={text.platformCore} value={values.platformCore} color={color} />
                  </section>
                  <section>
                    <h4>{text.quality}</h4>
                    <MetricBar label={text.docsRatio} value={values.docsRatio} color={color} />
                    <MetricBar label={text.warningsCleanliness} value={values.warningsCleanliness} color={color} />
                  </section>
                  <section>
                    <h4>{text.validation}</h4>
                    <MetricBar label={text.validation} value={values.validation} color={color} />
                  </section>
                  <section>
                    <h4>{text.speed}</h4>
                    <MetricBar label={text.speed} value={values.speed} color={color} />
                  </section>
                </div>
              </div>
              <div className="health-stat-grid">
                <span><small>{text.files}</small><b>{run.metrics?.fileCount ?? 0}</b></span>
                <span><small>{text.artifacts}</small><b>{run.metrics?.artifactCount ?? 0}</b></span>
                <span><small>{text.relationshipEdges}</small><b>{values.relationEdges}</b></span>
                <span><small>{text.integrationFiles}</small><b>{run.analysis?.integrationFiles ?? 0}</b></span>
                <span><small>{text.warnings}</small><b>{run.metrics?.warningCount ?? 0}</b></span>
                <span><small>{text.time}</small><b>{formatMs(run.metrics?.generationTimeMs)}</b></span>
              </div>
              <div className="health-notes-grid">
                <div>
                  <strong>{text.strengths}</strong>
                  <ul>{(strengths.length ? strengths : [text.validation]).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <strong>{text.needsAttention}</strong>
                  <ul>{(attention.length ? attention : [text.docsRatio]).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
            </article>
          );
        })}
      </div>

    </div>
  );
}
