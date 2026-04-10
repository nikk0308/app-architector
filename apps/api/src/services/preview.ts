import type { GenerationPlan, NormalizedProfile, TreeNode } from "@mag/shared";
import { resolveArtifactOutputs } from "./registry.js";

function directoryEntries(paths: string[]): string[] {
  const set = new Set<string>();
  for (const filePath of paths) {
    const parts = filePath.split("/");
    let cursor = "";
    for (let index = 0; index < parts.length - 1; index += 1) {
      cursor = cursor ? `${cursor}/${parts[index]}` : parts[index];
      set.add(cursor);
    }
  }
  return Array.from(set).sort();
}

export function buildTemplateContext(profile: NormalizedProfile): Record<string, string> {
  return {
    project_name: profile.projectName,
    project_slug: profile.projectSlug,
    project_pascal: profile.projectPascal,
    display_name: profile.appDisplayName,
    package_id: profile.packageId,
    architecture_style: profile.architectureStyle,
    state_management: profile.stateManagement,
    navigation_style: profile.navigationStyle,
    environment_mode: profile.environmentMode,
    profile_id: profile.profile,
    entry_point: profile.entryPoint
  };
}

export function buildFileTreePreview(profile: NormalizedProfile, plan: GenerationPlan): TreeNode[] {
  const context = buildTemplateContext(profile);
  const files = Array.from(new Set(
    plan.artifacts
      .flatMap((artifact) => resolveArtifactOutputs(artifact.id, profile.profile, context))
      .map((item) => item.path)
  ));

  const directories = directoryEntries(files).map((path) => ({ path, type: "directory" as const }));
  const fileNodes = files.map((path) => ({ path, type: "file" as const }));
  return [...directories, ...fileNodes].sort((a, b) => a.path.localeCompare(b.path));
}
