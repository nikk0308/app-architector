import type {
  ArchitectureAdvisorReport,
  ArchitectureSpec,
  ArtifactManifest,
  GenerationMode,
  ProfileId,
  QuestionnaireAnswerSet,
  ValidationReport
} from "../types.js";

export const AI_PROVIDER_IDS = ["deterministic", "huggingface", "openai"] as const;
export type AIProviderId = typeof AI_PROVIDER_IDS[number];

export type AIProviderCapability = "advisor" | "spec-synthesis" | "hybrid-refinement";

export type AIProviderExecutionStatus =
  | "disabled"
  | "ready"
  | "unavailable"
  | "used"
  | "fallback"
  | "timeout"
  | "schema_failed"
  | "error";

export interface PromptBuildResult {
  promptVersion: string;
  provider: Exclude<AIProviderId, "deterministic">;
  mode: GenerationMode;
  systemPrompt: string;
  userPrompt: string;
  expectedSchemaName: string;
}

export interface ModelExecutionResult {
  provider: AIProviderId;
  model?: string;
  status: AIProviderExecutionStatus;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  rawText?: string;
  parsedJson?: unknown;
  repairAttempts: number;
  warnings: string[];
  error?: string;
}

export interface CostEstimate {
  provider: AIProviderId;
  estimatedUsd: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

export interface ProviderContext {
  answers: QuestionnaireAnswerSet;
  spec: ArchitectureSpec;
  manifest: ArtifactManifest;
  validation: ValidationReport;
  mode: GenerationMode;
}

export interface ProviderStructuredResult {
  advisor?: ArchitectureAdvisorReport;
  specPatch?: Partial<ArchitectureSpec>;
  manifestPatch?: Partial<ArtifactManifest>;
  execution: ModelExecutionResult;
}

export interface ProviderAdapter {
  id: AIProviderId;
  capabilities: AIProviderCapability[];
  isEnabled(): boolean;
  buildPrompt?(context: ProviderContext): PromptBuildResult;
  run(context: ProviderContext): Promise<ProviderStructuredResult>;
}

export interface AIProviderStatusSummary {
  provider: AIProviderId;
  enabled: boolean;
  status: AIProviderExecutionStatus;
  model?: string;
  capabilities: AIProviderCapability[];
  reason?: string;
}

export interface ProviderModePolicy {
  mode: GenerationMode;
  preferredProvider: AIProviderId;
  allowedProviders: AIProviderId[];
  allowFallback: boolean;
  allowFileWrites: false;
  allowedCapabilities: AIProviderCapability[];
}

export type ProfileProviderMatrix = Partial<Record<ProfileId, ProviderModePolicy[]>>;
