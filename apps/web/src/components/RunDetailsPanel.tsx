import type { GenerationRunDetails } from "@mag/shared";

interface RunDetailsPanelProps {
  details: GenerationRunDetails | null;
  loading: boolean;
  error: string | null;
  labels?: {
    empty: string;
    loading: string;
    title: string;
    summary: string;
    modules: string;
    metrics: string;
    advanced: string;
    platform?: string;
    mode?: string;
    provider?: string;
    created?: string;
    architecture?: string;
    state?: string;
    navigation?: string;
    zip?: string;
    ready?: string;
    missing?: string;
    files?: string;
    artifacts?: string;
    warnings?: string;
    validation?: string;
  };
}

function formatMs(value?: number): string {
  if (typeof value !== "number") return "-";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function RunDetailsPanel({ details, loading, error, labels }: RunDetailsPanelProps) {
  const text = {
    empty: "Select a run to inspect it.",
    loading: "Loading run details...",
    title: "Run Details",
    summary: "Summary",
    modules: "Selected modules",
    metrics: "Metrics",
    advanced: "Advanced metadata",
    platform: "Platform",
    mode: "Mode",
    provider: "Provider",
    created: "Created",
    architecture: "Architecture",
    state: "State",
    navigation: "Navigation",
    zip: "ZIP",
    ready: "ready",
    missing: "missing",
    files: "files",
    artifacts: "artifacts",
    warnings: "warnings",
    validation: "validation",
    ...labels
  };

  if (loading) {
    return <div className="empty-state">{text.loading}</div>;
  }

  if (error) {
    return <div className="empty-state error-muted">{error}</div>;
  }

  if (!details) {
    return text.empty ? <div className="empty-state">{text.empty}</div> : null;
  }

  const metrics = details.metrics;
  const spec = details.spec;
  const modules = spec?.modules.filter((module) => module.enabled).map((module) => module.featureId) ?? [];
  const validationStatus = details.validationV2?.postMaterialization?.status ?? details.validationV2?.preMaterialization?.status ?? details.validation?.status ?? "-";
  const provider = details.architectureSynthesis?.usedAi
    ? `${details.architectureSynthesis.provider}${details.architectureSynthesis.model ? ` · ${details.architectureSynthesis.model}` : ""}`
    : "deterministic";
  const fileCount = metrics?.fileCount ?? details.metadata.fileTree?.filter((node) => node.type === "file").length ?? "-";
  const humanSummary = `${details.metadata.projectName} · ${details.metadata.generationMode ?? "baseline"} · ${details.metadata.profile} · ${fileCount} ${text.files} · ${text.validation} ${validationStatus}.`;

  return (
    <div className="run-details-panel redesigned-panel">
      <div className="section-head">
        <div>
          <span className="kicker">{text.title}</span>
          <h2>{details.metadata.projectName}</h2>
        </div>
        <span className="status-pill">{details.metadata.status}</span>
      </div>

      <p className="human-summary">{humanSummary}</p>

      <div className="detail-grid">
        <span><small>{text.platform}</small><strong>{details.metadata.profile}</strong></span>
        <span><small>{text.mode}</small><strong>{details.metadata.generationMode ?? "baseline"}</strong></span>
        <span><small>{text.provider}</small><strong>{provider}</strong></span>
        <span><small>{text.created}</small><strong>{formatDate(details.metadata.createdAt)}</strong></span>
        <span><small>{text.architecture}</small><strong>{spec?.architecture.style ?? "-"}</strong></span>
        <span><small>{text.state}</small><strong>{spec?.architecture.stateManagement ?? "-"}</strong></span>
        <span><small>{text.navigation}</small><strong>{spec?.architecture.navigationStyle ?? "-"}</strong></span>
        <span><small>{text.zip}</small><strong>{details.metadata.zipPath ? text.ready : text.missing}</strong></span>
      </div>

      <div className="metric-bars">
        <div>
          <span>{metrics?.fileCount ?? 0} {text.files}</span>
          <i style={{ width: `${Math.min(100, ((metrics?.fileCount ?? 0) / 80) * 100)}%` }} />
        </div>
        <div>
          <span>{metrics?.artifactCount ?? 0} {text.artifacts}</span>
          <i style={{ width: `${Math.min(100, ((metrics?.artifactCount ?? 0) / 35) * 100)}%` }} />
        </div>
        <div>
          <span>{metrics?.warningCount ?? 0} {text.warnings}</span>
          <i className="warn-bar" style={{ width: `${Math.min(100, ((metrics?.warningCount ?? 0) / 12) * 100)}%` }} />
        </div>
        <div>
          <span>{formatMs(metrics?.generationTimeMs)}</span>
          <i style={{ width: `${Math.min(100, ((metrics?.generationTimeMs ?? 0) / 20000) * 100)}%` }} />
        </div>
      </div>

      {modules.length > 0 ? (
        <div>
          <h3>{text.modules}</h3>
          <div className="chip-row">
            {modules.map((module) => <span className="chip" key={module}>{module}</span>)}
          </div>
        </div>
      ) : null}

      {details.advisor?.summary ? (
        <div className="advisor-summary-card">
          <h3>Advisor</h3>
          <p>{details.advisor.summary}</p>
        </div>
      ) : null}

      <details className="advanced-details">
        <summary>{text.advanced}</summary>
        <pre>{JSON.stringify({
          synthesis: details.architectureSynthesis,
          validation: details.validationV2,
          metrics,
          advisorStatus: details.advisor?.status,
          hybrid: details.hybridRefinement
        }, null, 2)}</pre>
      </details>
    </div>
  );
}
