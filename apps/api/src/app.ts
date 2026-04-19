import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import {
  buildArchitectureSpec,
  buildArtifactManifest,
  buildConfigProfile,
  buildGenerationPlan,
  validateArtifactManifest,
  validateArchitectureSpec,
  type QuestionnaireAnswers
} from "@mag/shared";
import { env } from "./env.js";
import { buildFileTreePreview } from "./services/preview.js";
import { generationRepository } from "./services/database.js";
import { generatorRunner } from "./services/generatorRunner.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/generated", express.static(path.resolve(env.GENERATED_OUTPUT_DIR)));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/generations", (_req, res) => {
  const items = generationRepository.list();
  res.json({ items });
});

app.get("/api/generations/:id", (req, res) => {
  const item = generationRepository.getById(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Generation not found" });
    return;
  }
  res.json({ item });
});

app.post("/api/preview", (req, res) => {
  const answers = req.body as QuestionnaireAnswers;

  try {
    const profile = buildConfigProfile(answers);
    const spec = buildArchitectureSpec(answers);
    const manifest = buildArtifactManifest(spec);
    const plan = buildGenerationPlan(profile);

    const specValidation = validateArchitectureSpec(spec);
    const manifestValidation = validateArtifactManifest(manifest, spec);
    const validation = {
      status:
        specValidation.status === "passed" && manifestValidation.status === "passed"
          ? "passed"
          : "failed",
      issues: [...specValidation.issues, ...manifestValidation.issues],
      metrics: {
        ...specValidation.metrics,
        ...manifestValidation.metrics
      }
    };

    const fileTree = buildFileTreePreview(manifest, manifest.rootFolderName);

    res.json({
      profile,
      spec,
      manifest,
      plan,
      validation,
      fileTree
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown preview error";
    res.status(400).json({ error: message });
  }
});

app.post("/api/generate", async (req, res) => {
  const answers = req.body as QuestionnaireAnswers;

  try {
    const profile = buildConfigProfile(answers);
    const spec = buildArchitectureSpec(answers);
    const manifest = buildArtifactManifest(spec);
    const plan = buildGenerationPlan(profile);

    const specValidation = validateArchitectureSpec(spec);
    const manifestValidation = validateArtifactManifest(manifest, spec);
    const validation = {
      status:
        specValidation.status === "passed" && manifestValidation.status === "passed"
          ? "passed"
          : "failed",
      issues: [...specValidation.issues, ...manifestValidation.issues],
      metrics: {
        ...specValidation.metrics,
        ...manifestValidation.metrics
      }
    };

    const generationId = randomUUID();
    const generationRoot = path.join(path.resolve(env.GENERATED_OUTPUT_DIR), generationId);
    const projectOutputDir = path.join(generationRoot, manifest.rootFolderName);
    fs.mkdirSync(generationRoot, { recursive: true });

    const zipPath = path.join(generationRoot, `${profile.projectSlug}.zip`);

    const result = await generatorRunner.run({
      generationId,
      profile,
      spec,
      manifest,
      plan,
      validation,
      outputDir: generationRoot,
      zipPath
    });

    const fileTree = buildFileTreePreview(manifest, manifest.rootFolderName);

    generationRepository.save({
      id: generationId,
      profile: profile.profile,
      generationMode: profile.generationMode,
      projectName: profile.projectName,
      status: result.success ? "completed" : "failed",
      zipPath: result.success ? zipPath : undefined,
      outputDir: projectOutputDir,
      fileTree,
      profileJson: JSON.stringify(profile),
      planJson: JSON.stringify(plan),
      specJson: JSON.stringify(spec),
      manifestJson: JSON.stringify(manifest),
      validationJson: JSON.stringify(validation)
    });

    if (!result.success) {
      res.status(500).json({
        error: result.error ?? "Generation failed",
        generationId,
        validation,
        logFilePath: result.logFilePath
      });
      return;
    }

    res.json({
      generationId,
      zipPath,
      fileTree,
      manifest,
      spec,
      plan,
      validation,
      logFilePath: result.logFilePath
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown generation error";
    res.status(400).json({ error: message });
  }
});

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
