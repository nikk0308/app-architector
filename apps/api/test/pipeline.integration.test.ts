import crypto from "node:crypto";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildConfigProfile, buildGenerationPlan } from "@mag/shared";
import { runGenerator } from "../src/services/generatorRunner.js";

describe("pipeline integration", () => {
  it("generates zip and file tree for all profiles", async () => {
    const profiles = ["unity", "ios", "flutter", "react-native"] as const;

    for (const profileId of profiles) {
      const profile = buildConfigProfile({
        projectName: `Demo ${profileId}`,
        appDisplayName: `Demo ${profileId}`,
        profile: profileId
      });

      const plan = buildGenerationPlan(profile);
      const result = await runGenerator(profile, plan, crypto.randomUUID());

      expect(result.fileTree.length).toBeGreaterThan(0);
      expect(fs.existsSync(result.zipPath)).toBe(true);
    }
  });
});
