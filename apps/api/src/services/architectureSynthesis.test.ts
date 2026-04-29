import { describe, expect, it } from "vitest";
import type { QuestionnaireAnswers } from "@mag/shared";
import { synthesizeArchitectureSpec } from "./architectureSynthesis.js";

const payload: QuestionnaireAnswers = {
  projectName: "AI Spec",
  appDisplayName: "AI Spec",
  profile: "react-native",
  generationMode: "commercial",
  hasNetworking: true,
  hasPersistence: true,
  includeLLMNotes: true
};

describe("architecture synthesis", () => {
  it("falls back to a valid deterministic spec when AI credentials are unavailable", async () => {
    const result = await synthesizeArchitectureSpec(payload);

    expect(result.spec.profileId).toBe("react-native");
    expect(result.spec.generationMode).toBe("commercial");
    expect(result.spec.features.llmNotes).toBe(true);
    expect(result.spec.modules.some((module) => module.enabled && module.required)).toBe(true);
    expect(["fallback", "baseline"]).toContain(result.metadata.status);
    expect(result.metadata.usedAi).toBe(false);
  });
});
