import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
  type FileRelationshipGraph,
  type ArchitectureAdvisorReport,
  type ArchitectureSpec,
  type HybridRefinementReport,
  type TreeNode,
  type ArtifactManifest,
  type ArchitectureSynthesisSummary,
  type GenerationPlan,
  type NormalizedProfile,
  type ValidationV2Report,
  type ValidationReport,
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
import { buildRuntimeHealthReport } from "./services/runtimeHealth.js";

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

interface PreviewPayload {
  profile: NormalizedProfile;
  spec: ArchitectureSpec;
  plan: GenerationPlan;
  manifest: ArtifactManifest;
  validation: {
    spec: ValidationReport;
    manifest: ValidationReport;
  };
  validationV2?: {
    preMaterialization?: ValidationV2Report;
    postMaterialization?: ValidationV2Report;
  };
  fileTree: TreeNode[];
  artifacts: GeneratedArtifactSummary[];
  notes: string[];
  architectureSynthesis: ArchitectureSynthesisSummary;
  advisor?: ArchitectureAdvisorReport;
  advisorSummary?: GenerationAdvisorSummary;
  hybridRefinement?: HybridRefinementReport;
}

class AiExecutionError extends Error {
  statusCode = 502;

  constructor(message: string) {
    super(message);
    this.name = "AiExecutionError";
  }
}

function shouldEnforceAiExecution(): boolean {
  // AI modes should fail loudly instead of silently looking like baseline.
  // Set STRICT_AI_MODE_FAILURES=false only for local/CI smoke tests without LLM credentials.
  return env.LLM_ENABLED && env.STRICT_AI_MODE_FAILURES;
}

function assertRequiredAiExecution(preview: PreviewPayload): void {
  if (!shouldEnforceAiExecution()) {
    return;
  }

  const mode = preview.profile.generationMode;
  if (mode === "commercial" || mode === "hf-open") {
    const synthesis = preview.architectureSynthesis;
    if (!synthesis.usedAi || synthesis.provider === "deterministic" || synthesis.status === "fallback") {
      const providerLabel = mode === "commercial" ? "OpenAI / GPT" : "Hugging Face / Qwen";
      const reason = synthesis.warnings.length > 0 ? ` Reason: ${synthesis.warnings.join(" ")}` : "";
      throw new AiExecutionError(`${providerLabel} generation did not complete with AI. Deterministic fallback is disabled for this mode.${reason}`);
    }

    const blueprintModules = preview.spec.aiBlueprint?.modules.length ?? 0;
    const blueprintFiles = preview.spec.aiBlueprint?.modules.reduce((sum, module) => sum + module.files.length, 0) ?? 0;
    if (blueprintModules < 4 || blueprintFiles < 20) {
      const providerLabel = mode === "commercial" ? "OpenAI / GPT" : "Hugging Face / Qwen";
      const reason = synthesis.warnings.length > 0 ? ` Reason: ${synthesis.warnings.join(" ")}` : "";
      throw new AiExecutionError(`${providerLabel} returned JSON, but it did not produce a usable architecture blueprint (${blueprintModules} modules, ${blueprintFiles} files).${reason}`);
    }
  }

  if (mode === "hybrid") {
    const synthesis = preview.architectureSynthesis;
    const blueprintModules = preview.spec.aiBlueprint?.modules.length ?? 0;
    const blueprintFiles = preview.spec.aiBlueprint?.modules.reduce((sum, module) => sum + module.files.length, 0) ?? 0;
    const synthesisOk = synthesis.usedAi && synthesis.provider !== "deterministic" && synthesis.status !== "fallback" && blueprintModules >= 4 && blueprintFiles >= 20;
    const refinement = preview.hybridRefinement;
    const hasAcceptedPatches = (refinement?.acceptedPatches.length ?? 0) > 0;
    const validStatus = refinement?.status === "applied" || refinement?.status === "partial";
    const refinementOk = Boolean(refinement?.enabled && refinement.provider !== "deterministic" && validStatus && hasAcceptedPatches);

    if (!synthesisOk && !refinementOk) {
      const synthesisReason = synthesis.warnings.length ? ` Synthesis: ${synthesis.warnings.join(" ")}` : "";
      const refinementReason = refinement?.warnings.length ? ` Refinement: ${refinement.warnings.join(" ")}` : "";
      throw new AiExecutionError(`Hybrid generation did not complete AI-backed blueprint/refinement. Deterministic fallback is disabled for hybrid mode.${synthesisReason}${refinementReason}`);
    }
  }
}

