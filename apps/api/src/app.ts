import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import {
  questionnaireSchema,
  projectProfileFromSpec,
  buildArtifactManifest,
  manifestToGenerationPlan,
  validateArchitectureSpec,
  validateArtifactManifest,
  type QuestionnaireAnswers,
  type GenerationMetadata,
  type GeneratedArtifactKind,
  type GeneratedArtifactSummary,
  type GenerationAdvisorSummary,
  type ArchitectureAdvisorReport,
  type HybridRefinementReport,
  type TreeNode,
  type ArchitectureSynthesisSummary,
  type ValidationV2Report,
  scoreRunMetrics,
  CONTRACT_VERSIONS
} from "@mag/shared";
import { env } from "./env.js";
import { generationRepository } from "./services/database.js";
import { generatorRunner } from "./services/generatorRunner.js";
import { buildFileTreePreview } from "./services/preview.js";
import { buildTemplateVariables } from "./services/templateVariables.js";
import { createRunDirectories } from "./services/storage.js";
import { buildArchitectureAdvisorReport, getAdvisorStatus } from "./services/advisor/architectureAdvisor.js";
import { getProviderStatusSummaries } from "./services/providers/status.js";
import { synthesizeArchitectureSpec } from "./services/architectureSynthesis.js";
import { buildHybridRefinementReport } from "./services/hybridRefinement.js";
import { buildRunArtifactRecords } from "./services/runArtifacts.js";
import { buildPostMaterializationValidation, buildPreMaterializationValidation } from "./services/validationV2.js";

async function buildPreviewPayload(answers: QuestionnaireAnswers) {
  const synthesis = await synthesizeArchitectureSpec(answers);
  const spec = synthesis.spec;
  const profile = projectProfileFromSpec(spec);
  const manifest = buildArtifactManifest(spec);
  const plan = manifestToGenerationPlan(manifest);
  const specValidation = validateArchitectureSpec(spec);
  const manifestValidation = validateArtifactManifest(spec, manifest);
  const templateVariables = buildTemplateVariables(profile, spec, manifest);
  const fileTree = withArchitectureSynthesisNode(
    buildFileTreePreview(manifest, templateVariables),
    manifest.rootFolderName,
    synthesis.metadata
  );
  const validationV2 = {
    preMaterialization: buildPreMaterializationValidation({
      manifest,
      fileTree,
      architectureSynthesis: synthesis.metadata
    })
  };

  return {
    profile,
    spec,
    plan,
    manifest,
    validation: {
      spec: specValidation,
      manifest: manifestValidation
    },
    validationV2,
    fileTree,
    artifacts: buildGeneratedArtifacts(fileTree),
    notes: [...plan.notes, ...manifest.notes, ...synthesisNotes(synthesis.metadata)],
    architectureSynthesis: synthesis.metadata
  };
}

function validationV2Warnings(...reports: Array<ValidationV2Report | undefined>): string[] {
  return reports
    .flatMap((report) => report?.issues ?? [])
    .filter((issue) => issue.level === "warning")
    .map((issue) => issue.message);
}

function withArchitectureSynthesisNode(
  fileTree: TreeNode[],
  rootFolderName: string,
  synthesis: ArchitectureSynthesisSummary
): TreeNode[] {
  if (synthesis.mode === "baseline" && !synthesis.usedAi) {
    return fileTree;
  }

  const path = `${rootFolderName}/.mag/architecture-synthesis.json`;
  if (fileTree.some((node) => node.path === path)) {
    return fileTree;
  }
  return [...fileTree, { path, type: "file" }];
}

function withHybridRefinementNodes(
  fileTree: TreeNode[],
  rootFolderName: string,
  refinement?: HybridRefinementReport
): TreeNode[] {
  if (!refinement) {
    return fileTree;
  }

  const existingPaths = new Set(fileTree.map((node) => node.path));
  const additions: TreeNode[] = [];
  const metadataPath = `${rootFolderName}/.mag/hybrid-refinement.json`;
  if (!existingPaths.has(metadataPath)) {
    additions.push({ path: metadataPath, type: "file" });
    existingPaths.add(metadataPath);
  }

  for (const patch of refinement.acceptedPatches) {
    const patchPath = `${rootFolderName}/${patch.path}`;
    if (!existingPaths.has(patchPath)) {
      additions.push({ path: patchPath, type: "file" });
      existingPaths.add(patchPath);
    }
  }

  return [...fileTree, ...additions];
}

