import fs from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  buildConfigProfile,
  buildGenerationPlan,
  questionnaireSchema,
  type QuestionnaireAnswers
} from "@mag/shared";
import { env } from "./env.js";
import { GenerationRepository } from "./services/database.js";
import { buildFileTreePreview } from "./services/preview.js";
import { runGenerator } from "./services/generatorRunner.js";
import { createLlmHelper } from "./services/llm.js";

const answersSchema = z.object({
  projectName: z.string().min(1),
  appDisplayName: z.string().min(1),
  profile: z.enum(["unity", "ios", "flutter", "react-native"]),
  packageId: z.string().optional(),
  architectureStyle: z.string().optional(),
  stateManagement: z.string().optional(),
  navigationStyle: z.string().optional(),
  environmentMode: z.enum(["single", "multi"]).optional(),
  hasAuth: z.boolean().optional(),
  hasAnalytics: z.boolean().optional(),
  hasLocalization: z.boolean().optional(),
  hasPush: z.boolean().optional(),
  hasNetworking: z.boolean().optional(),
  hasPersistence: z.boolean().optional(),
  includeExampleScreen: z.boolean().optional(),
  includeLLMNotes: z.boolean().optional()
});

const healthPayload = {
  status: "ok",
  service: "mobile-architecture-generator-api"
};

export function createApp() {
  const app = Fastify({
    logger: env.LOG_LEVEL === "silent" ? false : { level: env.LOG_LEVEL }
  });
  const repository = new GenerationRepository(env.DATABASE_PATH);
  const llmHelper = createLlmHelper();

  app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN
  });

  app.get("/health", async () => healthPayload);
  app.get("/api/health", async () => healthPayload);

  app.get("/api/questionnaire", async () => ({
    sections: questionnaireSchema
  }));

  app.post("/api/profile/preview", async (request) => {
    const answers = answersSchema.parse(request.body) as QuestionnaireAnswers;
    const profile = buildConfigProfile(answers);
    const plan = buildGenerationPlan(profile);
    const fileTree = buildFileTreePreview(profile, plan);
    const llmNotes = await llmHelper.describe(profile);

    return {
      profile,
      plan,
      fileTree,
      architectureSummary: {
        deterministicCore: true,
        explanation: profile.explanation,
        llmNotes
      }
    };
  });

  app.post("/api/generations", async (request, reply) => {
    const answers = answersSchema.parse(request.body) as QuestionnaireAnswers;
    const profile = buildConfigProfile(answers);
    const plan = buildGenerationPlan(profile);
    const generationId = uuidv4();

    try {
      const result = await runGenerator(profile, plan, generationId);

      repository.save({
        id: generationId,
        profile: profile.profile,
        projectName: profile.projectName,
        status: "completed",
        zipPath: result.zipPath,
        outputDir: result.outputDir,
        fileTree: result.fileTree,
        profileJson: JSON.stringify(profile),
        planJson: JSON.stringify(plan)
      });

      return reply.code(201).send({
        id: generationId,
        profile,
        plan,
        fileTree: result.fileTree,
        zipPath: result.zipPath,
        downloadUrl: `/api/generations/${generationId}/download`
      });
    } catch (error) {
      repository.save({
        id: generationId,
        profile: profile.profile,
        projectName: profile.projectName,
        status: "failed",
        profileJson: JSON.stringify(profile),
        planJson: JSON.stringify(plan)
      });

      return reply.code(500).send({
        error: "generation_failed",
        message: String(error)
      });
    }
  });

  app.get("/api/generations", async () => repository.list());

  app.get("/api/generations/:id", async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const item = repository.getById(params.id);
    if (!item) {
      return reply.code(404).send({ error: "not_found" });
    }
    return item;
  });

  app.get("/api/generations/:id/download", async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const item = repository.getById(params.id);
    if (!item?.zipPath || !fs.existsSync(item.zipPath)) {
      return reply.code(404).send({ error: "archive_not_found" });
    }

    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", `attachment; filename="${profileSafeName(item.projectName)}-${item.profile}.zip"`);
    return reply.send(fs.createReadStream(item.zipPath));
  });

  return app;
}

function profileSafeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
