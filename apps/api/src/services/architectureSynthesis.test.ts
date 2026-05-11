import { describe, expect, it } from "vitest";
import type { QuestionnaireAnswers } from "@mag/shared";
import { synthesizeArchitectureSpec } from "./architectureSynthesis.js";


function testBlueprint() {
  return {
    strategy: "Test AI expansion around locked user choices.",
    modules: [
      {
        name: "RevenueReadiness",
        purpose: "Adds production commerce boundaries for the test patch.",
        emphasis: "commercial readiness",
        files: [
          {
            path: "src/revenue/RevenueGuard.ts",
            kind: "source",
            role: "service",
            description: "Checks entitlement state before opening paid features.",
            module: "revenue-readiness"
          },
          {
            path: "src/revenue/RevenueEvents.ts",
            kind: "source",
            role: "event contract",
            description: "Defines commerce analytics events for checkout and restore flows.",
            module: "revenue-readiness"
          },
          {
            path: "docs/revenue-readiness.md",
            kind: "documentation",
            role: "documentation",
            description: "Explains revenue readiness boundaries and checks.",
            module: "revenue-readiness"
          }
        ]
      }
    ],
    relationships: [
      {
        from: "src/revenue/RevenueGuard.ts",
        to: "src/revenue/RevenueEvents.ts",
        relation: "tracks",
        reason: "RevenueGuard emits checkout and restore events through RevenueEvents."
      },
      {
        from: "docs/revenue-readiness.md",
        to: "src/revenue/RevenueGuard.ts",
        relation: "documents",
        reason: "The documentation explains the guard behavior."
      }
    ]
  };
}

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
          recommendations: ["Add checkout contract tests before production release."],
          aiBlueprint: testBlueprint()
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
    expect(result.spec.aiBlueprint?.modules[0]?.files.length).toBeGreaterThan(0);
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
    // AI may explain and enrich the starter, but it must not silently override
    // user-selected architecture knobs from the questionnaire.
    expect(result.spec.architecture.style).toBe(payload.architectureStyle ?? "feature-first");
    expect(result.spec.architecture.stateManagement.length).toBeGreaterThan(0);
    expect(result.metadata.warnings.length).toBeGreaterThan(0);
  });

  it("applies AI ArchitectureSpec blueprint for hybrid before refinement policy is applied", async () => {
    const result = await synthesizeArchitectureSpec({
      ...payload,
      generationMode: "hybrid"
    }, {
      llmEnabled: true,
      forcedProvider: "openai",
      providerResult: {
        ok: true,
        model: "test-gpt",
        text: JSON.stringify({
          architectureStyle: "layered",
          stateManagement: "redux",
          navigationStyle: "ai-router",
          environmentMode: "multi",
          features: {
            auth: true,
            analytics: true,
            localization: true,
            push: true,
            networking: true,
            persistence: true
          },
          includeExampleScreen: true,
          explanation: "Hybrid uses AI blueprint while keeping locked questionnaire choices.",
          assumptions: [],
          risks: [],
          recommendations: [],
          aiBlueprint: testBlueprint()
        })
      }
    });

    expect(result.metadata.mode).toBe("hybrid");
    expect(result.metadata.usedAi).toBe(true);
    expect(result.metadata.status).toBe("ai-applied");
    expect(result.spec.generationMode).toBe("hybrid");
    // Hybrid may deepen the file tree, but user-selected questionnaire knobs stay locked.
    expect(result.spec.architecture.stateManagement).not.toBe("redux");
    expect(result.spec.aiBlueprint?.modules[0]?.files.length).toBeGreaterThan(0);
  });
});
