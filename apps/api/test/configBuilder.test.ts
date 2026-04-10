import { describe, expect, it } from "vitest";
import { buildConfigProfile } from "@mag/shared";

describe("buildConfigProfile", () => {
  it("applies defaults for flutter", () => {
    const result = buildConfigProfile({
      projectName: "Mind Boost",
      appDisplayName: "Mind Boost",
      profile: "flutter"
    });

    expect(result.projectSlug).toBe("mind-boost");
    expect(result.stateManagement).toBe("provider");
    expect(result.navigationStyle).toBe("router");
    expect(result.packageId).toBe("com.example.mindboost");
  });

  it("throws on missing name", () => {
    expect(() => buildConfigProfile({
      projectName: "",
      appDisplayName: "X",
      profile: "ios"
    })).toThrow();
  });
});
