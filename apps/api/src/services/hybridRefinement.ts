import {
  DEFAULT_HYBRID_REFINEMENT_POLICY,
  HYBRID_REFINEMENT_SCHEMA_VERSION,
  validateHybridRefinementPatches,
  type AdvisorProvider,
  type ArchitectureAdvisorReport,
  type ArchitectureSpec,
  type ArtifactManifest,
  type GenerationMode,
  type HybridArtifactPatch,
  type HybridRefinementReport,
  type QuestionnaireAnswers,
  type TreeNode,
  type ValidationReport
} from "@mag/shared";
import { env } from "../env.js";
import { runHuggingFaceJson } from "./advisor/provider.js";
import { runOpenAIJson } from "./advisor/openaiProvider.js";

interface ProviderTextResult {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
}

export interface HybridRefinementInput {
  answers: QuestionnaireAnswers;
  spec: ArchitectureSpec;
  manifest: ArtifactManifest;
  validation: ValidationReport;
  fileTree: TreeNode[];
  advisorReport?: ArchitectureAdvisorReport;
  mode: GenerationMode;
}

export interface HybridRefinementOptions {
  llmEnabled?: boolean;
  forcedProvider?: Exclude<AdvisorProvider, "deterministic">;
  providerResult?: ProviderTextResult;
}

interface RawHybridPatch {
  path?: unknown;
  kind?: unknown;
  operation?: unknown;
  content?: unknown;
  rationale?: unknown;
}

interface RawHybridResponse {
  patches?: unknown;
  warnings?: unknown;
}

function emptyReport(input: {
  enabled: boolean;
  mode: GenerationMode;
  provider: AdvisorProvider;
  model?: string;
  status: HybridRefinementReport["status"];
  warnings?: string[];
}): HybridRefinementReport {
  return {
    schemaVersion: HYBRID_REFINEMENT_SCHEMA_VERSION,
    enabled: input.enabled,
    mode: input.mode,
    provider: input.provider,
    model: input.model,
    status: input.status,
    acceptedPatches: [],
    rejectedPatches: [],
    warnings: input.warnings ?? []
  };
}

function selectProvider(): Exclude<AdvisorProvider, "deterministic"> | "deterministic" {
  if (env.OPENAI_API_KEY) return "openai";
  if (env.HF_TOKEN) return "huggingface";
  return "deterministic";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((item): item is string => Boolean(item)).slice(0, 10);
}

function extractJson(text: string): RawHybridResponse | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as RawHybridResponse;
  } catch {
    return null;
  }
}

function normalizeRawPatches(value: unknown): HybridArtifactPatch[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): HybridArtifactPatch | null => {
    if (!item || typeof item !== "object") return null;
    const patch = item as RawHybridPatch;
    const path = asString(patch.path);
    const content = asString(patch.content);
    if (!path || !content) return null;
    const operation = patch.operation === "replace-file" ? "replace-file" : "append-section";
    return {
      path,
      kind: "documentation",
      operation,
      content,
      rationale: asString(patch.rationale) ?? "AI proposed a safe documentation refinement."
    };
  }).filter((item): item is HybridArtifactPatch => Boolean(item));
}

function hybridPatchSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["patches", "warnings"],
    properties: {
      patches: {
        type: "array",
        maxItems: DEFAULT_HYBRID_REFINEMENT_POLICY.maxPatchCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "kind", "operation", "content", "rationale"],
          properties: {
            path: { type: "string", enum: [...DEFAULT_HYBRID_REFINEMENT_POLICY.allowedPathPrefixes] },
            kind: { type: "string", enum: ["documentation"] },
            operation: { type: "string", enum: [...DEFAULT_HYBRID_REFINEMENT_POLICY.allowedOperations] },
            content: { type: "string" },
            rationale: { type: "string" }
          }
        }
      },
      warnings: {
        type: "array",
        maxItems: 10,
        items: { type: "string" }
      }
    }
  };
}

