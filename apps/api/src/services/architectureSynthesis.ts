import {
  buildArchitectureSpec,
  type ArchitectureSynthesisSummary,
  type ArchitectureSpec,
  type GenerationMode,
  type QuestionnaireAnswers
} from "@mag/shared";
import { env } from "../env.js";
import { runHuggingFaceAdvisor } from "./advisor/provider.js";
import { runOpenAIJson } from "./advisor/openaiProvider.js";

type ProviderName = "deterministic" | "huggingface" | "openai";

interface RawArchitecturePatch {
  architectureStyle?: unknown;
  stateManagement?: unknown;
  navigationStyle?: unknown;
  environmentMode?: unknown;
  features?: unknown;
  includeExampleScreen?: unknown;
  explanation?: unknown;
  assumptions?: unknown;
  risks?: unknown;
  recommendations?: unknown;
}

export interface ArchitectureSynthesisResult {
  spec: ArchitectureSpec;
  metadata: ArchitectureSynthesisSummary;
}

const stringFields = ["architectureStyle", "stateManagement", "navigationStyle"] as const;
const featureFields = ["hasAuth", "hasAnalytics", "hasLocalization", "hasPush", "hasNetworking", "hasPersistence"] as const;

function wantsAiSpec(mode?: GenerationMode): boolean {
  return mode === "commercial" || mode === "hf-open" || mode === "hybrid";
}

function selectProvider(mode: GenerationMode): ProviderName {
  if (mode === "hf-open") return "huggingface";
  if (mode === "commercial") return "openai";
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

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function extractJson(text: string): RawArchitecturePatch | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as RawArchitecturePatch;
  } catch {
    return null;
  }
}

function architecturePatchSchema(): Record<string, unknown> {
  const stringArray = {
    type: "array",
    items: { type: "string" },
    maxItems: 10
  };

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "architectureStyle",
      "stateManagement",
      "navigationStyle",
      "environmentMode",
      "features",
      "includeExampleScreen",
      "explanation",
      "assumptions",
      "risks",
      "recommendations"
    ],
    properties: {
      architectureStyle: { type: "string" },
      stateManagement: { type: "string" },
      navigationStyle: { type: "string" },
      environmentMode: { type: "string", enum: ["single", "multi"] },
      features: {
        type: "object",
        additionalProperties: false,
        required: ["auth", "analytics", "localization", "push", "networking", "persistence"],
        properties: {
          auth: { type: "boolean" },
          analytics: { type: "boolean" },
          localization: { type: "boolean" },
          push: { type: "boolean" },
          networking: { type: "boolean" },
          persistence: { type: "boolean" }
        }
      },
      includeExampleScreen: { type: "boolean" },
      explanation: { type: "string" },
      assumptions: stringArray,
      risks: stringArray,
      recommendations: stringArray
    }
  };
}

function buildPrompt(answers: QuestionnaireAnswers, baseline: ArchitectureSpec, mode: GenerationMode): string {
  return [
    "You are generating a controlled mobile ArchitectureSpec patch for a starter-project generator.",
    "Return only JSON matching the schema. Do not write files. Do not change the selected platform/profile.",
    "The deterministic generator will materialize files after your patch is normalized and validated.",
    "",
    "Allowed profile:",
    baseline.profileId,
    "",
    "Generation mode:",
    mode,
    "",
    "User answers:",
    JSON.stringify(answers, null, 2),
    "",
    "Baseline spec:",
    JSON.stringify({
      profileId: baseline.profileId,
      architecture: baseline.architecture,
      features: baseline.features,
      modules: baseline.modules.filter((module) => module.enabled).map((module) => ({
        featureId: module.featureId,
        supported: module.supported,
        required: module.required
      })),
      warnings: baseline.dependencyPlan.warnings
    }, null, 2),
    "",
    "Choose architectureStyle/stateManagement/navigationStyle/features for the starter architecture.",
    "Prefer practical, platform-appropriate defaults and do not enable unsupported or excessive modules without a clear reason."
  ].join("\n");
}

