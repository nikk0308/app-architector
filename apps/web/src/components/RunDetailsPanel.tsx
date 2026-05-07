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
  const text = labels ?? {
    empty: "Select a run to inspect it.",
    loading: "Loading run details...",
    title: "Run Details",
    summary: "Summary",
    modules: "Selected modules",
    metrics: "Metrics",
    advanced: "Advanced metadata"
  };

  if (loading) {
    return <div className="empty-state">{text.loading}</div>;
  }

  if (error) {
    return <div className="empty-state error-muted">{error}</div>;
  }

  if (!details) {
    return <div className="empty-state">{text.empty}</div>;
  }

  const metrics = details.metrics;
  const spec = details.spec;
  const modules = spec?.modules.filter((module) => module.enabled).map((module) => module.featureId) ?? [];
  const validationStatus = details.validationV2?.postMaterialization?.status ?? details.validationV2?.preMaterialization?.status ?? details.validation?.status ?? "-";
  const provider = details.architectureSynthesis?.usedAi
    ? `${details.architectureSynthesis.provider}${details.architectureSynthesis.model ? ` · ${details.architectureSynthesis.model}` : ""}`
    : "deterministic";
  const humanSummary = `${details.metadata.projectName} · ${details.metadata.generationMode ?? "baseline"} · ${details.metadata.profile} · ${metrics?.fileCount ?? details.metadata.fileTree?.filter((node) => node.type === "file").length ?? "-"} files · validation ${validationStatus}.`;

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
        <span><small>Platform</small><strong>{details.metadata.profile}</strong></span>
        <span><small>Mode</small><strong>{details.metadata.generationMode ?? "baseline"}</strong></span>
        <span><small>Provider</small><strong>{provider}</strong></span>
        <span><small>Created</small><strong>{formatDate(details.metadata.createdAt)}</strong></span>
        <span><small>Architecture</small><strong>{spec?.architecture.style ?? "-"}</strong></span>
        <span><small>State</small><strong>{spec?.architecture.stateManagement ?? "-"}</strong></span>
        <span><small>Navigation</small><strong>{spec?.architecture.navigationStyle ?? "-"}</strong></span>
        <span><small>ZIP</small><strong>{details.metadata.zipPath ? "ready" : "missing"}</strong></span>
      </div>

      <div className="metric-bars">
        <div>
          <span>{metrics?.fileCount ?? 0} files</span>
          <i style={{ width: `${Math.min(100, ((metrics?.fileCount ?? 0) / 80) * 100)}%` }} />
        </div>
        <div>
          <span>{metrics?.artifactCount ?? 0} artifacts</span>
          <i style={{ width: `${Math.min(100, ((metrics?.artifactCount ?? 0) / 35) * 100)}%` }} />
        </div>
        <div>
          <span>{metrics?.warningCount ?? 0} warnings</span>
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
