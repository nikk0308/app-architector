import type { ArtifactManifest, TreeNode, ValidationIssue, ValidationReport } from "../types.js";

export type ValidationStage = "pre-materialization" | "post-materialization";
export type ValidationV2Status = "passed" | "passed_with_warnings" | "failed";

export interface ValidationV2Metrics {
  requiredArtifactsMissing: number;
  duplicatePaths: number;
  invalidPaths: number;
  registryDrift: number;
  templateDrift: number;
  zipIntegrityPassed: boolean;
}

export interface ValidationV2Report {
  schemaVersion: "2.0";
  stage: ValidationStage;
  status: ValidationV2Status;
  issues: ValidationIssue[];
  metrics: ValidationV2Metrics;
}

export interface RegistryDriftInput {
  manifest: ArtifactManifest;
  registryArtifactIds: readonly string[];
  materializerArtifactIds?: readonly string[];
  missingTemplateIds?: readonly string[];
}

export interface GeneratedOutputValidationInput {
  stage: ValidationStage;
  rootFolderName: string;
  fileTree: TreeNode[];
  requiredPaths: readonly string[];
  zipEntries?: readonly string[];
  zipSizeBytes?: number;
}

const validationV2BaseMetrics: ValidationV2Metrics = {
  requiredArtifactsMissing: 0,
  duplicatePaths: 0,
  invalidPaths: 0,
  registryDrift: 0,
  templateDrift: 0,
  zipIntegrityPassed: true
};

function statusFromIssues(issues: ValidationIssue[]): ValidationV2Status {
  if (issues.some((issue) => issue.level === "error")) {
    return "failed";
  }
  if (issues.length > 0) {
    return "passed_with_warnings";
  }
  return "passed";
}

export function buildValidationV2Report(
  stage: ValidationStage,
  issues: ValidationIssue[],
  metrics: Partial<ValidationV2Metrics> = {}
): ValidationV2Report {
  return {
    schemaVersion: "2.0",
    stage,
    status: statusFromIssues(issues),
    issues,
    metrics: {
      ...validationV2BaseMetrics,
      ...metrics
    }
  };
}

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
}

function invalidPathReason(pathValue: string, rootFolderName: string): string | null {
  const normalized = normalizePath(pathValue);
  if (!normalized.trim()) {
    return "Path is empty.";
  }
  if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized)) {
    return "Path must be relative to the generated project.";
  }
  if (normalized.split("/").includes("..")) {
    return "Path must not contain traversal segments.";
  }
  if (normalized.includes("\0")) {
    return "Path must not contain null bytes.";
  }
  if (normalized !== rootFolderName && !normalized.startsWith(`${rootFolderName}/`)) {
    return `Path must stay inside ${rootFolderName}.`;
  }
  return null;
}

export function validateGeneratedOutputStructure(input: GeneratedOutputValidationInput): ValidationV2Report {
  const issues: ValidationIssue[] = [];
  const normalizedPaths = input.fileTree.map((node) => normalizePath(node.path));
  const duplicatePaths = normalizedPaths.filter((pathValue, index, list) => list.indexOf(pathValue) !== index);
  const invalidPaths = normalizedPaths
    .map((pathValue) => ({ pathValue, reason: invalidPathReason(pathValue, input.rootFolderName) }))
    .filter((item): item is { pathValue: string; reason: string } => Boolean(item.reason));

  for (const duplicatePath of [...new Set(duplicatePaths)]) {
    issues.push({
      code: "output.path.duplicate",
      message: `Duplicate generated path detected: ${duplicatePath}.`,
      level: "error",
      path: duplicatePath
    });
  }

  for (const item of invalidPaths) {
    issues.push({
      code: "output.path.invalid",
      message: item.reason,
      level: "error",
      path: item.pathValue
    });
  }

  const filePaths = new Set(input.fileTree.filter((node) => node.type === "file").map((node) => normalizePath(node.path)));
  const zipEntries = input.zipEntries ? new Set(input.zipEntries.map(normalizePath)) : undefined;
  let missingRequiredArtifacts = 0;

  for (const requiredPath of input.requiredPaths.map(normalizePath)) {
    const outputPresent = filePaths.has(requiredPath);
    const zipPresent = zipEntries ? zipEntries.has(requiredPath) : true;
    if (!outputPresent || !zipPresent) {
      missingRequiredArtifacts += 1;
      issues.push({
        code: "output.required.missing",
        message: `Required generated artifact is missing from ${!outputPresent ? "output tree" : "ZIP"}: ${requiredPath}.`,
        level: "error",
        path: requiredPath
      });
    }
  }

  const zipIntegrityPassed = input.zipEntries
    ? Boolean(input.zipSizeBytes && input.zipSizeBytes > 0)
    : true;
  if (!zipIntegrityPassed) {
    issues.push({
      code: "zip.integrity.failed",
      message: "Generated ZIP is missing or empty.",
      level: "error"
    });
  }

  return buildValidationV2Report(input.stage, issues, {
    requiredArtifactsMissing: missingRequiredArtifacts,
    duplicatePaths: new Set(duplicatePaths).size,
    invalidPaths: invalidPaths.length,
    zipIntegrityPassed
  });
}

export function validateRegistryTemplateDrift(input: RegistryDriftInput): ValidationV2Report {
  const issues: ValidationIssue[] = [];
  const registryIds = new Set(input.registryArtifactIds);
  const materializerIds = new Set(input.materializerArtifactIds ?? ["meta.relationships"]);
  const missingTemplateIds = new Set(input.missingTemplateIds ?? []);
  let registryDrift = 0;
  let templateDrift = 0;

  for (const artifact of input.manifest.artifacts) {
    if (!registryIds.has(artifact.id) && !materializerIds.has(artifact.id)) {
      registryDrift += 1;
      issues.push({
        code: "registry.artifact.missing",
        message: `Manifest artifact ${artifact.id} has no registry entry or materializer exemption.`,
        level: artifact.required ? "error" : "warning",
        path: `artifacts.${artifact.id}`
      });
    }
    if (missingTemplateIds.has(artifact.id)) {
      templateDrift += 1;
      issues.push({
        code: "registry.template.missing",
        message: `Manifest artifact ${artifact.id} references a missing template.`,
        level: "error",
        path: `artifacts.${artifact.id}`
      });
    }
  }

  return buildValidationV2Report("pre-materialization", issues, {
    registryDrift,
    templateDrift
  });
}

export function mergeValidationV2Reports(stage: ValidationStage, reports: ValidationV2Report[]): ValidationV2Report {
  const issues = reports.flatMap((report) => report.issues);
  return buildValidationV2Report(stage, issues, {
    requiredArtifactsMissing: reports.reduce((sum, report) => sum + report.metrics.requiredArtifactsMissing, 0),
    duplicatePaths: reports.reduce((sum, report) => sum + report.metrics.duplicatePaths, 0),
    invalidPaths: reports.reduce((sum, report) => sum + report.metrics.invalidPaths, 0),
    registryDrift: reports.reduce((sum, report) => sum + report.metrics.registryDrift, 0),
    templateDrift: reports.reduce((sum, report) => sum + report.metrics.templateDrift, 0),
    zipIntegrityPassed: reports.every((report) => report.metrics.zipIntegrityPassed)
  });
}

export type {
  ValidationIssue,
  ValidationReport
} from "../types.js";
