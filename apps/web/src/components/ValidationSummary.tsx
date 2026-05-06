import type { ValidationV2Report } from "@mag/shared";

interface ValidationBundle {
  preMaterialization?: ValidationV2Report;
  postMaterialization?: ValidationV2Report;
}

interface ValidationSummaryProps {
  validationV2?: ValidationBundle;
}

function labelForStatus(status?: string): string {
  if (!status) return "not available";
  if (status === "passed") return "passed";
  if (status === "passed_with_warnings") return "warnings";
  return status;
}

function issueCount(report?: ValidationV2Report): number {
  return report?.issues.length ?? 0;
}

function ValidationStageCard({ report, title }: { report?: ValidationV2Report; title: string }) {
  return (
    <div className="validation-stage-card">
      <span>{title}</span>
      <strong className={`validation-status validation-${report?.status ?? "missing"}`}>
        {labelForStatus(report?.status)}
      </strong>
      <small>{issueCount(report)} issues</small>
      {report ? (
        <small>
          ZIP: {report.metrics.zipIntegrityPassed ? "ok" : "failed"} · missing: {report.metrics.requiredArtifactsMissing}
        </small>
      ) : null}
    </div>
  );
}

export function ValidationSummary({ validationV2 }: ValidationSummaryProps) {
  if (!validationV2?.preMaterialization && !validationV2?.postMaterialization) {
    return null;
  }

  const reports = [validationV2.preMaterialization, validationV2.postMaterialization].filter(Boolean);
  const issues = reports.flatMap((report) => report?.issues ?? []);

  return (
    <div className="card validation-console-card">
      <div className="card-row">
        <div>
          <span className="section-kicker">Validation v2</span>
          <h3>Generation health</h3>
        </div>
        <span className="status-pill">{issues.length} issues</span>
      </div>
      <div className="validation-stage-grid">
        <ValidationStageCard title="Pre-materialization" report={validationV2.preMaterialization} />
        <ValidationStageCard title="Post-materialization" report={validationV2.postMaterialization} />
      </div>
      {issues.length > 0 ? (
        <details className="inline-debug-details">
          <summary>Validation findings</summary>
          <ul className="note-list">
            {issues.slice(0, 6).map((issue, index) => (
              <li key={`${issue.code}-${issue.path ?? index}`}>
                <strong>{issue.level}:</strong> {issue.message}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p>Required artifacts, paths and ZIP integrity passed the current validation checks.</p>
      )}
    </div>
  );
}