function synthesisNotes(synthesis: ArchitectureSynthesisSummary): string[] {
  if (synthesis.status === "ai-applied") {
    return ["AI produced the ArchitectureSpec; the deterministic generator materialized the ZIP structure."];
  }
  if (synthesis.status === "repaired") {
    return ["AI produced the ArchitectureSpec with deterministic safeguards for incomplete fields."];
  }
  if (synthesis.status === "fallback") {
    return ["AI ArchitectureSpec synthesis was unavailable; deterministic fallback kept generation stable."];
  }
  return [];
}

function artifactKindForPath(filePath: string): GeneratedArtifactKind {
  const normalized = filePath.toLowerCase();
  if (normalized.includes("/.mag/")) {
    return "metadata";
  }
  if (normalized.includes("/docs/") || normalized.endsWith("/readme.md")) {
    return "documentation";
  }
  if (normalized.endsWith(".json") || normalized.endsWith(".yaml") || normalized.endsWith(".yml") || normalized.endsWith(".env.example") || normalized.endsWith(".xcconfig")) {
    return "config";
  }
  if (/\.(ts|tsx|js|jsx|swift|dart|cs|arb)$/i.test(filePath)) {
    return "source";
  }
  return "other";
}

function artifactDescription(filePath: string): string {
  if (filePath.endsWith(".mag/architecture-advisor.json")) {
    return "Structured advisor report with mode, assumptions, risks and recommendations.";
  }
  if (filePath.endsWith(".mag/hybrid-refinement.json")) {
    return "Hybrid refinement report with accepted patches, rejected patches and policy warnings.";
  }
  if (filePath.endsWith("docs/architecture-decisions.md")) {
    return "Readable architecture decisions and next steps for the generated starter.";
  }
  if (filePath.endsWith("docs/next-steps.md")) {
    return "AI-refined next steps generated within the hybrid documentation allowlist.";
  }
  if (filePath.endsWith(".mag/artifact-manifest.json")) {
    return "Generated artifact manifest for auditability.";
  }
  if (filePath.endsWith(".mag/validation-report.json")) {
    return "Validation output for the normalized spec and manifest.";
  }
  if (filePath.endsWith("README.md")) {
    return "Project overview and setup notes.";
  }
  return `${artifactKindForPath(filePath)} artifact`;
}

function buildGeneratedArtifacts(fileTree: TreeNode[]): GeneratedArtifactSummary[] {
  return fileTree
    .filter((node) => node.type === "file")
    .map((node) => ({
      path: node.path,
      kind: artifactKindForPath(node.path),
      description: artifactDescription(node.path)
    }));
}

