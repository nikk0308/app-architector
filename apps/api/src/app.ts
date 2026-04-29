import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import {
  questionnaireSchema,
  buildArchitectureSpec,
  projectProfileFromSpec,
  buildArtifactManifest,
  manifestToGenerationPlan,
  validateArchitectureSpec,
  validateArtifactManifest,
  type QuestionnaireAnswers,
  type GenerationMetadata
} from "@mag/shared";
import { env } from "./env.js";
import { generationRepository } from "./services/database.js";
import { generatorRunner } from "./services/generatorRunner.js";
import { buildFileTreePreview } from "./services/preview.js";
import { buildTemplateVariables } from "./services/templateVariables.js";
import { createRunDirectories } from "./services/storage.js";
import { buildArchitectureAdvisorReport, getAdvisorStatus } from "./services/advisor/architectureAdvisor.js";

function buildPreviewPayload(answers: QuestionnaireAnswers) {
  const spec = buildArchitectureSpec(answers);
  const profile = projectProfileFromSpec(spec);
  const manifest = buildArtifactManifest(spec);
  const plan = manifestToGenerationPlan(manifest);
  const specValidation = validateArchitectureSpec(spec);
  const manifestValidation = validateArtifactManifest(spec, manifest);
  const templateVariables = buildTemplateVariables(profile, spec, manifest);
  const fileTree = buildFileTreePreview(manifest, templateVariables);

  return {
    profile,
    spec,
    plan,
    manifest,
    validation: {
      spec: specValidation,
      manifest: manifestValidation
    },
    fileTree,
    notes: [...plan.notes, ...manifest.notes]
  };
}

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  const corsOrigin = env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);
  void app.register(cors, { origin: corsOrigin });

  app.get("/api/health", async () => ({ status: "ok" }));

  app.get("/api/advisor/status", async () => getAdvisorStatus());

  app.get("/api/questionnaire", async () => ({ sections: questionnaireSchema }));

  app.get("/api/generations", async () => ({ items: generationRepository.list() }));

  app.get<{ Params: { id: string } }>("/api/generations/:id", async (request, reply) => {
    const generation = generationRepository.getById(request.params.id);
    if (!generation) {
      reply.code(404);
      return { error: "Generation not found" };
    }
    return generation;
  });

  app.get<{ Params: { id: string } }>("/api/generations/:id/download", async (request, reply) => {
    const generation = generationRepository.getById(request.params.id);
    if (!generation?.zipPath || !fs.existsSync(generation.zipPath)) {
      reply.code(404);
      return { error: "Archive not found" };
    }

    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", `attachment; filename="${path.basename(generation.zipPath)}"`);
    return fs.createReadStream(generation.zipPath);
  });

  app.post<{ Body: QuestionnaireAnswers }>("/api/profile/preview", async (request) => {
    return buildPreviewPayload(request.body);
  });

  app.post<{ Body: QuestionnaireAnswers }>("/api/advisor/plan", async (request) => {
    const preview = buildPreviewPayload(request.body);
    const advisor = await buildArchitectureAdvisorReport({
      answers: request.body,
      spec: preview.spec,
      manifest: preview.manifest,
      validation: preview.validation.manifest,
      mode: preview.profile.generationMode
    });

    return { advisor, validation: preview.validation.manifest };
  });

  app.post<{ Body: QuestionnaireAnswers }>("/api/generations", async (request, reply) => {
    const preview = buildPreviewPayload(request.body);
    const directories = createRunDirectories(preview.profile.projectSlug);

    const shouldBuildAdvisorReport = preview.spec.features.llmNotes || preview.profile.generationMode !== "baseline";
    const advisorReport = shouldBuildAdvisorReport
      ? await buildArchitectureAdvisorReport({
        answers: request.body,
        spec: preview.spec,
        manifest: preview.manifest,
        validation: preview.validation.manifest,
        mode: preview.profile.generationMode
      })
      : undefined;

    const generationResult = await generatorRunner.run({
      generationId: directories.generationId,
      profile: preview.profile,
      spec: preview.spec,
      plan: preview.plan,
      manifest: preview.manifest,
      validation: preview.validation.manifest,
      advisorReport,
      outputDir: directories.outputDir,
      zipPath: directories.zipPath
    });

    const metadata: GenerationMetadata = {
      id: directories.generationId,
      profile: preview.profile.profile,
      generationMode: preview.profile.generationMode,
      projectName: preview.profile.projectName,
      status: generationResult.success ? "completed" : "failed",
      createdAt: new Date().toISOString(),
      zipPath: generationResult.success ? generationResult.zipPath : undefined,
      outputDir: directories.outputDir,
      fileTree: preview.fileTree,
      profileJson: JSON.stringify(preview.profile),
      planJson: JSON.stringify(preview.plan),
      specJson: JSON.stringify(preview.spec),
      manifestJson: JSON.stringify(preview.manifest),
      validationJson: JSON.stringify(preview.validation),
      advisorJson: advisorReport ? JSON.stringify(advisorReport) : undefined,
      generatorLogPath: generationResult.logFilePath,
      diagnosticsPath: generationResult.diagnosticsPath,
      errorMessage: generationResult.error
    };

    generationRepository.save(metadata);

    if (!generationResult.success) {
      reply.code(500);
      return {
        error: generationResult.error ?? "Generation failed",
        generationId: directories.generationId,
        logFilePath: generationResult.logFilePath,
        diagnosticsPath: generationResult.diagnosticsPath
      };
    }

    return {
      generationId: directories.generationId,
      zipPath: generationResult.zipPath,
      logFilePath: generationResult.logFilePath,
      diagnosticsPath: generationResult.diagnosticsPath,
      advisor: advisorReport,
      ...preview
    };
  });

  return app;
}
