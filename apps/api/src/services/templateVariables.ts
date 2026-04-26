import type { ArtifactManifest, ArchitectureSpec, NormalizedProfile } from "@mag/shared";

function text(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function bool(value: boolean): string {
  return value ? "true" : "false";
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
  manifest: ArtifactManifest
): Record<string, string> {
  const notes = [...spec.dependencyPlan.warnings, ...manifest.notes].join("\n");

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

    artifact_count: text(manifest.summary.totalArtifacts),
    required_artifact_count: text(manifest.summary.requiredArtifacts),
    feature_artifact_count: text(manifest.summary.featureArtifacts)
  };
}
