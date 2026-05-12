import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { QuestionnaireAnswers } from "@mag/shared";

const answers: QuestionnaireAnswers = {
  projectName: "Async Qwen Test",
  appDisplayName: "Async Qwen",
  profile: "unity",
  generationMode: "hf-open",
  packageId: "com.example.asyncqwen",
  architectureStyle: "feature-first",
  stateManagement: "scriptable-object",
  navigationStyle: "scene-flow",
  environmentMode: "multi",
  hasAuth: true,
  hasAnalytics: true,
  hasNetworking: true,
  hasPersistence: true,
  distributionStores: ["google-play"],
  includeExampleScreen: true,
  includeLLMNotes: true
};

async function loadApp() {
  vi.resetModules();
  const root = path.join(os.tmpdir(), `mag-api-test-${crypto.randomUUID()}`);
  vi.stubEnv("DATABASE_PATH", path.join(root, "app.db"));
  vi.stubEnv("OUTPUT_ROOT", path.join(root, "generated"));
  vi.stubEnv("LOG_LEVEL", "silent");
  vi.stubEnv("LLM_ENABLED", "false");
  vi.stubEnv("ENABLE_LLM_ENRICHMENT", "false");
  vi.stubEnv("STRICT_AI_MODE_FAILURES", "false");
  const { createApp } = await import("./app.js");
  return createApp();
}

async function waitForJob(app: FastifyInstance, id: string) {
  for (let index = 0; index < 20; index += 1) {
    const response = await app.inject({
      method: "GET",
      url: `/api/architecture/preview/jobs/${id}`
    });
    const payload = response.json() as { status: string; preview?: unknown; error?: unknown };
    if (payload.status === "completed" || payload.status === "failed") {
      return { response, payload };
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Preview job did not finish during the test window.");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("architecture preview jobs", () => {
  it("returns a job id and completes with the normal preview payload shape", async () => {
    const app = await loadApp();
    try {
      const start = await app.inject({
        method: "POST",
        url: "/api/architecture/preview/jobs",
        payload: answers
      });

      expect(start.statusCode).toBe(200);
      const started = start.json() as { id?: string; status?: string };
      expect(started.id).toBeTruthy();
      expect(started.status).toBe("queued");

      const { response, payload } = await waitForJob(app, String(started.id));
      expect(response.statusCode).toBe(200);
      expect(payload.status).toBe("completed");
      expect(payload.preview).toMatchObject({
        previewId: expect.any(String),
        profile: expect.any(Object),
        spec: expect.any(Object),
        manifest: expect.any(Object),
        fileTree: expect.any(Array)
      });
    } finally {
      await app.close();
    }
  });

  it("returns a structured 404 for an expired or missing preview job", async () => {
    const app = await loadApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/architecture/preview/jobs/missing"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        statusCode: 404,
        message: "Architecture preview job not found or expired"
      });
    } finally {
      await app.close();
    }
  });
});
