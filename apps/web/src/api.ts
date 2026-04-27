import type {
  ArchitectureSpec,
  ArtifactManifest,
  GenerationMetadata,
  GenerationPlan,
  NormalizedProfile,
  QuestionnaireAnswers,
  QuestionnaireSection,
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
  plan: GenerationPlan;
  fileTree: TreeNode[];
  notes: string[];
}

export interface GenerationResponse extends PreviewResponse {
  generationId: string;
  zipPath: string;
  logFilePath?: string;
  diagnosticsPath?: string;
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(payload.error ?? "Request failed");
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

export async function createGeneration(payload: QuestionnaireAnswers): Promise<GenerationResponse> {
  return request<GenerationResponse>(apiUrl("/api/generations"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function listGenerations(): Promise<GenerationMetadata[]> {
  const response = await request<{ items: GenerationMetadata[] }>(apiUrl("/api/generations"));
  return response.items;
}
