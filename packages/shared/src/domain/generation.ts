import type {
  ArchitectureAdvisorReport,
  ArchitectureSynthesisSummary,
  ArchitectureSpec,
  ArtifactManifest,
  GeneratedArtifactKind,
  GeneratedArtifactSummary,
  GenerationAdvisorSummary,
  GenerationMetadata,
  GenerationMode,
  ProfileId,
  QuestionnaireAnswerSet,
  ValidationReport
} from "../types.js";
import type { ValidationV2Report } from "./validation.js";
import type {
  CostEstimate,
  ModelExecutionResult,
  PromptBuildResult
} from "./provider.js";
import type { HybridRefinementReport } from "./hybrid.js";

export type GenerationRunStatus = "success" | "partial" | "failed";

export interface RunMetrics {
  generationTimeMs: number;
  artifactCount: number;
  fileCount: number;
  warningCount: number;
  validationStatus: ValidationReport["status"];
  advisorUsed: boolean;
  providerUsed: boolean;
  architectureProvider: "deterministic" | "huggingface" | "openai";
  hybridPatchCount: number;
  zipAvailable: boolean;
}

export interface RunArtifactRecord {
  runId: string;
  path: string;
  kind: GeneratedArtifactKind;
  required: boolean;
  generated: boolean;
  sizeBytes?: number;
  hash?: string;
  description?: string;
}

export interface GenerationRunError {
  code: string;
  message: string;
  details?: unknown;
}

export interface GenerationRun {
  id: string;
  createdAt: string;
  profileId: ProfileId;
  mode: GenerationMode;
  status: GenerationRunStatus;
  input: QuestionnaireAnswerSet;
  spec: ArchitectureSpec;
  manifest: ArtifactManifest;
  validation: ValidationReport;
  metrics: RunMetrics;
  artifacts: GeneratedArtifactSummary[];
  advisor?: ArchitectureAdvisorReport;
  advisorSummary?: GenerationAdvisorSummary;
  cost?: CostEstimate;
  prompt?: PromptBuildResult;
  execution?: ModelExecutionResult;
  zipPath?: string;
  errorInfo?: GenerationRunError;
}

export interface GenerationRunDetails {
  metadata: GenerationMetadata;
  input?: QuestionnaireAnswerSet;
  spec?: ArchitectureSpec;
  manifest?: ArtifactManifest;
  validation?: ValidationReport;
  validationV2?: {
    preMaterialization?: ValidationV2Report;
    postMaterialization?: ValidationV2Report;
  };
  architectureSynthesis?: ArchitectureSynthesisSummary;
  advisor?: ArchitectureAdvisorReport;
  hybridRefinement?: HybridRefinementReport;
  metrics?: RunMetrics;
  artifacts: RunArtifactRecord[];
  relationshipGraph?: FileRelationshipGraph;
}

export interface FileRelationshipNode {
  id: string;
  path: string;
  kind: string;
  module?: string;
  role?: string;
}

export interface FileRelationshipEdge {
  from: string;
  to: string;
  relation: string;
  reason?: string;
}

export interface FileRelationshipGraph {
  schemaVersion?: string;
  generatedBy?: string;
  summary?: {
    nodes?: number;
    edges?: number;
    connectedFiles?: number;
    isolatedFiles?: number;
    edgeCoveragePercent?: number;
    relationshipDensity?: number;
    averageEdgesPerFile?: number;
    relations?: Record<string, number>;
    [key: string]: unknown;
  };
  graph?: {
    nodes?: FileRelationshipNode[];
    edges?: FileRelationshipEdge[];
  };
}

export interface RunComparisonItem {
  id: string;
  projectName: string;
  profileId: ProfileId;
  mode: GenerationMode;
  status: GenerationMetadata["status"];
  createdAt: string;
  metrics?: RunMetrics;
  advisorStatus?: string;
  architectureProvider?: RunMetrics["architectureProvider"];
  zipAvailable: boolean;
  analysis?: RunComparisonAnalysis;
}

