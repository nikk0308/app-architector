import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildArtifactManifest, buildArchitectureSpec, buildConfigProfile } from "@mag/shared";
import { buildTemplateVariables } from "../src/services/templateVariables.js";

describe("template variables", () => {
  it("contains both camelCase and snake_case aliases required by generator templates", () => {
    const profile = buildConfigProfile({
      profile: "react-native",
      projectName: "Mind Boost",
      appDisplayName: "Mind Boost"
    });
    const spec = buildArchitectureSpec({
      profile: "react-native",
      projectName: "Mind Boost",
      appDisplayName: "Mind Boost",
      hasNetworking: true
    });
    const manifest = buildArtifactManifest(spec);
    const variables = buildTemplateVariables(profile, spec, manifest);

    expect(variables.display_name).toBe("Mind Boost");
    expect(variables.appDisplayName).toBe("Mind Boost");
    expect(variables.profile_id).toBe("react-native");
    expect(variables.architecture_style).toBe(spec.architecture.style);
    expect(variables.state_management).toBe(spec.architecture.stateManagement);
    expect(variables.environment_mode).toBe(spec.architecture.environmentMode);
  });

  it("covers all ${...} placeholders used by the active template files", () => {
    const profile = buildConfigProfile({
      profile: "flutter",
      projectName: "Mind Boost",
      appDisplayName: "Mind Boost"
    });
    const spec = buildArchitectureSpec({
      profile: "flutter",
      projectName: "Mind Boost",
      appDisplayName: "Mind Boost",
      hasAuth: true,
      hasNetworking: true,
      hasPersistence: true
    });
    const manifest = buildArtifactManifest(spec);
    const variables = buildTemplateVariables(profile, spec, manifest);
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    const templatesRoot = path.resolve(repoRoot, "services", "generator-python", "templates");
    const registryPath = path.resolve(repoRoot, "config", "artifact-registry.json");
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8")) as Array<{
      id: string;
      outputs?: Record<string, Array<{ template?: string }>>;
    }>;
    const artifactIds = new Set(manifest.artifacts.map((artifact) => artifact.id));
    const missing = new Set<string>();

    for (const entry of registry.filter((item) => artifactIds.has(item.id))) {
      for (const output of Object.values(entry.outputs ?? {}).flat()) {
        if (!output.template) {
          continue;
        }
        const raw = fs.readFileSync(path.join(templatesRoot, output.template), "utf8");
        for (const match of raw.matchAll(/\$\{([^}]+)\}/g)) {
          const key = match[1];
          if (!key) {
            continue;
          }
          if (!(key in variables)) {
            missing.add(`${output.template}:${key}`);
          }
        }
      }
    }

    expect([...missing]).toEqual([]);
  });
});
