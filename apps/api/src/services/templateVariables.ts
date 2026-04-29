import type { ArchitectureAdvisorReport, ArtifactManifest, ArchitectureSpec, NormalizedProfile } from "@mag/shared";

function text(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function bool(value: boolean): string {
  return value ? "true" : "false";
}

function advisorToMarkdown(advisor?: ArchitectureAdvisorReport): string {
  if (!advisor) {
    return "# Architecture Decisions\n\nNo advisor report was requested for this generation.\n";
  }

  const decisions = advisor.decisions
    .map((decision, index) => {
      const files = decision.files.length > 0 ? `\n\nRelated artifacts: ${decision.files.join(", ")}` : "";
      return `### ${index + 1}. ${decision.title}\n\nRecommendation: ${decision.recommendation}\n\nReason: ${decision.rationale}\n\nImpact: ${decision.impact}${files}`;
    })
    .join("\n\n");

  const nextSteps = advisor.nextSteps.length > 0
    ? advisor.nextSteps.map((step) => `- ${step}`).join("\n")
    : "- No additional next steps were produced.";
  const risks = advisor.risks.length > 0
    ? advisor.risks.map((risk) => `- ${risk}`).join("\n")
    : "- No major risks were detected.";
  const warnings = advisor.warnings.length > 0
    ? advisor.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- No warnings.";
  const recommendations = advisor.recommendations && advisor.recommendations.length > 0
    ? advisor.recommendations.map((recommendation) => `- ${recommendation}`).join("\n")
    : "- Continue with the generated starter structure and replace placeholders incrementally.";
  const assumptions = advisor.assumptions && advisor.assumptions.length > 0
    ? advisor.assumptions.map((assumption) => `- ${assumption}`).join("\n")
    : "- The generated package is a starter architecture and requires product-specific implementation.";
  const modules = advisor.modules && advisor.modules.length > 0
    ? advisor.modules.map((module) => `- ${module.id}${module.required ? " (required)" : ""}`).join("\n")
    : "- Module summary was not available.";
  const architecture = advisor.architecture
    ? `${advisor.architecture.style}: ${advisor.architecture.rationale}`
    : "Architecture details were derived from the questionnaire and generated manifest.";
  const mode = advisor.mode ?? advisor.status;
  const llmStatus = advisor.llm
    ? `${advisor.llm.status}${advisor.llm.model ? ` (${advisor.llm.model})` : ""}`
    : "not recorded";

  return `# Architecture Decisions\n\nGenerated at: ${advisor.createdAt}\n\n## Overview\n\n${advisor.summary}\n\n## Selected Architecture\n\n${architecture}\n\n## Generated Modules\n\n${modules}\n\n## Key Assumptions\n\n${assumptions}\n\n## Decisions\n\n${decisions}\n\n## Risks\n\n${risks}\n\n## Recommendations\n\n${recommendations}\n\n## Next Steps\n\n${nextSteps}\n\n## Notes About Advisor Mode\n\n- Status: ${advisor.status}\n- Mode: ${mode}\n- Provider: ${advisor.provider}${advisor.model ? ` (${advisor.model})` : ""}\n- LLM: ${llmStatus}\n\n## Warnings\n\n${warnings}\n`;
}

/**
 * Single source of truth for template and path substitutions.
 *
 * The Python generator templates mostly use snake_case placeholders, while the
 * TypeScript domain model naturally uses camelCase. Keeping both aliases here
 * prevents the API preview and the real generator from drifting apart.
 */
export function buildTemplateVariables(
  profile: NormalizedProfile,
  spec: ArchitectureSpec,
  manifest: ArtifactManifest,
  advisor?: ArchitectureAdvisorReport
): Record<string, string> {
  const notes = [...spec.dependencyPlan.warnings, ...manifest.notes].join("\n");
  const advisorJson = JSON.stringify(advisor ?? null, null, 2);

  return {
    rootFolderName: manifest.rootFolderName,
    root_folder_name: manifest.rootFolderName,

    projectName: profile.projectName,
    project_name: profile.projectName,

    appDisplayName: profile.appDisplayName,
    app_display_name: profile.appDisplayName,
    display_name: profile.appDisplayName,

    projectSlug: spec.naming.projectSlug,
    project_slug: spec.naming.projectSlug,

    projectPascal: spec.naming.projectPascal,
    project_pascal: spec.naming.projectPascal,

    packageId: spec.naming.packageId,
    package_id: spec.naming.packageId,
    bundle_id: spec.naming.packageId,

    entryPoint: spec.architecture.entryPoint,
    entry_point: spec.architecture.entryPoint,

    profile: spec.profileId,
    profileId: spec.profileId,
    profile_id: spec.profileId,

    generationMode: spec.generationMode,
    generation_mode: spec.generationMode,

    architectureStyle: spec.architecture.style,
    architecture_style: spec.architecture.style,

    stateManagement: spec.architecture.stateManagement,
    state_management: spec.architecture.stateManagement,

    navigationStyle: spec.architecture.navigationStyle,
    navigation_style: spec.architecture.navigationStyle,

    environmentMode: spec.architecture.environmentMode,
    environment_mode: spec.architecture.environmentMode,

    explanation: profile.explanation,
    profile_notes: notes,
    notes,

    feature_auth: bool(spec.features.auth),
    feature_analytics: bool(spec.features.analytics),
    feature_localization: bool(spec.features.localization),
    feature_push: bool(spec.features.push),
    feature_networking: bool(spec.features.networking),
    feature_persistence: bool(spec.features.persistence),
    feature_example_screen: bool(spec.features.exampleScreen),
    feature_llm_notes: bool(spec.features.llmNotes),

    advisor_json: advisorJson,
    advisor_markdown: advisorToMarkdown(advisor),

    artifact_count: text(manifest.summary.totalArtifacts),
    required_artifact_count: text(manifest.summary.requiredArtifacts),
    feature_artifact_count: text(manifest.summary.featureArtifacts)
  };
}
