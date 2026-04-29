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

  it("applies a complete AI ArchitectureSpec patch", async () => {
    const result = await synthesizeArchitectureSpec(payload, {
      llmEnabled: true,
      forcedProvider: "openai",
      providerResult: {
        ok: true,
        model: "test-gpt",
        text: JSON.stringify({
          architectureStyle: "feature-first",
          stateManagement: "zustand",
          navigationStyle: "stack",
          environmentMode: "multi",
          features: {
            auth: true,
            analytics: true,
            localization: true,
            push: false,
            networking: true,
            persistence: true
          },
          includeExampleScreen: true,
          explanation: "AI selected a feature-first React Native starter with explicit service boundaries.",
          assumptions: ["The app starts with an authenticated commerce flow."],
          risks: ["Payments still require a sandbox integration."],
          recommendations: ["Add checkout contract tests before production release."]
        })
      }
    });

    expect(result.metadata.status).toBe("ai-applied");
    expect(result.metadata.usedAi).toBe(true);
    expect(result.metadata.provider).toBe("openai");
    expect(result.spec.architecture.stateManagement).toBe("zustand");
    expect(result.spec.features.analytics).toBe(true);
    expect(result.spec.features.localization).toBe(true);
    expect(result.metadata.recommendations[0]).toContain("checkout");
  });

  it("repairs an incomplete AI patch with deterministic baseline values", async () => {
    const result = await synthesizeArchitectureSpec(payload, {
      llmEnabled: true,
      forcedProvider: "openai",
      providerResult: {
        ok: true,
        model: "test-gpt",
        text: JSON.stringify({
          architectureStyle: "layered",
          features: {
            auth: true,
            networking: true,
            persistence: true
          },
          includeExampleScreen: true,
          explanation: "Partial AI patch."
        })
      }
    });

    expect(result.metadata.status).toBe("repaired");
    expect(result.metadata.usedAi).toBe(true);
    expect(result.spec.architecture.style).toBe("layered");
    expect(result.spec.architecture.stateManagement.length).toBeGreaterThan(0);
    expect(result.metadata.warnings.length).toBeGreaterThan(0);
  });
});
