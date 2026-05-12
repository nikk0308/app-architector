import type {
  ArchitectureSpec,
  ArtifactManifest,
  ArchitectureAdvisorReport,
  ArchitectureAdvisorStatus,
  ArchitectureSynthesisSummary,
  GeneratedArtifactSummary,
  GenerationAdvisorSummary,
  GenerationMetadata,
  GenerationPlan,
  GenerationRunDetails,
  FileRelationshipGraph,
  HybridRefinementReport,
  NormalizedProfile,
  QuestionnaireAnswers,
  QuestionnaireSection,
  RunArtifactRecord,
  RunComparison,
  RunMetrics,
  RuntimeHealthReport,
  ValidationV2Report,
  AIProviderStatusSummary,
  ValidationReport,
  TreeNode
} from "@mag/shared";

function normalizeApiBase(rawBase: unknown): string {
  if (typeof rawBase !== "string") {
    return "";
  }
  const trimmed = rawBase.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }
  return trimmed.replace(/\/+$/, "");
}

export const API_BASE = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_BASE
);

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export interface PreviewResponse {
  profile: NormalizedProfile;
  spec: ArchitectureSpec;
  manifest: ArtifactManifest;
  validation: {
    spec: ValidationReport;
    manifest: ValidationReport;
  };
  validationV2?: {
    preMaterialization?: ValidationV2Report;
    postMaterialization?: ValidationV2Report;
  };
  plan: GenerationPlan;
  fileTree: TreeNode[];
  artifacts?: GeneratedArtifactSummary[];
  notes: string[];
  advisorStatus?: ArchitectureAdvisorStatus;
  architectureSynthesis?: ArchitectureSynthesisSummary;
  advisorSummary?: GenerationAdvisorSummary;
  advisor?: ArchitectureAdvisorReport;
  hybridRefinement?: HybridRefinementReport;
  relationshipGraph?: FileRelationshipGraph;
}

export interface ArchitecturePreviewResponse extends PreviewResponse {
  previewId: string;
  createdAt: string;
}

export interface AdvisorPlanResponse {
  advisor: ArchitectureAdvisorReport;
  validation: ValidationReport;
  preview?: PreviewResponse;
}

export interface GenerationResponse extends PreviewResponse {
  generationId: string;
  zipPath: string;
  logFilePath?: string;
  diagnosticsPath?: string;
  artifacts?: GeneratedArtifactSummary[];
  advisorSummary?: GenerationAdvisorSummary;
  advisor?: ArchitectureAdvisorReport;
  hybridRefinement?: HybridRefinementReport;
  runArtifacts?: RunArtifactRecord[];
  runMetrics?: RunMetrics;
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let payload: Record<string, unknown> = {};
    try {
      payload = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    } catch {
      payload = {};
    }

    const providerError = payload.providerError;
    const providerMessage = providerError && typeof providerError === "object"
      ? (providerError as Record<string, unknown>).message
      : undefined;
    const message = payload.error ?? payload.message ?? payload.detail ?? payload.reason ?? providerMessage;
    if (typeof message === "string" && message.trim()) {
      throw new Error(message.trim());
    }

    const lower = raw.toLowerCase();
    if ((response.status === 502 || response.status === 504) && (lower.includes("bad gateway") || lower.includes("gateway timeout") || lower.includes("<html"))) {
      throw new Error("The API gateway timed out while waiting for the generation request. If this was Qwen, Hugging Face may still be busy or unavailable.");
    }

    throw new Error(`Request failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchQuestionnaire(): Promise<QuestionnaireSection[]> {
  const response = await request<{ sections: QuestionnaireSection[] }>(apiUrl("/api/questionnaire"));
  return response.sections;
}

export async function previewProfile(payload: QuestionnaireAnswers): Promise<PreviewResponse> {
  return request<PreviewResponse>(apiUrl("/api/profile/preview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function createArchitecturePreview(payload: QuestionnaireAnswers): Promise<ArchitecturePreviewResponse> {
  return request<ArchitecturePreviewResponse>(apiUrl("/api/architecture/preview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function createGeneration(payload: QuestionnaireAnswers): Promise<GenerationResponse> {
  return request<GenerationResponse>(apiUrl("/api/generations"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function createGenerationFromPreview(previewId: string): Promise<GenerationResponse> {
  return request<GenerationResponse>(apiUrl("/api/generations/from-preview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ previewId })
  });
}

export async function listGenerations(): Promise<GenerationMetadata[]> {
  const response = await request<{ items: GenerationMetadata[] }>(apiUrl("/api/generations"));
  return response.items;
}

export async function fetchGenerationDetails(id: string): Promise<GenerationRunDetails> {
  return request<GenerationRunDetails>(apiUrl(`/api/generations/${id}/details`));
}

export async function compareGenerations(ids: string[]): Promise<RunComparison> {
  const query = encodeURIComponent(ids.join(","));
  return request<RunComparison>(apiUrl(`/api/generations/compare?ids=${query}`));
}

export async function deleteGeneration(id: string): Promise<{ deleted: boolean; id: string; removedPaths?: string[] }> {
  return request<{ deleted: boolean; id: string; removedPaths?: string[] }>(apiUrl(`/api/generations/${id}`), {
    method: "DELETE"
  });
}

export async function clearGenerations(): Promise<{ deleted: number; removedPaths?: string[] }> {
  return request<{ deleted: number; removedPaths?: string[] }>(apiUrl("/api/generations"), {
    method: "DELETE"
  });
}

export async function fetchAdvisorStatus(): Promise<ArchitectureAdvisorStatus> {
  return request<ArchitectureAdvisorStatus>(apiUrl("/api/advisor/status"));
}

export async function fetchProviderStatuses(): Promise<AIProviderStatusSummary[]> {
  const response = await request<{ items: AIProviderStatusSummary[] }>(apiUrl("/api/providers/status"));
  return response.items;
}

export async function fetchRuntimeHealth(): Promise<RuntimeHealthReport> {
  const response = await request<{ runtime?: RuntimeHealthReport } & RuntimeHealthReport>(apiUrl("/api/health"));
  return response.runtime ?? response;
}

export async function createAdvisorPlan(payload: QuestionnaireAnswers): Promise<AdvisorPlanResponse> {
  return request<AdvisorPlanResponse>(apiUrl("/api/advisor/plan"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