function buildAdvisorSummary(advisorReport?: ArchitectureAdvisorReport): GenerationAdvisorSummary | undefined {
  if (!advisorReport) {
    return undefined;
  }
  return {
    summary: advisorReport.summary,
    mode: advisorReport.mode ?? advisorReport.status,
    status: advisorReport.status,
    warnings: [...advisorReport.warnings, ...(advisorReport.llm?.warnings ?? [])].filter(Boolean)
  };
}

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  const corsOrigin = env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);
  void app.register(cors, { origin: corsOrigin });

  app.get("/api/health", async () => ({
    status: "ok",
    contractVersions: CONTRACT_VERSIONS
  }));

  app.get("/api/advisor/status", async () => getAdvisorStatus());

  app.get("/api/providers/status", async () => ({
    items: getProviderStatusSummaries()
  }));

  app.get("/api/questionnaire", async () => ({ sections: questionnaireSchema }));

  app.get("/api/generations", async () => ({ items: generationRepository.list() }));

  app.get<{ Querystring: { ids?: string } }>("/api/generations/compare", async (request) => {
    const ids = (request.query.ids ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);

    return generationRepository.compare(ids);
  });

  app.get<{ Params: { id: string } }>("/api/generations/:id/details", async (request, reply) => {
    const generation = generationRepository.getDetailsById(request.params.id);
    if (!generation) {
      reply.code(404);
      return { error: "Generation not found" };
    }
    return generation;
  });

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
    return await buildPreviewPayload(request.body);
  });

  app.post<{ Body: QuestionnaireAnswers }>("/api/advisor/plan", async (request) => {
    const preview = await buildPreviewPayload(request.body);
    const advisor = await buildArchitectureAdvisorReport({
      answers: request.body,
      spec: preview.spec,
      manifest: preview.manifest,
      validation: preview.validation.manifest,
      mode: preview.profile.generationMode
    });

    return { advisor, validation: preview.validation.manifest, preview };
  });

  app.post<{ Body: QuestionnaireAnswers }>("/api/generations", async (request, reply) => {
    const generationStartedAt = Date.now();
    const preview = await buildPreviewPayload(request.body);
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

    const hybridRefinement = preview.profile.generationMode === "hybrid"
      ? await buildHybridRefinementReport({
        answers: request.body,
        spec: preview.spec,
        manifest: preview.manifest,
        validation: preview.validation.manifest,
        fileTree: preview.fileTree,
        advisorReport,
        mode: preview.profile.generationMode
      })
      : undefined;

    const responseFileTree = withHybridRefinementNodes(preview.fileTree, preview.manifest.rootFolderName, hybridRefinement);
    const preMaterializationValidation = buildPreMaterializationValidation({
      manifest: preview.manifest,
      fileTree: responseFileTree,
      architectureSynthesis: preview.architectureSynthesis,
      hybridRefinement
    });

    const generationResult = await generatorRunner.run({
      generationId: directories.generationId,
      profile: preview.profile,
      spec: preview.spec,
      plan: preview.plan,
      manifest: preview.manifest,
      validation: preview.validation.manifest,
      architectureSynthesis: preview.architectureSynthesis,
      advisorReport,
      hybridRefinement,
      outputDir: directories.outputDir,
      zipPath: directories.zipPath
    });

    const generatedArtifacts = buildGeneratedArtifacts(responseFileTree);
    const postMaterializationValidation = generationResult.success
      ? buildPostMaterializationValidation({
        outputDir: directories.outputDir,
        zipPath: directories.zipPath,
        manifest: preview.manifest,
        architectureSynthesis: preview.architectureSynthesis,
        hybridRefinement
      })
      : undefined;
    const validationV2 = {
      preMaterialization: preMaterializationValidation,
      postMaterialization: postMaterializationValidation
    };
    const runMetrics = scoreRunMetrics({
      generationTimeMs: Date.now() - generationStartedAt,
      artifactCount: preview.manifest.summary.totalArtifacts,
      fileCount: responseFileTree.filter((node) => node.type === "file").length,
      validation: preview.validation.manifest,
      advisor: advisorReport ? {
        ...advisorReport,
        warnings: [
          ...advisorReport.warnings,
          ...validationV2Warnings(preMaterializationValidation, postMaterializationValidation)
        ]
      } : undefined,
      architectureSynthesis: preview.architectureSynthesis,
      hybridRefinement,
      zipAvailable: Boolean(generationResult.success && generationResult.zipPath)
    });
    const runArtifacts = generationResult.success
      ? buildRunArtifactRecords({
        runId: directories.generationId,
        rootFolderName: preview.manifest.rootFolderName,
        outputDir: directories.outputDir,
        artifacts: generatedArtifacts
      })
      : [];

    const metadata: GenerationMetadata = {
      id: directories.generationId,
      profile: preview.profile.profile,
      generationMode: preview.profile.generationMode,
      projectName: preview.profile.projectName,
      status: generationResult.success ? "completed" : "failed",
      createdAt: new Date().toISOString(),
      zipPath: generationResult.success ? generationResult.zipPath : undefined,
      outputDir: directories.outputDir,
      fileTree: responseFileTree,
      answersJson: JSON.stringify(request.body),
      profileJson: JSON.stringify(preview.profile),
      planJson: JSON.stringify(preview.plan),
      specJson: JSON.stringify(preview.spec),
      manifestJson: JSON.stringify(preview.manifest),
      validationJson: JSON.stringify(preview.validation),
      validationV2Json: JSON.stringify(validationV2),
      architectureSynthesisJson: JSON.stringify(preview.architectureSynthesis),
      advisorJson: advisorReport ? JSON.stringify(advisorReport) : undefined,
      hybridRefinementJson: hybridRefinement ? JSON.stringify(hybridRefinement) : undefined,
      metricsJson: JSON.stringify(runMetrics),
      generatorLogPath: generationResult.logFilePath,
      diagnosticsPath: generationResult.diagnosticsPath,
      errorMessage: generationResult.error
    };

    generationRepository.save(metadata, runArtifacts);

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
      ...preview,
      fileTree: responseFileTree,
      generationId: directories.generationId,
      zipPath: generationResult.zipPath,
      logFilePath: generationResult.logFilePath,
      diagnosticsPath: generationResult.diagnosticsPath,
      artifacts: generatedArtifacts,
      runArtifacts,
      runMetrics,
      validationV2,
      advisorSummary: buildAdvisorSummary(advisorReport),
      advisor: advisorReport,
      hybridRefinement
    };
  });

  return app;
}
