import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const phaseFourPayload = {
  projectName: "Phase Four",
  appDisplayName: "Phase Four",
  profile: "flutter",
  includeLLMNotes: true,
  hasNetworking: true,
  hasPersistence: true
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
    expect(payload.artifacts.some((artifact: { path: string }) => artifact.path.endsWith(".mag/architecture-advisor.json"))).toBe(true);
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
});
