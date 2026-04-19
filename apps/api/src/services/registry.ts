import { readFileSync } from "node:fs";
import type { ProfileId, RegistryOutputDefinition, ArtifactRegistryEntry } from "@mag/shared";
import { env } from "../env.js";

let cachedEntries: ArtifactRegistryEntry[] | null = null;

function readRegistry(): ArtifactRegistryEntry[] {
  if (cachedEntries) {
    return cachedEntries;
  }
  const raw = readFileSync(env.REGISTRY_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  cachedEntries = Array.isArray(parsed) ? parsed : parsed.artifacts;
  return cachedEntries ?? [];
}

export function resolveRegistryOutputs(profile: ProfileId, artifactId: string): RegistryOutputDefinition[] {
  const entry = readRegistry().find((candidate) => candidate.id === artifactId);
  if (!entry) {
    return [];
  }
  return entry.outputs[profile] ?? entry.outputs.default ?? [];
}
