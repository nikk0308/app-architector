import { describe, expect, it } from "vitest";
import { buildArchitectureSpec, buildArtifactManifest, buildConfigProfile, buildGenerationPlan } from "@mag/shared";

describe("buildGenerationPlan", () => {
  it("includes mandatory core artifacts and selected modules", () => {
    const profile = buildConfigProfile({
      projectName: "Demo",
      appDisplayName: "Demo",
      profile: "react-native",
      hasPush: true
    });

    const plan = buildGenerationPlan(profile);
    const artifactIds = plan.artifacts.map((item) => item.id);

    expect(artifactIds).toContain("common.readme");
    expect(artifactIds).toContain("profile.react-native.base");
    expect(artifactIds).toContain("module.navigation");
    expect(artifactIds).toContain("module.push");
  });

  it("does not re-enable optional profile-default localization when the user explicitly disables it", () => {
    const spec = buildArchitectureSpec({
      projectName: "Demo",
      appDisplayName: "Demo",
      profile: "ios",
      hasLocalization: false,
      hasNetworking: true
    });
    const manifest = buildArtifactManifest(spec);

    expect(spec.features.localization).toBe(false);
    expect(spec.modules.find((module) => module.featureId === "localization")?.enabled).toBe(false);
    expect(manifest.artifacts.some((artifact) => artifact.id === "module.localization")).toBe(false);
  });
});
