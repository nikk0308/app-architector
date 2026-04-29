import { describe, expect, it } from "vitest";
import {
  buildArchitectureSpec,
  buildArtifactManifest,
  buildConfigProfile,
  validateArtifactManifest,
  type QuestionnaireAnswers
} from "@mag/shared";
import { buildArchitectureAdvisorReport } from "./architectureAdvisor.js";
import { parseAdvisorResponse } from "./parser.js";

const sampleAnswers: QuestionnaireAnswers = {
  projectName: "Phase Three Shop",
  appDisplayName: "Phase Three Shop",
  profile: "ios",
  packageId: "com.example.phase3shop",
  architectureStyle: "mvvm",
  stateManagement: "native",
  navigationStyle: "coordinator",
  environmentMode: "multi",
  hasAuth: true,
  hasAnalytics: true,
  hasLocalization: true,
  hasPush: true,
  hasNetworking: true,
  hasPersistence: true,
  includeExampleScreen: true,
  includeLLMNotes: true,
  generationMode: "hybrid"
};

describe("phase 3 architecture advisor", () => {
  it("builds a deterministic advisor report against the current ArtifactManifest contract", async () => {
    const profile = buildConfigProfile(sampleAnswers);
    const spec = buildArchitectureSpec(sampleAnswers, profile);
    const manifest = buildArtifactManifest(spec);
    const validation = validateArtifactManifest(spec, manifest);

    const report = await buildArchitectureAdvisorReport({
      answers: sampleAnswers,
      spec,
      manifest,
      validation,
      mode: "hybrid"
    });

    expect(["disabled", "fallback"]).toContain(report.status);
    expect(report.provider).toBe("deterministic");
    expect(report.schemaVersion).toBe("1.0");
    expect(report.advisorVersion).toBe("phase3");
    expect(report.llm?.used).toBe(false);
    expect(report.summary.length).toBeGreaterThan(0);
    expect(report.decisions.length).toBeGreaterThan(0);
    expect(report.createdAt).toMatch(/T/);
  });

  it("parses fenced LLM JSON without losing advisor decisions", () => {
    const parsed = parseAdvisorResponse(`\n\`\`\`json\n{\n  "summary": "Use a modular mobile starter.",\n  "decisions": [{"title": "Keep API code isolated", "recommendation": "Keep transport code behind one client.", "rationale": "It protects feature code from transport changes.", "impact": "medium"}],\n  "risks": ["Payment flows need sandbox coverage."],\n  "nextSteps": ["Add generated smoke tests."]\n}\n\`\`\`\n`);

    expect(parsed).not.toBeNull();
    if (!parsed) {
      throw new Error("Expected advisor response to parse.");
    }
    expect(parsed.summary).toContain("modular");
    expect(parsed.decisions).toHaveLength(1);
    expect(parsed.risks[0]).toContain("Payment");
    expect(parsed.nextSteps[0]).toContain("smoke");
  });
});
