import type { RuntimeHealthReport } from "@mag/shared";

interface RuntimeHealthPanelProps {
  health: RuntimeHealthReport | null;
  labels?: {
    runtime?: string;
    productionReadiness?: string;
    checks?: string;
    warnings?: string;
    failed?: string;
    ready?: string;
    warning?: string;
  };
}

export function RuntimeHealthPanel({ health, labels }: RuntimeHealthPanelProps) {
  if (!health) {
    return null;
  }

  const text = {
    runtime: "Runtime",
    productionReadiness: "Production readiness",
    checks: "checks",
    warnings: "warnings",
    failed: "failed",
    ready: "ready",
    warning: "warning",
    ...labels
  };
  const failed = health.checks.filter((check) => check.status === "failed").length;
  const warnings = health.checks.filter((check) => check.status === "warning").length;
  const visibleChecks = health.checks.slice(0, 5);
  const status = health.status === "ready" ? text.ready : text.warning;

  return (
    <div className="card runtime-health-card">
      <div className="card-row">
        <div>
          <span className="section-kicker">{text.runtime}</span>
          <h3>{text.productionReadiness}</h3>
        </div>
        <span className={`status-pill ${health.status === "ready" ? "health-ready" : "health-degraded"}`}>
          {status}
        </span>
      </div>
      <div className="health-metrics">
        <span>{health.checks.length} {text.checks}</span>
        <span>{warnings} {text.warnings}</span>
        <span>{failed} {text.failed}</span>
      </div>
      <ul className="health-list">
        {visibleChecks.map((check) => (
          <li key={check.id}>
            <strong>{check.status === "warning" ? text.warning : check.status === "failed" ? text.failed : text.ready}</strong>
            <span>{check.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
