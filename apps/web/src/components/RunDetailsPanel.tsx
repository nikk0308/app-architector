import type { GenerationRunDetails } from "@mag/shared";

interface RunDetailsPanelProps {
  details: GenerationRunDetails | null;
  loading: boolean;
  error: string | null;
}

function formatMs(value?: number): string {
  if (typeof value !== "number") return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function RunDetailsPanel({ details, loading, error }: RunDetailsPanelProps) {
  if (loading) {
    return <div className="empty-state">Loading run details...</div>;
  }

  if (error) {
    return <div className="empty-state error-muted">{error}</div>;
  }

  if (!details) {
    return <div className="empty-state">Select a generated archive to inspect its metrics, validation and artifacts.</div>;
  }

  const metrics = details.metrics;
  const validation = details.validationV2;
  const artifacts = details.artifacts.slice(0, 10);

  return (
    <div className="run-details-panel">
      <div className="card-row">
        <div>
          <span className="section-kicker">Run details</span>
          <h3>{details.metadata.projectName}</h3>
        </div>
        <span className="status-pill accent-pill">{details.metadata.generationMode ?? "baseline"}</span>
      </div>

      <div className="metric-strip">
        <div>
          <span>Status</span>
          <strong>{details.metadata.status}</strong>
        </div>
        <div>
          <span>Profile</span>
          <strong>{details.metadata.profile}</strong>
        </div>
        <div>
          <span>Created</span>
          <strong>{formatDate(details.metadata.createdAt)}</strong>
        </div>
        <div>
          <span>Time</span>
          <strong>{formatMs(metrics?.generationTimeMs)}</strong>
        </div>
      </div>

      {metrics ? (
        <div className="metric-strip secondary-strip">
          <div>
            <span>Files</span>
            <strong>{metrics.fileCount}</strong>
          </div>
          <div>
            <span>Artifacts</span>
            <strong>{metrics.artifactCount}</strong>
          </div>
          <div>
            <span>Warnings</span>
            <strong>{metrics.warningCount}</strong>
          </div>
          <div>
            <span>Provider</span>
            <strong>{metrics.architectureProvider}</strong>
          </div>
        </div>
      ) : null}

      {validation ? (
        <div className="run-validation-row">
          <span>Validation</span>
          <strong>pre: {validation.preMaterialization?.status ?? "-"} · post: {validation.postMaterialization?.status ?? "-"}</strong>
        </div>
      ) : null}

      <div className="artifact-mini-list">
        <div className="card-row">
          <h4>Generated artifacts</h4>
          <span className="status-pill">{details.artifacts.length}</span>
        </div>
        {artifacts.map((artifact) => (
          <div className="artifact-mini-row" key={artifact.path}>
            <span>{artifact.kind}</span>
            <strong title={artifact.path}>{artifact.path}</strong>
            <small>{artifact.generated ? "generated" : "missing"}{artifact.sizeBytes ? ` · ${artifact.sizeBytes} B` : ""}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
