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
    packageId: spec.naming.packageId,
    entryPoint: spec.architecture.entryPoint,
    profileId: spec.profileId,
    generationMode: spec.generationMode
  };
}
