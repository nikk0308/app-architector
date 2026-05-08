import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const phaseFourPayload = {
  projectName: "Phase Four",
  appDisplayName: "Phase Four",
  profile: "flutter",
  includeLLMNotes: true,
  hasNetworking: true,
  hasPersistence: true,
  distributionStores: ["google-play", "apple-app-store"],
  monetization: ["subscription", "in-app-purchases"],
  offlineData: ["offline-cache", "sync-queue"],
  runtimeQuality: ["logging", "crash-reporting"],
  delivery: ["release-checklist", "test-plan"]
} as const;

const aiModePayload = {
  ...phaseFourPayload,
  generationMode: "commercial",
  includeLLMNotes: true
} as const;

describe("API smoke", () => {
  it("returns health status", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ok");
    expect(response.json().contractVersions.architectureSpec).toBe("1.0");
    expect(response.json().runtime.checks.length).toBeGreaterThan(0);
    await app.close();
  });

  it("returns runtime readiness checks without leaking secrets", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/health/ready"
    });

    const payload = response.json();
    expect([200, 503]).toContain(response.statusCode);
    expect(["ready", "degraded"]).toContain(payload.status);
    expect(JSON.stringify(payload)).not.toContain("OPENAI_API_KEY");
    expect(JSON.stringify(payload)).not.toContain("HF_TOKEN");
    await app.close();
  });

  it("returns questionnaire schema", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/questionnaire"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().sections.length).toBeGreaterThan(0);
    await app.close();
  });

  it("returns additive AI provider status without requiring tokens", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/providers/status"
    });

    const payload = response.json();
    expect(response.statusCode).toBe(200);
    expect(payload.items.some((item: { provider: string }) => item.provider === "deterministic")).toBe(true);
    expect(payload.items.some((item: { provider: string }) => item.provider === "openai")).toBe(true);
    await app.close();
  });

  it("returns backward-compatible preview artifacts", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/profile/preview",
      payload: phaseFourPayload
    });

    const payload = response.json();
    expect(response.statusCode).toBe(200);
    expect(payload.artifacts.length).toBeGreaterThan(0);
    expect(payload.artifacts.some((artifact: { path: string }) => artifact.path.endsWith("docs/architecture-decisions.md"))).toBe(true);
    expect(payload.fileTree.some((node: { path: string }) => node.path.endsWith("architecture/file-relationships.graph.json"))).toBe(true);
    expect(payload.fileTree.some((node: { path: string }) => /Product\/Monetization|product\/monetization/i.test(node.path))).toBe(true);
    expect(payload.fileTree.some((node: { path: string }) => /Product\/Distribution|product\/distribution|release/i.test(node.path))).toBe(true);
    await app.close();
  });

  it("returns ArchitectureSpec synthesis metadata for AI modes", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/profile/preview",
      payload: aiModePayload
    });

    const payload = response.json();
    expect(response.statusCode).toBe(200);
    expect(payload.spec.generationMode).toBe("commercial");
    expect(payload.spec.features.llmNotes).toBe(true);
    expect(payload.architectureSynthesis.mode).toBe("commercial");
    expect(["ai-applied", "repaired", "fallback", "baseline"]).toContain(payload.architectureSynthesis.status);
    expect(payload.manifest.summary.totalArtifacts).toBeGreaterThan(0);
    await app.close();
  });

  it("returns advisor plan together with preview data", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/advisor/plan",
      payload: aiModePayload
    });

    const payload = response.json();
    expect(response.statusCode).toBe(200);
    expect(payload.advisor.summary.length).toBeGreaterThan(0);
    expect(payload.validation.status).toBe("passed");
    expect(payload.preview.manifest.summary.totalArtifacts).toBeGreaterThan(0);
    expect(payload.preview.architectureSynthesis.mode).toBe("commercial");
    await app.close();
  });

  it("materializes ZIP from the stored architecture preview snapshot", async () => {
    const app = createApp();
    const preview = await app.inject({
      method: "POST",
      url: "/api/architecture/preview",
      payload: {
        ...phaseFourPayload,
        profile: "ios",
        architectureStyle: "feature-first",
        hasAuth: true,
        includeExampleScreen: true
      }
    });

    const previewPayload = preview.json();
    expect(preview.statusCode).toBe(200);
    expect(previewPayload.previewId).toBeTruthy();
    expect(previewPayload.fileTree.some((node: { path: string }) => node.path.endsWith("AuthViewModel.swift"))).toBe(true);

    const generation = await app.inject({
      method: "POST",
      url: "/api/generations/from-preview",
      payload: { previewId: previewPayload.previewId }
    });

    const generationPayload = generation.json();
    expect(generation.statusCode).toBe(200);
    expect(generationPayload.generationId).toBeTruthy();
    expect(generationPayload.spec).toEqual(previewPayload.spec);
    expect(generationPayload.manifest).toEqual(previewPayload.manifest);
    expect(generationPayload.fileTree).toEqual(previewPayload.fileTree);
    expect(generationPayload.zipPath).toBeTruthy();
    await app.close();
  });

  it("returns generation artifacts and advisor summary after creating a ZIP", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/generations",
      payload: phaseFourPayload
    });

    const payload = response.json();
    expect(response.statusCode).toBe(200);
    expect(payload.generationId).toBeTruthy();
    expect(payload.zipPath).toBeTruthy();
    expect(payload.artifacts.some((artifact: { path: string; kind: string }) => artifact.path.endsWith("docs/architecture-decisions.md") && artifact.kind === "documentation")).toBe(true);
    expect(payload.advisorSummary.summary.length).toBeGreaterThan(0);
    expect(payload.advisorSummary.mode).toBeTruthy();
    await app.close();
  });

  it("returns structured run details and compare-ready metrics", async () => {
    const app = createApp();
    const first = await app.inject({
      method: "POST",
      url: "/api/generations",
      payload: phaseFourPayload
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/generations",
      payload: aiModePayload
    });

    const firstPayload = first.json();
    const secondPayload = second.json();
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(firstPayload.runMetrics.fileCount).toBeGreaterThan(0);
    expect(firstPayload.runMetrics.fileCount).toBeGreaterThan(100);
    expect(secondPayload.runMetrics.fileCount).toBeGreaterThan(firstPayload.runMetrics.fileCount);
    expect(firstPayload.runArtifacts.length).toBeGreaterThan(0);
    expect(firstPayload.validationV2.preMaterialization.status).toMatch(/passed/);
    expect(firstPayload.validationV2.postMaterialization.status).toMatch(/passed/);

    const details = await app.inject({
      method: "GET",
      url: `/api/generations/${firstPayload.generationId}/details`
    });
    const detailsPayload = details.json();
    expect(details.statusCode).toBe(200);
    expect(detailsPayload.metadata.id).toBe(firstPayload.generationId);
    expect(detailsPayload.metrics.artifactCount).toBeGreaterThan(0);
    expect(detailsPayload.artifacts.some((artifact: { generated: boolean }) => artifact.generated)).toBe(true);
    expect(detailsPayload.validationV2.postMaterialization.metrics.zipIntegrityPassed).toBe(true);

    const compare = await app.inject({
      method: "GET",
      url: `/api/generations/compare?ids=${firstPayload.generationId},${secondPayload.generationId}`
    });
    const comparePayload = compare.json();
    expect(compare.statusCode).toBe(200);
    expect(comparePayload.runs).toHaveLength(2);
    expect(comparePayload.baselineRunId).toBeTruthy();
    expect(comparePayload.runs[0].analysis.sourceFiles).toBeGreaterThan(0);
    expect(comparePayload.runs[1].analysis.integrationFiles).toBeGreaterThanOrEqual(comparePayload.runs[0].analysis.integrationFiles);
    expect(comparePayload.runs[1].analysis.evidencePaths.length).toBeGreaterThan(0);
    await app.close();
  }, 20000);

  it("deletes generation history records and generated files through the API", async () => {
    const app = createApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/generations",
      payload: phaseFourPayload
    });
    const createdPayload = created.json();
    expect(created.statusCode).toBe(200);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/generations/${createdPayload.generationId}`
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().deleted).toBe(true);

    const missing = await app.inject({
      method: "GET",
      url: `/api/generations/${createdPayload.generationId}`
    });
    expect(missing.statusCode).toBe(404);

    const cleared = await app.inject({
      method: "DELETE",
      url: "/api/generations"
    });
    expect(cleared.statusCode).toBe(200);
    expect(typeof cleared.json().deleted).toBe("number");
    await app.close();
  });
});
