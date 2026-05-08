import { describe, expect, it } from "vitest";
import { validateGeneratedOutputStructure, validateRegistryTemplateDrift, type ArtifactManifest, type TreeNode } from "@mag/shared";

const manifest: ArtifactManifest = {
  version: "1.0",
  profileId: "flutter",
  generationMode: "baseline",
  rootFolderName: "demo",
  artifacts: [
    {
      id: "common.readme",
      title: "README",
      reason: "required",
      required: true,
      category: "core",
      source: "baseline"
    },
    {
      id: "meta.manifest",
      title: "Manifest",
      reason: "required",
      required: true,
      category: "metadata",
      source: "baseline"
    }
  ],
  summary: { totalArtifacts: 2, requiredArtifacts: 2, featureArtifacts: 0 },
  notes: []
};

describe("validation v2", () => {
  it("fails duplicate and escaping generated paths", () => {
    const fileTree: TreeNode[] = [
      { path: "demo/README.md", type: "file" },
      { path: "demo/README.md", type: "file" },
      { path: "../outside.txt", type: "file" }
    ];

    const report = validateGeneratedOutputStructure({
      stage: "pre-materialization",
      rootFolderName: "demo",
      fileTree,
      requiredPaths: ["demo/README.md", "demo/architecture/file-relationships.graph.json"]
    });

    expect(report.status).toBe("failed");
    expect(report.metrics.duplicatePaths).toBe(1);
    expect(report.metrics.invalidPaths).toBe(1);
    expect(report.metrics.requiredArtifactsMissing).toBe(1);
  });

  it("detects registry drift for required manifest artifacts", () => {
    const report = validateRegistryTemplateDrift({
      manifest,
      registryArtifactIds: ["common.readme"],
      materializerArtifactIds: []
    });

    expect(report.status).toBe("failed");
    expect(report.metrics.registryDrift).toBe(1);
    expect(report.issues[0]?.code).toBe("registry.artifact.missing");
  });
});
