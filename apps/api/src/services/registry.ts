import fs from "node:fs";
import type { ArtifactRegistryEntry, ProfileId, RegistryOutputDefinition } from "@mag/shared";
import { env } from "../env.js";

function fillTokens(template: string, context: Record<string, string>): string {
  return template.replaceAll(/\$\{([^}]+)\}/g, (_, key: string) => context[key] ?? "");
}

export function loadRegistry(): ArtifactRegistryEntry[] {
  const content = fs.readFileSync(env.REGISTRY_PATH, "utf-8");
  return JSON.parse(content) as ArtifactRegistryEntry[];
}

export function resolveArtifactOutputs(
  artifactId: string,
  profile: ProfileId,
  context: Record<string, string>
): RegistryOutputDefinition[] {
  const entry = loadRegistry().find((item) => item.id === artifactId);
  if (!entry) {
    throw new Error(`Artifact ${artifactId} not found in registry`);
  }

  const outputs = entry.outputs[profile] ?? [];
  return outputs.map((item) => ({
    ...item,
    path: fillTokens(item.path, context),
    template: item.template
  }));
}