function buildPrompt(input: HybridRefinementInput): string {
  return [
    "You are refining a generated mobile starter package in hybrid mode.",
    "Return only JSON matching the schema. Do not write files directly.",
    "You may only propose Markdown documentation patches for allowlisted paths.",
    "Do not include secrets, tokens, credentials or environment values.",
    "Do not change profile, platform, required file tree, .mag metadata, manifest or source code.",
    "",
    "Allowed paths:",
    JSON.stringify(DEFAULT_HYBRID_REFINEMENT_POLICY.allowedPathPrefixes, null, 2),
    "",
    "Project:",
    JSON.stringify({
      profileId: input.spec.profileId,
      mode: input.mode,
      appDisplayName: input.spec.appDisplayName,
      architecture: input.spec.architecture,
      features: input.spec.features,
      manifestSummary: input.manifest.summary,
      artifacts: input.manifest.artifacts.map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        required: artifact.required,
        category: artifact.category,
        source: artifact.source
      })),
      advisorSummary: input.advisorReport?.summary,
      advisorRisks: input.advisorReport?.risks,
      advisorNextSteps: input.advisorReport?.nextSteps
    }, null, 2),
    "",
    "Prefer 2-3 useful patches. Good targets: README.md, docs/next-steps.md, docs/testing-strategy.md, docs/deployment-notes.md.",
    "Use append-section for existing files and replace-file for new docs files."
  ].join("\n");
}

export async function buildHybridRefinementReport(
  input: HybridRefinementInput,
  options: HybridRefinementOptions = {}
): Promise<HybridRefinementReport> {
  if (input.mode !== "hybrid") {
    return emptyReport({ enabled: false, mode: input.mode, provider: "deterministic", status: "disabled" });
  }

  const llmEnabled = options.llmEnabled ?? env.LLM_ENABLED;
  if (!llmEnabled) {
    return emptyReport({
      enabled: false,
      mode: input.mode,
      provider: "deterministic",
      status: "disabled",
      warnings: ["LLM_ENABLED is false; hybrid refinement was skipped."]
    });
  }

  const provider = options.forcedProvider ?? selectProvider();
  if (provider === "deterministic") {
    return emptyReport({
      enabled: true,
      mode: input.mode,
      provider,
      status: "fallback",
      warnings: ["No AI provider token is configured; hybrid refinement was skipped."]
    });
  }

  const prompt = buildPrompt(input);
  const providerResult = options.providerResult ?? (provider === "openai"
    ? await runOpenAIJson({
      prompt,
      schema: hybridPatchSchema(),
      schemaName: "hybrid_refinement_patches",
      systemPrompt: "You return safe allowlisted documentation patches for a generated mobile starter package.",
      maxOutputTokens: Math.max(env.LLM_MAX_NEW_TOKENS, 900)
    })
    : await runHuggingFaceJson({
      prompt,
      schema: hybridPatchSchema(),
      schemaName: "hybrid_refinement_patches",
      systemPrompt: "You return safe allowlisted documentation patches for a generated mobile starter package.",
      maxOutputTokens: Math.max(env.LLM_MAX_NEW_TOKENS, 900)
    }));

  if (!providerResult.ok || !providerResult.text) {
    return emptyReport({
      enabled: true,
      mode: input.mode,
      provider: "deterministic",
      model: providerResult.model,
      status: "fallback",
      warnings: [`Hybrid refinement fallback: ${providerResult.error ?? "provider returned no text"}`]
    });
  }

  const parsed = extractJson(providerResult.text);
  if (!parsed) {
    return emptyReport({
      enabled: true,
      mode: input.mode,
      provider: "deterministic",
      model: providerResult.model,
      status: "fallback",
      warnings: ["Hybrid refinement fallback: provider response did not contain parseable JSON."]
    });
  }

  const rawPatches = normalizeRawPatches(parsed.patches);
  const validation = validateHybridRefinementPatches({
    manifest: input.manifest,
    fileTree: input.fileTree,
    patches: rawPatches
  });

  const status: HybridRefinementReport["status"] = validation.accepted.length > 0
    ? validation.rejected.length > 0 ? "partial" : "applied"
    : validation.rejected.length > 0 ? "rejected" : "fallback";

  return {
    schemaVersion: HYBRID_REFINEMENT_SCHEMA_VERSION,
    enabled: true,
    mode: input.mode,
    provider,
    model: providerResult.model,
    status,
    acceptedPatches: validation.accepted,
    rejectedPatches: validation.rejected,
    warnings: [
      ...asStringArray(parsed.warnings),
      ...(validation.accepted.length === 0 ? ["No hybrid refinement patches were accepted by policy."] : [])
    ]
  };
}
