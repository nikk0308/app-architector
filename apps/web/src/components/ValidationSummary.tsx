import type { ValidationV2Report } from "@mag/shared";

interface ValidationBundle {
  preMaterialization?: ValidationV2Report;
  postMaterialization?: ValidationV2Report;
}

interface ValidationSummaryProps {
  validationV2?: ValidationBundle;
  labels?: {
    notAvailable?: string;
    preMaterialization?: string;
    postMaterialization?: string;
    issues?: string;
    generationHealth?: string;
    validationV2?: string;
    zip?: string;
    missing?: string;
    findings?: string;
    passedMessage?: string;
  };
}

function labelForStatus(status: string | undefined, notAvailable: string): string {
  if (!status) return notAvailable;
  if (status === "passed") return "passed";
  if (status === "passed_with_warnings") return "warnings";
  return status;
}

function issueCount(report?: ValidationV2Report): number {
  return report?.issues.length ?? 0;
}

function ValidationStageCard({
  report,
  title,
  labels
}: {
  report?: ValidationV2Report;
  title: string;
  labels: Required<NonNullable<ValidationSummaryProps["labels"]>>;
}) {
  return (
    <div className="validation-stage-card">
      <span>{title}</span>
      <strong className={`validation-status validation-${report?.status ?? "missing"}`}>
        {labelForStatus(report?.status, labels.notAvailable)}
      </strong>
      <small>{issueCount(report)} {labels.issues}</small>
      {report ? (
        <small>
          {labels.zip}: {report.metrics.zipIntegrityPassed ? "ok" : "failed"} · {labels.missing}: {report.metrics.requiredArtifactsMissing}
        </small>
      ) : null}
    </div>
  );
}

export function ValidationSummary({ validationV2, labels }: ValidationSummaryProps) {
  const text = {
    notAvailable: "not available",
    preMaterialization: "Pre-materialization",
    postMaterialization: "Post-materialization",
    issues: "issues",
    generationHealth: "Generation health",
    validationV2: "Validation v2",
    zip: "ZIP",
    missing: "missing",
    findings: "Validation findings",
    passedMessage: "Required artifacts, paths and ZIP integrity passed the current validation checks.",
    ...labels
  };

  if (!validationV2?.preMaterialization && !validationV2?.postMaterialization) {
    return null;
  }

  const reports = [validationV2.preMaterialization, validationV2.postMaterialization].filter(Boolean);
  const issues = reports.flatMap((report) => report?.issues ?? []);

  return (
    <div className="card validation-console-card">
      <div className="card-row">
        <div>
          <span className="section-kicker">{text.validationV2}</span>
          <h3>{text.generationHealth}</h3>
        </div>
        <span className="status-pill">{issues.length} {text.issues}</span>
      </div>
      <div className="validation-stage-grid">
        <ValidationStageCard title={text.preMaterialization} report={validationV2.preMaterialization} labels={text} />
        <ValidationStageCard title={text.postMaterialization} report={validationV2.postMaterialization} labels={text} />
      </div>
      {issues.length > 0 ? (
        <details className="inline-debug-details">
          <summary>{text.findings}</summary>
          <ul className="note-list">
            {issues.slice(0, 6).map((issue, index) => (
              <li key={`${issue.code}-${issue.path ?? index}`}>
                <strong>{issue.level}:</strong> {issue.message}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p>{text.passedMessage}</p>
      )}
    </div>
  );
}
