import { describe, expect, it } from "vitest";
import { PROFILE_IDS, UNIVERSAL_FEATURES, getProjectProfile } from "@mag/shared";

describe("platform packs v2", () => {
  it("defines a typed support matrix for every profile and feature", () => {
    for (const profileId of PROFILE_IDS) {
      const profile = getProjectProfile(profileId);

      expect(profile.platformPack.profileId).toBe(profileId);
      expect(profile.requiredArtifactIds).toContain("common.readme");
      expect(profile.platformPack.qualityGates.length).toBeGreaterThan(0);
      expect(profile.platformPack.setupSteps.length).toBeGreaterThan(0);

      for (const featureId of UNIVERSAL_FEATURES) {
        expect(["full", "partial", "reserved"]).toContain(profile.capabilities[featureId].supportLevel);
        expect(["full", "partial", "reserved"]).toContain(profile.platformPack.featureMatrix[featureId]);
      }
    }
  });
});
