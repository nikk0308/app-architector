import type { ArchitectureSpec, ArtifactManifest, QuestionnaireAnswers, ValidationReport } from "@mag/shared";

export interface AdvisorPromptInput {
  answers: QuestionnaireAnswers;
  spec: ArchitectureSpec;
  manifest: ArtifactManifest;
  validation: ValidationReport;
}

export function buildAdvisorPrompt(input: AdvisorPromptInput): string {
  const compact = {
    app: {
      name: input.spec.appDisplayName,
      projectName: input.spec.projectName,
      slug: input.spec.naming.projectSlug,
      profile: input.spec.profileId,
      architecture: input.spec.architecture,
      domain: input.answers.profile,
      features: input.spec.features,
      modules: input.spec.modules.filter((module) => module.enabled).map((module) => module.featureId)
    },
    manifest: {
      artifactCount: input.manifest.artifacts.length,
      artifacts: input.manifest.artifacts.map((artifact) => ({ id: artifact.id, required: artifact.required, category: artifact.category })).slice(0, 80)
    },
    validation: {
      ok: input.validation.status === "passed",
      errors: input.validation.issues.filter((issue) => issue.level === "error"),
      warnings: input.validation.issues.filter((issue) => issue.level === "warning")
    }
  };

  return [
    "You are an architecture reviewer for a mobile starter-project generator.",
    "Return only compact JSON without markdown fences.",
    "The JSON schema is:",
    "{\"summary\": string, \"decisions\": [{\"id\": string, \"title\": string, \"recommendation\": string, \"rationale\": string, \"impact\": \"low\"|\"medium\"|\"high\", \"files\": string[]}], \"nextSteps\": string[], \"risks\": string[], \"warnings\": string[]}",
    "Keep recommendations practical and tied to the generated artifact ids. Do not invent unsupported technologies.",
    "Input:",
    JSON.stringify(compact, null, 2)
  ].join("\n");
}
