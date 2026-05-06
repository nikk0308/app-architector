import type { RuntimeHealthReport } from "@mag/shared";

interface RuntimeHealthPanelProps {
  health: RuntimeHealthReport | null;
}

export function RuntimeHealthPanel({ health }: RuntimeHealthPanelProps) {
  if (!health) {
    return null;
  }

  const failed = health.checks.filter((check) => check.status === "failed").length;
  const warnings = health.checks.filter((check) => check.status === "warning").length;
  const visibleChecks = health.checks.slice(0, 5);

  return (
    <div className="card runtime-health-card">
      <div className="card-row">
        <div>
          <span className="section-kicker">Runtime</span>
          <h3>Production readiness</h3>
        </div>
        <span className={`status-pill ${health.status === "ready" ? "health-ready" : "health-degraded"}`}>
          {health.status}
        </span>
      </div>
      <div className="health-metrics">
        <span>{health.checks.length} checks</span>
        <span>{warnings} warnings</span>
        <span>{failed} failed</span>
      </div>
      <ul className="health-list">
        {visibleChecks.map((check) => (
          <li key={check.id}>
            <strong>{check.status}</strong>
            <span>{check.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
