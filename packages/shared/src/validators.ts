import { getProjectProfile } from "./profiles.js";
import type { ArchitectureSpec, ArtifactManifest, ValidationIssue, ValidationReport } from "./types.js";

export function validateArchitectureSpec(spec: ArchitectureSpec): ValidationReport {
  const profile = getProjectProfile(spec.profileId);
  const issues: ValidationIssue[] = [];
  const unsupportedEnabledFeatures = spec.modules.filter((module) => module.enabled && !module.supported);

  if (!spec.projectName.trim()) {
    issues.push({ code: "spec.projectName.empty", message: "Project name must not be empty.", level: "error", path: "projectName" });
  }

  if (!spec.appDisplayName.trim()) {
    issues.push({ code: "spec.appDisplayName.empty", message: "App display name must not be empty.", level: "error", path: "appDisplayName" });
  }

  unsupportedEnabledFeatures.forEach((module) => {
    issues.push({
      code: "spec.feature.unsupported",
      message: `${module.featureId} is enabled but not supported for ${profile.label}.`,
      level: "warning",
      path: `modules.${module.featureId}`
    });
  });

  return {
    status: issues.some((issue) => issue.level === "error") ? "failed" : "passed",
    issues,
    metrics: {
      missingRequiredArtifacts: 0,
      unsupportedEnabledFeatures: unsupportedEnabledFeatures.length,
      duplicateArtifacts: 0
    }
  };
}

export function validateArtifactManifest(spec: ArchitectureSpec, manifest: ArtifactManifest): ValidationReport {
  const profile = getProjectProfile(spec.profileId);
  const issues: ValidationIssue[] = [];
  const duplicateArtifacts = manifest.artifacts.filter(
    (artifact, index, list) => list.findIndex((candidate) => candidate.id === artifact.id) !== index
  );

  for (const requiredArtifactId of profile.requiredArtifactIds) {
    if (!manifest.artifacts.some((artifact) => artifact.id === requiredArtifactId)) {
      issues.push({
        code: "manifest.required.missing",
        message: `Required artifact ${requiredArtifactId} is missing from manifest.`,
        level: "error",
        path: "artifacts"
      });
    }
  }

  if (!manifest.artifacts.some((artifact) => artifact.id === "meta.manifest")) {
    issues.push({
      code: "manifest.metadata.manifest-missing",
      message: "Manifest metadata artifact is missing.",
      level: "error",
      path: "artifacts"
    });
  }

  if (!manifest.artifacts.some((artifact) => artifact.id === "meta.validation")) {
    issues.push({
      code: "manifest.metadata.validation-missing",
      message: "Validation report artifact is missing.",
      level: "error",
      path: "artifacts"
    });
  }

  duplicateArtifacts.forEach((artifact) => {
    issues.push({
      code: "manifest.artifact.duplicate",
      message: `Duplicate artifact ${artifact.id} detected in manifest.`,
      level: "error",
      path: "artifacts"
    });
  });

  return {
    status: issues.some((issue) => issue.level === "error") ? "failed" : "passed",
    issues,
    metrics: {
      missingRequiredArtifacts: issues.filter((issue) => issue.code === "manifest.required.missing").length,
      unsupportedEnabledFeatures: 0,
      duplicateArtifacts: duplicateArtifacts.length
    }
  };
}
