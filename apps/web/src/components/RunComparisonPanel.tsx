import type { RunComparison } from "@mag/shared";

interface RunComparisonPanelProps {
  comparison: RunComparison | null;
  selectedCount: number;
  loading: boolean;
  error: string | null;
}

function formatDelta(value: number): string {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : String(value);
}

function formatMs(value: number): string {
  if (value === 0) return "0 ms";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value} ms`;
}

export function RunComparisonPanel({ comparison, selectedCount, loading, error }: RunComparisonPanelProps) {
  if (loading) {
    return <div className="empty-state">Building comparison...</div>;
  }

  if (error) {
    return <div className="empty-state error-muted">{error}</div>;
  }

  if (!comparison) {
    return (
      <div className="empty-state">
        Select at least two runs from history to compare modes, artifact counts, warnings and generation time.
        Current selection: {selectedCount}.
      </div>
    );
  }

  return (
    <div className="comparison-panel">
      <div className="card-row">
        <div>
          <span className="section-kicker">Compare</span>
          <h3>Generation runs</h3>
        </div>
        <span className="status-pill">{comparison.runs.length} runs</span>
      </div>

      <div className="compare-run-grid">
        {comparison.runs.map((run) => (
          <div className="compare-run-card" key={run.id}>
            <strong>{run.projectName}</strong>
            <small>{run.mode} · {run.profileId} · {run.status}</small>
            <div className="compare-metrics">
              <span>{run.metrics?.artifactCount ?? "-"} artifacts</span>
              <span>{run.metrics?.fileCount ?? "-"} files</span>
              <span>{run.metrics?.warningCount ?? "-"} warnings</span>
            </div>
          </div>
        ))}
      </div>

      {comparison.deltas.length > 0 ? (
        <div className="delta-table">
          {comparison.deltas.map((delta) => (
            <div className="delta-row" key={delta.runId}>
              <strong>{delta.runId.slice(0, 8)}</strong>
              <span>artifacts {formatDelta(delta.artifactDelta)}</span>
              <span>files {formatDelta(delta.fileDelta)}</span>
              <span>warnings {formatDelta(delta.warningDelta)}</span>
              <span>time {formatMs(delta.generationTimeDeltaMs)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p>Comparison baseline is selected, but the chosen runs do not have enough metrics for deltas yet.</p>
      )}
    </div>
  );
}