export interface RunComparisonAnalysis {
  sourceFiles: number;
  configFiles: number;
  docsFiles: number;
  metadataFiles: number;
  assetFiles: number;
  testFiles: number;
  relationshipFiles: number;
  relationshipEdgeCount?: number;
  connectedFileCount?: number;
  isolatedFileCount?: number;
  relationshipDensity?: number;
  relationshipCoveragePercent?: number;
  integrationFiles: number;
  resourceFiles: number;
  platformCoreFiles: number;
  selectedModuleCount: number;
  representedModuleCount: number;
  selectedModules: string[];
  representedModules: string[];
  missingModules: string[];
  architectureSignals: string[];
  categoryBreakdown: Record<string, number>;
  evidencePaths: string[];
}

export interface RunComparisonDelta {
  runId: string;
  artifactDelta: number;
  fileDelta: number;
  warningDelta: number;
  generationTimeDeltaMs: number;
}

export interface RunComparison {
  baselineRunId?: string;
  runs: RunComparisonItem[];
  deltas: RunComparisonDelta[];
}

export interface ScoreRunMetricsInput {
  generationTimeMs: number;
  artifactCount: number;
  fileCount: number;
  validation: ValidationReport;
  advisor?: ArchitectureAdvisorReport;
  architectureSynthesis?: ArchitectureSynthesisSummary;
  hybridRefinement?: HybridRefinementReport;
  zipAvailable: boolean;
}

export function scoreRunMetrics(input: ScoreRunMetricsInput): RunMetrics {
  const advisorWarnings = input.advisor?.warnings.length ?? 0;
  const advisorLlmWarnings = input.advisor?.llm?.warnings.length ?? 0;
  const synthesisWarnings = input.architectureSynthesis?.warnings.length ?? 0;
  const hybridWarnings = input.hybridRefinement?.warnings.length ?? 0;

  return {
    generationTimeMs: Math.max(0, Math.round(input.generationTimeMs)),
    artifactCount: input.artifactCount,
    fileCount: input.fileCount,
    warningCount: advisorWarnings + advisorLlmWarnings + synthesisWarnings + hybridWarnings + input.validation.issues.length,
    validationStatus: input.validation.status,
    advisorUsed: Boolean(input.advisor),
    providerUsed: Boolean(input.architectureSynthesis?.usedAi || input.advisor?.llm?.used || (input.hybridRefinement?.acceptedPatches.length ?? 0) > 0),
    architectureProvider: input.architectureSynthesis?.provider ?? "deterministic",
    hybridPatchCount: input.hybridRefinement?.acceptedPatches.length ?? 0,
    zipAvailable: input.zipAvailable
  };
}

const MODULE_PATH_PATTERNS: Record<string, RegExp[]> = {
  auth: [/auth/i, /identity/i, /token/i, /session/i],
  analytics: [/analytics/i, /tracking/i, /event/i, /telemetry/i],
  localization: [/localization/i, /locale/i, /translation/i, /i18n/i, /l10n/i, /xcstrings/i, /\.arb$/i],
  push: [/push/i, /notification/i],
  networking: [/network/i, /api/i, /endpoint/i, /request/i, /response/i],
  storage: [/persistence/i, /storage/i, /cache/i, /repository/i, /migration/i],
  monetization: [/monetization/i, /subscription/i, /purchase/i, /entitlement/i, /paywall/i, /ads/i],
  distribution: [/distribution/i, /store/i, /release/i, /testflight/i, /google-play/i],
  offline: [/offline/i, /sync/i, /queue/i, /snapshot/i],
  quality: [/quality/i, /logging/i, /crash/i, /diagnostic/i, /feature-flag/i],
  delivery: [/delivery/i, /pipeline/i, /checklist/i, /build/i, /ci/i]
};

function moduleKey(featureId: string): string {
  if (featureId === "storage") return "storage";
  if (featureId.startsWith("monetization.")) return "monetization";
  if (featureId.startsWith("distribution.")) return "distribution";
  if (featureId.startsWith("offline.")) return "offline";
  if (featureId.startsWith("quality.")) return "quality";
  if (featureId.startsWith("delivery.")) return "delivery";
  return featureId;
}

function categoryForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes("/architecture/") && lower.endsWith(".json")) return "metadata";
  if (lower.endsWith(".md")) return "documentation";
  if (/\.(test|spec)\.|\/tests?\//i.test(lower)) return "test";
  if (/\.(swift|dart|ts|tsx|js|jsx|cs|kt|java)$/i.test(lower)) return "source";
  if (/\.(json|yaml|yml|xml|plist|env|xcconfig|properties|gradle|pbxproj|lock|arb|xcstrings)$/i.test(lower)) return "config";
  if (/\.(unity)$/i.test(lower)) return "scene";
  if (/\.(prefab)$/i.test(lower)) return "prefab";
  if (/\.(png|jpg|jpeg|webp|svg|asset|mat|fbx|wav|mp3)$/i.test(lower)) return "asset";
  return "other";
}

function platformCorePatterns(profile: ProfileId): RegExp[] {
  if (profile === "ios") return [/sources\/app/i, /sources\/navigation/i, /config\//i, /project\.yml/i];
  if (profile === "flutter") return [/lib\/app/i, /lib\/core/i, /pubspec\.yaml/i, /main\.dart/i];
  if (profile === "react-native") return [/src\/navigation/i, /src\/config/i, /app\.tsx/i, /package\.json/i];
  return [/assets\/scripts\/core/i, /assets\/scenes/i, /assets\/prefabs/i, /projectsettings/i];
}

function analyzeRun(detail: GenerationRunDetails): RunComparisonAnalysis {
  const artifacts = detail.artifacts ?? [];
  const paths = artifacts.map((artifact) => artifact.path);
  const filePaths = paths.filter((path) => !path.endsWith("/"));
  const graphSummary = detail.relationshipGraph?.summary;
  const graphEdges = detail.relationshipGraph?.graph?.edges ?? [];
  const graphConnected = graphSummary?.connectedFiles;
  const graphIsolated = graphSummary?.isolatedFiles;
  const graphCoverage = graphSummary?.edgeCoveragePercent;
  const graphDensity = graphSummary?.relationshipDensity;
  const categoryBreakdown: Record<string, number> = {};
  for (const path of filePaths) {
    const category = categoryForPath(path);
    categoryBreakdown[category] = (categoryBreakdown[category] ?? 0) + 1;
  }

  const selectedFromSpec = (detail.spec?.modules ?? [])
    .filter((module) => module.enabled)
    .map((module) => moduleKey(module.featureId));
  const selectedFromProduct = [
    ...(detail.spec?.product?.distributionStores.length ? ["distribution"] : []),
    ...(detail.spec?.product?.monetization.length ? ["monetization"] : []),
    ...(detail.spec?.product?.offlineData.length ? ["offline"] : []),
    ...(detail.spec?.product?.runtimeQuality.length ? ["quality"] : []),
    ...(detail.spec?.product?.delivery.length ? ["delivery"] : [])
  ];
  const selectedModules = Array.from(new Set([...selectedFromSpec, ...selectedFromProduct]))
    .filter((module) => module in MODULE_PATH_PATTERNS);
  const representedModules = selectedModules.filter((module) => {
    const patterns = MODULE_PATH_PATTERNS[module] ?? [];
    return filePaths.some((path) => patterns.some((pattern) => pattern.test(path)));
  });
  const missingModules = selectedModules.filter((module) => !representedModules.includes(module));
  const architectureSignals = [
    detail.spec?.architecture.style,
    detail.spec?.architecture.stateManagement,
    detail.spec?.architecture.navigationStyle,
    detail.spec?.generationMode,
    detail.architectureSynthesis?.status,
    detail.hybridRefinement ? "hybrid-refinement" : undefined
  ].filter((item): item is string => Boolean(item));
  const platformPatterns = platformCorePatterns(detail.metadata.profile);
  const platformCoreFiles = filePaths.filter((path) => platformPatterns.some((pattern) => pattern.test(path))).length;
  const integrationFiles = filePaths.filter((path) => /integration|orchestrator|dependencygraph|startupsequence|contractverifier|serviceorchestrator/i.test(path)).length;
  const resourceFiles = filePaths.filter((path) => /prefabs?|resources?|assets?|ui\/|designsystem|design_system|\.unity$|\.uxml$|\.uss$/i.test(path)).length;
  const relationshipFiles = filePaths.filter((path) => {
    const lower = path.toLowerCase();
    return /relationship|manager|coordinator|orchestrator|controller|service|repository|store|cache|gateway|adapter|bridge|resolver|registry|policy|contract|protocol|interface|viewmodel|presenter|state|route|navigator|prefab|scene|config|endpoint|event|mapper|monitor|pipeline/i.test(lower);
  }).length;
  const connectedFromGraph = typeof graphConnected === "number" ? graphConnected : undefined;
  const relationshipCoveragePercent = typeof graphCoverage === "number"
    ? graphCoverage
    : Math.round((relationshipFiles / Math.max(1, filePaths.length)) * 100);

  return {
    sourceFiles: categoryBreakdown.source ?? 0,
    configFiles: categoryBreakdown.config ?? 0,
    docsFiles: categoryBreakdown.documentation ?? 0,
    metadataFiles: categoryBreakdown.metadata ?? 0,
    assetFiles: (categoryBreakdown.asset ?? 0) + (categoryBreakdown.scene ?? 0) + (categoryBreakdown.prefab ?? 0),
    testFiles: categoryBreakdown.test ?? 0,
    relationshipFiles: connectedFromGraph ?? relationshipFiles,
    relationshipEdgeCount: typeof graphSummary?.edges === "number" ? graphSummary.edges : graphEdges.length || undefined,
    connectedFileCount: connectedFromGraph,
    isolatedFileCount: typeof graphIsolated === "number" ? graphIsolated : undefined,
    relationshipDensity: typeof graphDensity === "number" ? graphDensity : undefined,
    relationshipCoveragePercent,
    integrationFiles,
    resourceFiles,
    platformCoreFiles,
    selectedModuleCount: selectedModules.length,
    representedModuleCount: representedModules.length,
    selectedModules,
    representedModules,
    missingModules,
    architectureSignals,
    categoryBreakdown,
    evidencePaths: filePaths
      .filter((path) => /product|modules|features|core|services|architecture\/file-relationships|integration|design|prefab|resources/i.test(path))
      .slice(0, 10)
  };
}

export function compareGenerationRunDetails(details: GenerationRunDetails[]): RunComparison {
  const runs: RunComparisonItem[] = details.map((detail) => ({
    id: detail.metadata.id,
    projectName: detail.metadata.projectName,
    profileId: detail.metadata.profile,
    mode: detail.metadata.generationMode ?? "baseline",
    status: detail.metadata.status,
    createdAt: detail.metadata.createdAt,
    metrics: detail.metrics,
    advisorStatus: detail.advisor?.status,
    architectureProvider: detail.metrics?.architectureProvider,
    zipAvailable: Boolean(detail.metadata.zipPath),
    analysis: analyzeRun(detail)
  }));

  const baseline = runs.find((run) => run.mode === "baseline") ?? runs[0];
  const baselineMetrics = baseline?.metrics;
  const deltas = baseline && baselineMetrics
    ? runs.filter((run) => run.id !== baseline.id && run.metrics).map((run) => ({
      runId: run.id,
      artifactDelta: (run.metrics?.artifactCount ?? 0) - baselineMetrics.artifactCount,
      fileDelta: (run.metrics?.fileCount ?? 0) - baselineMetrics.fileCount,
      warningDelta: (run.metrics?.warningCount ?? 0) - baselineMetrics.warningCount,
      generationTimeDeltaMs: (run.metrics?.generationTimeMs ?? 0) - baselineMetrics.generationTimeMs
    }))
    : [];

  return {
    baselineRunId: baseline?.id,
    runs,
    deltas
  };
}

export type {
  GeneratedArtifactSummary,
  GenerationAdvisorSummary,
  GenerationMetadata
} from "../types.js";
