import type { ArtifactManifest, TreeNode } from "@mag/shared";
import { resolveRegistryOutputs } from "./registry.js";

function substitutePath(pathTemplate: string, variables: Record<string, string>): string {
  return pathTemplate.replace(/\$\{([^}]+)\}/g, (_, key: string) => variables[key] ?? "");
}

export function buildFileTreePreview(
  manifest: ArtifactManifest,
  variables: Record<string, string>
): TreeNode[] {
  const paths = new Set<string>();

  for (const artifact of manifest.artifacts) {
    const outputs = resolveRegistryOutputs(manifest.profileId, artifact.id);
    for (const output of outputs) {
      const resolvedPath = substitutePath(output.path, variables);
      const pathParts = resolvedPath.split("/").filter(Boolean);
      let current = manifest.rootFolderName;
      paths.add(`${current}/`);
      for (const [index, part] of pathParts.entries()) {
        current = `${current}/${part}`;
        const isFile = index === pathParts.length - 1 && /\.[a-z0-9]+$/i.test(part);
        paths.add(isFile ? current : `${current}/`);
      }
    }
  }

  paths.add(`${manifest.rootFolderName}/.mag/`);
  paths.add(`${manifest.rootFolderName}/.mag/architecture-spec.json`);
  paths.add(`${manifest.rootFolderName}/.mag/artifact-manifest.json`);
  paths.add(`${manifest.rootFolderName}/.mag/validation-report.json`);
  paths.add(`${manifest.rootFolderName}/.mag/legacy-plan.json`);

  return Array.from(paths)
    .sort((left, right) => left.localeCompare(right))
    .map((path) => ({
      path,
      type: path.endsWith("/") ? "directory" : "file"
    }));
}