function normalizePatch(
  answers: QuestionnaireAnswers,
  baseline: ArchitectureSpec,
  patch: RawArchitecturePatch,
  warnings: string[]
): { answers: QuestionnaireAnswers; assumptions: string[]; risks: string[]; recommendations: string[]; explanation?: string } {
  const nextAnswers: QuestionnaireAnswers = { ...answers, generationMode: answers.generationMode ?? "baseline", includeLLMNotes: true };

  for (const field of stringFields) {
    const value = asString(patch[field]);
    if (value) {
      nextAnswers[field] = value;
    } else {
      warnings.push(`AI spec patch missed ${field}; deterministic baseline value was kept.`);
    }
  }

  if (patch.environmentMode === "single" || patch.environmentMode === "multi") {
    nextAnswers.environmentMode = patch.environmentMode;
  } else {
    warnings.push("AI spec patch missed environmentMode; deterministic baseline value was kept.");
  }

  const features = patch.features && typeof patch.features === "object"
    ? patch.features as Record<string, unknown>
    : {};
  const featureMap: Record<(typeof featureFields)[number], string> = {
    hasAuth: "auth",
    hasAnalytics: "analytics",
    hasLocalization: "localization",
    hasPush: "push",
    hasNetworking: "networking",
    hasPersistence: "persistence"
  };

  for (const field of featureFields) {
    const value = asBoolean(features[featureMap[field]]);
    if (typeof value === "boolean") {
      nextAnswers[field] = value;
    } else {
      warnings.push(`AI spec patch missed feature ${featureMap[field]}; deterministic baseline value was kept.`);
    }
  }

  const includeExampleScreen = asBoolean(patch.includeExampleScreen);
  if (typeof includeExampleScreen === "boolean") {
    nextAnswers.includeExampleScreen = includeExampleScreen;
  }

  nextAnswers.profile = baseline.profileId;
  nextAnswers.projectName = answers.projectName;
  nextAnswers.appDisplayName = answers.appDisplayName;
  nextAnswers.packageId = answers.packageId;

  return {
    answers: nextAnswers,
    assumptions: asStringArray(patch.assumptions),
    risks: asStringArray(patch.risks),
    recommendations: asStringArray(patch.recommendations),
    explanation: asString(patch.explanation)
  };
}

function applyExplanation(spec: ArchitectureSpec, metadata: ArchitectureSynthesisSummary, explanation?: string): ArchitectureSpec {
  const warningText = metadata.warnings.length > 0
    ? ` Warnings: ${metadata.warnings.join(" ")}`
    : "";
  const source = metadata.usedAi
    ? `AI architecture synthesis used ${metadata.provider}${metadata.model ? ` (${metadata.model})` : ""}.`
    : "Deterministic architecture synthesis was used.";

  return {
    ...spec,
    explanation: [explanation ?? spec.explanation, source, warningText].filter(Boolean).join(" ")
  };
}

export async function synthesizeArchitectureSpec(answers: QuestionnaireAnswers): Promise<ArchitectureSynthesisResult> {
  const mode = answers.generationMode ?? "baseline";
  const baseline = buildArchitectureSpec(answers);

  if (!env.LLM_ENABLED || !wantsAiSpec(mode)) {
    const metadata: ArchitectureSynthesisSummary = {
      provider: "deterministic",
      mode,
      usedAi: false,
      status: "baseline",
      warnings: env.LLM_ENABLED ? [] : ["LLM_ENABLED is false; deterministic ArchitectureSpec was used."],
      assumptions: [],
      risks: [],
      recommendations: []
    };
    return { spec: applyExplanation(baseline, metadata), metadata };
  }

  const provider = selectProvider(mode);
  if (provider === "deterministic") {
    const metadata: ArchitectureSynthesisSummary = {
      provider,
      mode,
      usedAi: false,
      status: "fallback",
      warnings: ["No AI provider token is configured; deterministic ArchitectureSpec was used."],
      assumptions: [],
      risks: [],
      recommendations: []
    };
    return { spec: applyExplanation(baseline, metadata), metadata };
  }

  const prompt = buildPrompt(answers, baseline, mode);
  const providerResult = provider === "openai"
    ? await runOpenAIJson({
      prompt,
      schema: architecturePatchSchema(),
      schemaName: "architecture_spec_patch",
      systemPrompt: "You generate controlled JSON patches for a mobile ArchitectureSpec. Return only valid JSON.",
      maxOutputTokens: Math.max(env.LLM_MAX_NEW_TOKENS, 900)
    })
    : await runHuggingFaceAdvisor(prompt);

  if (!providerResult.ok || !providerResult.text) {
    const metadata: ArchitectureSynthesisSummary = {
      provider: "deterministic",
      mode,
      usedAi: false,
      status: "fallback",
      model: providerResult.model,
      warnings: [`AI ArchitectureSpec fallback: ${providerResult.error ?? "provider returned no text"}`],
      assumptions: [],
      risks: [],
      recommendations: []
    };
    return { spec: applyExplanation(baseline, metadata), metadata };
  }

  const parsed = extractJson(providerResult.text);
  if (!parsed) {
    const metadata: ArchitectureSynthesisSummary = {
      provider: "deterministic",
      mode,
      usedAi: false,
      status: "fallback",
      model: providerResult.model,
      warnings: ["AI ArchitectureSpec fallback: provider response did not contain parseable JSON."],
      assumptions: [],
      risks: [],
      recommendations: []
    };
    return { spec: applyExplanation(baseline, metadata), metadata };
  }

  const warnings: string[] = [];
  const normalized = normalizePatch(answers, baseline, parsed, warnings);
  const spec = buildArchitectureSpec({
    ...normalized.answers,
    generationMode: mode,
    includeLLMNotes: true
  });
  const metadata: ArchitectureSynthesisSummary = {
    provider,
    mode,
    usedAi: true,
    status: warnings.length > 0 ? "repaired" : "ai-applied",
    model: providerResult.model,
    warnings,
    assumptions: normalized.assumptions,
    risks: normalized.risks,
    recommendations: normalized.recommendations
  };

  return { spec: applyExplanation(spec, metadata, normalized.explanation), metadata };
}
