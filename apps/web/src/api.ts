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

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

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
  const response = await request<{ sections: QuestionnaireSection[] }>(`${API_BASE}/api/questionnaire`);
  return response.sections;
}

export async function previewProfile(payload: QuestionnaireAnswers): Promise<PreviewResponse> {
  return request<PreviewResponse>(`${API_BASE}/api/profile/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function createGeneration(payload: QuestionnaireAnswers): Promise<GenerationResponse> {
  return request<GenerationResponse>(`${API_BASE}/api/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function listGenerations(): Promise<GenerationMetadata[]> {
  const response = await request<{ items: GenerationMetadata[] }>(`${API_BASE}/api/generations`);
  return response.items;
}
