import type {
  ArchitectureAdvisorReport,
  ArchitectureSpec,
  ArtifactManifest,
  GeneratedArtifactSummary,
  GenerationAdvisorSummary,
  GenerationMetadata,
  GenerationMode,
  ProfileId,
  QuestionnaireAnswerSet,
  ValidationReport
} from "../types.js";
import type {
  CostEstimate,
  ModelExecutionResult,
  PromptBuildResult
} from "./provider.js";

export type GenerationRunStatus = "success" | "partial" | "failed";

export interface RunMetrics {
  generationTimeMs: number;
  artifactCount: number;
  warningCount: number;
  validationStatus: ValidationReport["status"];
  advisorUsed: boolean;
  providerUsed: boolean;
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

export type {
  GeneratedArtifactSummary,
  GenerationAdvisorSummary,
  GenerationMetadata
} from "../types.js";
