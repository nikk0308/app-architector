import { describe, expect, it } from "vitest";
import { buildConfigProfile, buildGenerationPlan } from "@mag/shared";

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
});
