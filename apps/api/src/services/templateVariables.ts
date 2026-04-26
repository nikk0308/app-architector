import type { ArtifactManifest, ArchitectureSpec, NormalizedProfile } from "@mag/shared";

export function buildTemplateVariables(
  profile: NormalizedProfile,
  spec: ArchitectureSpec,
  manifest: ArtifactManifest
): Record<string, string> {
  return {
    rootFolderName: manifest.rootFolderName,
    projectName: profile.projectName,
    appDisplayName: profile.appDisplayName,
    projectSlug: spec.naming.projectSlug,
    projectPascal: spec.naming.projectPascal,
    project_slug: spec.naming.projectSlug,
    project_pascal: spec.naming.projectPascal,
    app_display_name: spec.naming.appDisplayName,
    package_id: spec.naming.packageId,
    packageId: spec.naming.packageId,
    entryPoint: spec.architecture.entryPoint,
    profileId: spec.profileId,
    generationMode: spec.generationMode
  };
}
