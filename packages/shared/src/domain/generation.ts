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
    zipAvailable: Boolean(detail.metadata.zipPath)
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
