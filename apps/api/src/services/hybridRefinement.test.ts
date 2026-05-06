import { describe, expect, it } from "vitest";
import {
  buildArchitectureSpec,
  buildArtifactManifest,
  validateArtifactManifest,
  type QuestionnaireAnswers,
  type TreeNode
} from "@mag/shared";
import { buildHybridRefinementReport } from "./hybridRefinement.js";

const answers: QuestionnaireAnswers = {
  projectName: "Hybrid Demo",
  appDisplayName: "Hybrid Demo",
  profile: "ios",
  generationMode: "hybrid",
  hasAuth: true,
  hasNetworking: true,
  hasPersistence: true,
  includeExampleScreen: true,
  includeLLMNotes: true
};

function inputFixture() {
  const spec = buildArchitectureSpec(answers);
  const manifest = buildArtifactManifest(spec);
  const validation = validateArtifactManifest(spec, manifest);
  const fileTree: TreeNode[] = [
    { path: `${manifest.rootFolderName}/README.md`, type: "file" },
    { path: `${manifest.rootFolderName}/docs/architecture-decisions.md`, type: "file" },
    { path: `${manifest.rootFolderName}/.mag/artifact-manifest.json`, type: "file" }
  ];

  return {
    answers,
    spec,
    manifest,
    validation,
    fileTree,
    mode: "hybrid" as const
  };
}

describe("hybrid refinement", () => {
  it("accepts allowlisted documentation patches from the provider", async () => {
    const result = await buildHybridRefinementReport(inputFixture(), {
      llmEnabled: true,
      forcedProvider: "openai",
      providerResult: {
        ok: true,
        model: "test-gpt",
        text: JSON.stringify({
          patches: [
            {
              path: "docs/next-steps.md",
              kind: "documentation",
              operation: "replace-file",
              content: "# Next Steps\n\n- Connect production auth.\n- Add API contract tests before release.\n",
              rationale: "Adds concrete follow-up work for the generated starter."
            }
          ],
          warnings: []
        })
      }
    });

    expect(result.status).toBe("applied");
    expect(result.provider).toBe("openai");
    expect(result.acceptedPatches).toHaveLength(1);
    expect(result.acceptedPatches[0]?.path).toBe("docs/next-steps.md");
    expect(result.rejectedPatches).toHaveLength(0);
  });

  it("rejects metadata and source-code patches while keeping safe docs", async () => {
    const result = await buildHybridRefinementReport(inputFixture(), {
      llmEnabled: true,
      forcedProvider: "openai",
      providerResult: {
        ok: true,
        model: "test-gpt",
        text: JSON.stringify({
          patches: [
            {
              path: "README.md",
              kind: "documentation",
              operation: "append-section",
              content: "## Product Notes\n\n- Keep service boundaries explicit.\n",
              rationale: "Adds a safe documentation note."
            },
            {
              path: ".mag/architecture-spec.json",
              kind: "documentation",
              operation: "replace-file",
              content: "{}",
              rationale: "Unsafe metadata mutation."
            },
            {
              path: "ios/HybridDemo/Sources/App/HybridDemoApp.swift",
              kind: "documentation",
              operation: "replace-file",
              content: "// unsafe source patch",
              rationale: "Unsafe source mutation."
            }
          ],
          warnings: ["Provider suggested unsafe patches."]
        })
      }
    });

    expect(result.status).toBe("partial");
    expect(result.acceptedPatches).toHaveLength(1);
    expect(result.acceptedPatches[0]?.path).toBe("README.md");
    expect(result.rejectedPatches.map((item) => item.patch.path)).toEqual([
      ".mag/architecture-spec.json",
      "ios/HybridDemo/Sources/App/HybridDemoApp.swift"
    ]);
    expect(result.warnings).toContain("Provider suggested unsafe patches.");
  });

  it("stays disabled outside hybrid mode", async () => {
    const fixture = inputFixture();
    const result = await buildHybridRefinementReport({
      ...fixture,
      mode: "baseline",
      spec: { ...fixture.spec, generationMode: "baseline" }
    });

    expect(result.enabled).toBe(false);
    expect(result.status).toBe("disabled");
    expect(result.acceptedPatches).toHaveLength(0);
  });
});