async function buildArchitecturePreviewPayload(answers: QuestionnaireAnswers): Promise<PreviewPayload> {
  const preview = await buildPreviewPayload(answers);
  const advisorReport = await buildArchitectureAdvisorReport({
    answers,
    spec: preview.spec,
    manifest: preview.manifest,
    validation: preview.validation.manifest,
    mode: preview.profile.generationMode
  });

  const hybridRefinement = preview.profile.generationMode === "hybrid"
    ? await buildHybridRefinementReport({
      answers,
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

  const payload: PreviewPayload = {
    ...preview,
    fileTree: responseFileTree,
    artifacts: buildGeneratedArtifacts(responseFileTree),
    notes: hybridRefinement
      ? [...preview.notes, "Hybrid refinement preview was built under allowlisted documentation policy."]
      : preview.notes,
    advisor: advisorReport,
    advisorSummary: buildAdvisorSummary(advisorReport),
    hybridRefinement,
    validationV2: {
      ...preview.validationV2,
      preMaterialization: preMaterializationValidation
    }
  };

  assertRequiredAiExecution(payload);
  return payload;
}

function parseSnapshotJson<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readRelationshipGraphFromOutput(outputDir: string, rootFolderName: string): FileRelationshipGraph | undefined {
  const graphPath = path.join(outputDir, rootFolderName, "architecture", "file-relationships.graph.json");
  if (!fs.existsSync(graphPath)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(graphPath, "utf8")) as FileRelationshipGraph;
  } catch {
    return undefined;
  }
}

function saveArchitecturePreviewSnapshot(answers: QuestionnaireAnswers, preview: PreviewPayload, previewDurationMs = 0): string {
  const previewId = crypto.randomUUID();
  generationRepository.savePreview({
    id: previewId,
    answersJson: JSON.stringify(answers),
    profileJson: JSON.stringify(preview.profile),
    planJson: JSON.stringify(preview.plan),
    specJson: JSON.stringify(preview.spec),
    manifestJson: JSON.stringify(preview.manifest),
    validationJson: JSON.stringify(preview.validation),
    validationV2Json: JSON.stringify(preview.validationV2 ?? {}),
    fileTreeJson: JSON.stringify(preview.fileTree),
    artifactsJson: JSON.stringify(preview.artifacts),
    notesJson: JSON.stringify(preview.notes),
    architectureSynthesisJson: JSON.stringify(preview.architectureSynthesis),
    advisorJson: preview.advisor ? JSON.stringify(preview.advisor) : undefined,
    hybridRefinementJson: preview.hybridRefinement ? JSON.stringify(preview.hybridRefinement) : undefined,
    previewDurationMs
  });
  return previewId;
}

function previewFromSnapshot(snapshotId: string): { answers: QuestionnaireAnswers; preview: PreviewPayload; previewDurationMs: number } | null {
  const snapshot = generationRepository.getPreviewById(snapshotId);
  if (!snapshot) {
    return null;
  }

  const validation = parseSnapshotJson<PreviewPayload["validation"]>(snapshot.validationJson, {
    spec: { status: "failed", issues: [], metrics: { missingRequiredArtifacts: 0, unsupportedEnabledFeatures: 0, duplicateArtifacts: 0 } },
    manifest: { status: "failed", issues: [], metrics: { missingRequiredArtifacts: 0, unsupportedEnabledFeatures: 0, duplicateArtifacts: 0 } }
  });

  return {
    answers: parseSnapshotJson<QuestionnaireAnswers>(snapshot.answersJson, {} as QuestionnaireAnswers),
    preview: {
      profile: parseSnapshotJson<NormalizedProfile>(snapshot.profileJson, {} as NormalizedProfile),
      plan: parseSnapshotJson<GenerationPlan>(snapshot.planJson, {} as GenerationPlan),
      spec: parseSnapshotJson<ArchitectureSpec>(snapshot.specJson, {} as ArchitectureSpec),
      manifest: parseSnapshotJson<ArtifactManifest>(snapshot.manifestJson, {} as ArtifactManifest),
      validation,
      validationV2: parseSnapshotJson<PreviewPayload["validationV2"]>(snapshot.validationV2Json, {}),
      fileTree: parseSnapshotJson<TreeNode[]>(snapshot.fileTreeJson, []),
      artifacts: parseSnapshotJson<GeneratedArtifactSummary[]>(snapshot.artifactsJson, []),
      notes: parseSnapshotJson<string[]>(snapshot.notesJson, []),
      architectureSynthesis: parseSnapshotJson<ArchitectureSynthesisSummary>(
        snapshot.architectureSynthesisJson,
        { provider: "deterministic", mode: "baseline", usedAi: false, status: "baseline", warnings: [], assumptions: [], risks: [], recommendations: [] }
      ),
      advisor: parseSnapshotJson<ArchitectureAdvisorReport | undefined>(snapshot.advisorJson, undefined),
      advisorSummary: buildAdvisorSummary(parseSnapshotJson<ArchitectureAdvisorReport | undefined>(snapshot.advisorJson, undefined)),
      hybridRefinement: parseSnapshotJson<HybridRefinementReport | undefined>(snapshot.hybridRefinementJson, undefined)
    },
    previewDurationMs: typeof snapshot.previewDurationMs === "number" && Number.isFinite(snapshot.previewDurationMs)
      ? Math.max(0, Math.round(snapshot.previewDurationMs))
      : 0
  };
}

async function materializePreview(input: {
  answers: QuestionnaireAnswers;
  preview: PreviewPayload;
  previewDurationMs?: number;
  totalStartedAt?: number;
}): Promise<{
  success: true;
  response: Record<string, unknown>;
} | {
  success: false;
  statusCode: number;
  response: Record<string, unknown>;
}> {
  const materializationStartedAt = Date.now();
  const { answers, preview } = input;
  const directories = createRunDirectories(preview.profile.projectSlug);
  const preMaterializationValidation = preview.validationV2?.preMaterialization ?? buildPreMaterializationValidation({
    manifest: preview.manifest,
    fileTree: preview.fileTree,
    architectureSynthesis: preview.architectureSynthesis,
    hybridRefinement: preview.hybridRefinement
  });

  const generationResult = await generatorRunner.run({
    generationId: directories.generationId,
    profile: preview.profile,
    spec: preview.spec,
    plan: preview.plan,
    manifest: preview.manifest,
    validation: preview.validation.manifest,
    architectureSynthesis: preview.architectureSynthesis,
    advisorReport: preview.advisor,
    hybridRefinement: preview.hybridRefinement,
    outputDir: directories.outputDir,
    zipPath: directories.zipPath
  });

  const generatedArtifacts = preview.artifacts.length > 0 ? preview.artifacts : buildGeneratedArtifacts(preview.fileTree);
  const postMaterializationValidation = generationResult.success
    ? buildPostMaterializationValidation({
      outputDir: directories.outputDir,
      zipPath: directories.zipPath,
      manifest: preview.manifest,
      architectureSynthesis: preview.architectureSynthesis,
      hybridRefinement: preview.hybridRefinement
    })
    : undefined;
  const validationV2 = {
    preMaterialization: preMaterializationValidation,
    postMaterialization: postMaterializationValidation
  };
  const runMetrics = scoreRunMetrics({
    generationTimeMs: input.totalStartedAt
      ? Date.now() - input.totalStartedAt
      : (input.previewDurationMs ?? 0) + (Date.now() - materializationStartedAt),
    artifactCount: preview.manifest.summary.totalArtifacts,
    fileCount: preview.fileTree.filter((node) => node.type === "file").length,
    validation: preview.validation.manifest,
    advisor: preview.advisor ? {
      ...preview.advisor,
      warnings: [
        ...preview.advisor.warnings,
        ...validationV2Warnings(preMaterializationValidation, postMaterializationValidation)
      ]
    } : undefined,
    architectureSynthesis: preview.architectureSynthesis,
    hybridRefinement: preview.hybridRefinement,
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
  const relationshipGraph = generationResult.success
    ? readRelationshipGraphFromOutput(directories.outputDir, preview.manifest.rootFolderName)
    : undefined;

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
    answersJson: JSON.stringify(answers),
    profileJson: JSON.stringify(preview.profile),
    planJson: JSON.stringify(preview.plan),
    specJson: JSON.stringify(preview.spec),
    manifestJson: JSON.stringify(preview.manifest),
    validationJson: JSON.stringify(preview.validation),
    validationV2Json: JSON.stringify(validationV2),
    architectureSynthesisJson: JSON.stringify(preview.architectureSynthesis),
    advisorJson: preview.advisor ? JSON.stringify(preview.advisor) : undefined,
    hybridRefinementJson: preview.hybridRefinement ? JSON.stringify(preview.hybridRefinement) : undefined,
    metricsJson: JSON.stringify(runMetrics),
    generatorLogPath: generationResult.logFilePath,
    diagnosticsPath: generationResult.diagnosticsPath,
    errorMessage: generationResult.error
  };

  generationRepository.save(metadata, runArtifacts);

  if (!generationResult.success) {
    return {
      success: false,
      statusCode: 500,
      response: {
        error: generationResult.error ?? "Generation failed",
        generationId: directories.generationId,
        logFilePath: generationResult.logFilePath,
        diagnosticsPath: generationResult.diagnosticsPath
      }
    };
  }

  return {
    success: true,
    response: {
      ...preview,
      generationId: directories.generationId,
      zipPath: generationResult.zipPath,
      logFilePath: generationResult.logFilePath,
      diagnosticsPath: generationResult.diagnosticsPath,
      artifacts: generatedArtifacts,
      runArtifacts,
      runMetrics,
      relationshipGraph,
      validationV2,
      advisorSummary: preview.advisorSummary,
      advisor: preview.advisor,
      hybridRefinement: preview.hybridRefinement
    }
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
  void rootFolderName;
  void synthesis;
  return fileTree;
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
  if (normalized.includes("/architecture/") && normalized.endsWith(".json")) {
    return "metadata";
  }
  if (normalized.includes("/docs/") || normalized.endsWith("/readme.md")) {
    return "documentation";
  }
  if (normalized.endsWith(".json") || normalized.endsWith(".yaml") || normalized.endsWith(".yml") || normalized.endsWith(".env.example") || normalized.endsWith(".xcconfig") || normalized.endsWith(".plist") || normalized.endsWith(".uxml") || normalized.endsWith(".uss") || normalized.endsWith(".prefab") || normalized.endsWith(".unity")) {
    return "config";
  }
  if (/\.(ts|tsx|js|jsx|swift|dart|cs|arb)$/i.test(filePath)) {
    return "source";
  }
  return "other";
}

function artifactDescription(filePath: string): string {
  const normalized = filePath.toLowerCase();
  const name = path.basename(filePath);
  if (filePath.endsWith("architecture/file-relationships.graph.json")) {
    return "Graph-ready relationship map connecting source, configs, resources, scenes, prefabs and module boundaries.";
  }
  if (filePath.endsWith("architecture/artifact-manifest.json")) {
    return "Manifest of generated files and architecture blocks used to audit the ZIP output.";
  }
  if (filePath.endsWith("architecture/architecture-advisor.json")) {
    return "Advisor report with architecture rationale, warnings, assumptions and next implementation checks.";
  }
  if (filePath.endsWith("architecture/architecture-spec.json")) {
    return "Structured ArchitectureSpec snapshot that the deterministic materializer used for this ZIP.";
  }
  if (filePath.endsWith("architecture/validation-report.json")) {
    return "Validation report for required files, manifest consistency and generated ZIP integrity.";
  }
  if (filePath.endsWith("docs/architecture-decisions.md")) {
    return "Readable architecture decisions and next steps for the generated starter.";
  }
  if (filePath.endsWith("docs/next-steps.md")) {
    return "AI-refined next steps generated within the hybrid documentation allowlist.";
  }
  if (filePath.endsWith("README.md")) {
    return "Project overview and setup notes.";
  }
  if (filePath.endsWith(".prefab")) {
    return "Unity prefab resource for a generated UI, manager or composition boundary.";
  }
  if (filePath.endsWith(".unity")) {
    return "Unity scene asset used to bootstrap or demonstrate the generated app.";
  }
  if (filePath.endsWith(".uxml") || filePath.endsWith(".uss")) {
    return "Unity UI Toolkit resource for generated interface structure or styling.";
  }
  if (normalized.includes("appmanager")) {
    return "Central app manager that coordinates lifecycle, state, navigation and service wiring.";
  }
  if (normalized.includes("coordinator") || normalized.includes("navigator") || normalized.includes("router") || normalized.includes("route")) {
    return "Navigation boundary that connects app entry, screens and feature flows.";
  }
  if (normalized.includes("auth")) {
    return "Authentication boundary for session state, token handling, repositories or auth screens.";
  }
  if (normalized.includes("analytics") || normalized.includes("event")) {
    return "Analytics boundary that keeps event tracking typed and consistent across the app.";
  }
  if (normalized.includes("localization") || normalized.includes("i18n") || normalized.includes("l10n") || normalized.endsWith(".arb") || normalized.endsWith(".xcstrings")) {
    return "Localization resource or access layer used by screens and runtime text helpers.";
  }
  if (normalized.includes("push") || normalized.includes("notification")) {
    return "Push notification boundary for provider setup, runtime permissions or notification routing.";
  }
  if (normalized.includes("network") || normalized.includes("api") || normalized.includes("endpoint")) {
    return "Networking boundary for API clients, endpoints, request errors or transport adapters.";
  }
  if (normalized.includes("persistence") || normalized.includes("storage") || normalized.includes("cache") || normalized.includes("repository")) {
    return "Persistence boundary for local data, cache models, repositories or storage services.";
  }
  if (normalized.includes("monetization") || normalized.includes("paywall") || normalized.includes("purchase") || normalized.includes("subscription")) {
    return "Monetization boundary for paywall, entitlement, purchase gateway or receipt validation logic.";
  }
  if (normalized.includes("distribution") || normalized.includes("release") || normalized.includes("store")) {
    return "Distribution boundary for release targets, store handoff and publication checklist code.";
  }
  if (normalized.includes("offline") || normalized.includes("sync") || normalized.includes("migration")) {
    return "Offline/data boundary for sync queues, cache snapshots, migrations or offline repositories.";
  }
  if (normalized.includes("quality") || normalized.includes("logging") || normalized.includes("diagnostic") || normalized.includes("crash") || normalized.includes("featureflag")) {
    return "Runtime quality boundary for logging, diagnostics, crash reporting or feature flags.";
  }
  if (normalized.includes("delivery") || normalized.includes("pipeline") || normalized.includes("checklist")) {
    return "Delivery boundary for CI/CD handoff, release checks and team workflow scaffolding.";
  }
  if (normalized.includes("viewmodel") || normalized.includes("state") || normalized.includes("store")) {
    return "State boundary that keeps screen state and side effects separated from UI rendering.";
  }
  if (normalized.includes("screen") || normalized.includes("view") || normalized.includes("page") || normalized.includes("widget")) {
    return "UI screen or view file that demonstrates how generated modules connect to the app surface.";
  }
  if (normalized.includes("config") || normalized.includes("env") || normalized.endsWith(".xcconfig") || normalized.endsWith(".env.example")) {
    return "Environment/configuration file used to keep runtime settings outside feature code.";
  }
  if (normalized.endsWith(".md")) {
    return "Documentation file that explains setup, architecture choices or implementation follow-up work.";
  }
  if (/\.(swift|dart|ts|tsx|js|jsx|cs)$/i.test(filePath)) {
    return `${name} implements a generated source-code boundary in the starter architecture.`;
  }
  if (/\.(json|yaml|yml|plist|xml|txt)$/i.test(filePath)) {
    return `${name} stores structured configuration or resource data consumed by generated code.`;
  }
  return "Generated architecture package file with a role inferred from its path and platform.";
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

function isInsideRoot(targetPath: string | undefined, rootPath: string): boolean {
  if (!targetPath) {
    return false;
  }
  const target = path.resolve(targetPath);
  const root = path.resolve(rootPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function removeGeneratedFiles(metadata: GenerationMetadata): string[] {
  const removed: string[] = [];
  const candidates = [
    { target: metadata.outputDir, root: env.GENERATED_OUTPUT_DIR },
    { target: metadata.zipPath, root: env.GENERATED_ZIP_DIR }
  ];

  for (const candidate of candidates) {
    if (!candidate.target || !isInsideRoot(candidate.target, candidate.root) || !fs.existsSync(candidate.target)) {
      continue;
    }
    fs.rmSync(candidate.target, { force: true, recursive: true });
    removed.push(path.resolve(candidate.target));
  }

  return removed;
}

function publicErrorStatusCode(error: unknown): number {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = Number((error as { statusCode?: unknown }).statusCode);
    if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600) {
      return statusCode;
    }
  }
  return 500;
}

function publicErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed";
}

export function createApp(): FastifyInstance {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    requestTimeout: env.API_REQUEST_TIMEOUT_MS,
    bodyLimit: env.REQUEST_BODY_LIMIT_BYTES
  });

  const corsOrigin = env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);
  void app.register(cors, { origin: corsOrigin });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "request failed");
    const statusCode = publicErrorStatusCode(error);
    reply.status(statusCode).send({
      error: error instanceof AiExecutionError || statusCode < 500 ? publicErrorMessage(error) : "Internal server error"
    });
  });

  app.get("/api/health", async () => ({
    status: "ok",
    runtime: buildRuntimeHealthReport(),
    contractVersions: CONTRACT_VERSIONS
  }));

  app.get("/api/health/ready", async (_request, reply) => {
    const runtime = buildRuntimeHealthReport();
    if (runtime.status !== "ready") {
      reply.code(503);
    }
    return runtime;
  });

  app.get("/api/advisor/status", async () => getAdvisorStatus());

  app.get("/api/providers/status", async () => ({
    items: getProviderStatusSummaries()
  }));

  app.get("/api/questionnaire", async () => ({ sections: questionnaireSchema }));

  app.get("/api/generations", async () => ({ items: generationRepository.list() }));

  app.delete("/api/generations", async () => {
    const deleted = generationRepository.clear();
    const removedPaths = deleted.flatMap(removeGeneratedFiles);
    return {
      deleted: deleted.length,
      removedPaths
    };
  });

  app.get<{ Querystring: { ids?: string } }>("/api/generations/compare", async (request) => {
    const ids = (request.query.ids ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);

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

  app.delete<{ Params: { id: string } }>("/api/generations/:id", async (request, reply) => {
    const deleted = generationRepository.deleteById(request.params.id);
    if (!deleted) {
      reply.code(404);
      return { error: "Generation not found" };
    }
    return {
      deleted: true,
      id: deleted.id,
      removedPaths: removeGeneratedFiles(deleted)
    };
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

  app.get("/api/architecture/preview", async (_request, reply) => {
    reply.code(405);
    return {
      error: "Method Not Allowed",
      message: "Architecture preview requires POST with questionnaire answers. The GET route is intentionally kept only to avoid an unhelpful unknown-route error in browser diagnostics.",
      expectedMethod: "POST"
    };
  });

  app.post<{ Body: QuestionnaireAnswers }>("/api/architecture/preview", async (request) => {
    const previewStartedAt = Date.now();
    const preview = await buildArchitecturePreviewPayload(request.body);
    const previewDurationMs = Date.now() - previewStartedAt;
    const previewId = saveArchitecturePreviewSnapshot(request.body, preview, previewDurationMs);
    return {
      previewId,
      createdAt: new Date().toISOString(),
      previewDurationMs,
      ...preview
    };
  });

  app.post<{ Body: QuestionnaireAnswers }>("/api/advisor/plan", async (request) => {
    const preview = await buildArchitecturePreviewPayload(request.body);
    const advisor = preview.advisor;

    return { advisor, validation: preview.validation.manifest, preview };
  });

  app.post<{ Body: { previewId?: string } }>("/api/generations/from-preview", async (request, reply) => {
    const previewId = request.body.previewId?.trim();
    if (!previewId) {
      reply.code(400);
      return { error: "previewId is required" };
    }

    const snapshot = previewFromSnapshot(previewId);
    if (!snapshot) {
      reply.code(404);
      return { error: "Architecture preview not found or expired" };
    }

    const result = await materializePreview(snapshot);
    if (!result.success) {
      reply.code(result.statusCode);
    }
    return result.response;
  });

  app.post<{ Body: QuestionnaireAnswers }>("/api/generations", async (request, reply) => {
    const totalStartedAt = Date.now();
    const preview = await buildArchitecturePreviewPayload(request.body);
    const result = await materializePreview({ answers: request.body, preview, totalStartedAt });
    if (!result.success) {
      reply.code(result.statusCode);
    }
    return result.response;
  });

  return app;
}
