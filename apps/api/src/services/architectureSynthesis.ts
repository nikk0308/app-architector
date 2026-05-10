import {
  buildArchitectureSpec,
  type ArchitectureSynthesisSummary,
  type ArchitectureSpec,
  type GenerationMode,
  type QuestionnaireAnswers
} from "@mag/shared";
import { env } from "../env.js";
import { runHuggingFaceJson } from "./advisor/provider.js";
import { runOpenAIJson } from "./advisor/openaiProvider.js";

type ProviderName = "deterministic" | "huggingface" | "openai";

interface RawArchitecturePatch {
  architectureStyle?: unknown;
  stateManagement?: unknown;
  navigationStyle?: unknown;
  environmentMode?: unknown;
  architecture?: unknown;
  features?: unknown;
  includeExampleScreen?: unknown;
  explanation?: unknown;
  assumptions?: unknown;
  risks?: unknown;
  recommendations?: unknown;
  product?: unknown;
}

interface ProviderTextResult {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
}

export interface ArchitectureSynthesisOptions {
  llmEnabled?: boolean;
  forcedProvider?: Exclude<ProviderName, "deterministic">;
  providerResult?: ProviderTextResult;
}

export interface ArchitectureSynthesisResult {
  spec: ArchitectureSpec;
  metadata: ArchitectureSynthesisSummary;
}


const PROFILE_ALLOWED_OPTIONS: Record<QuestionnaireAnswers["profile"], {
  architectureStyle: string[];
  stateManagement: string[];
  navigationStyle: string[];
  distributionStores: string[];
}> = {
  ios: {
    architectureStyle: ["feature-first", "mvvm", "coordinator", "layered"],
    stateManagement: ["native"],
    navigationStyle: ["coordinator", "stack"],
    distributionStores: ["apple-app-store"]
  },
  flutter: {
    architectureStyle: ["feature-first", "mvvm", "layered"],
    stateManagement: ["riverpod", "native"],
    navigationStyle: ["router", "stack"],
    distributionStores: ["apple-app-store", "google-play", "samsung-galaxy-store", "amazon-appstore"]
  },
  "react-native": {
    architectureStyle: ["feature-first", "layered", "mvvm"],
    stateManagement: ["zustand", "redux-toolkit", "native"],
    navigationStyle: ["stack", "router"],
    distributionStores: ["apple-app-store", "google-play", "samsung-galaxy-store", "amazon-appstore"]
  },
  unity: {
    architectureStyle: ["feature-first", "coordinator", "layered"],
    stateManagement: ["scriptable-object", "native"],
    navigationStyle: ["scene-flow"],
    distributionStores: ["apple-app-store", "google-play", "samsung-galaxy-store", "amazon-appstore"]
  }
};

const PRODUCT_ALLOWED_OPTIONS = {
  monetization: ["ads", "paid-app", "subscription", "in-app-purchases"],
  offlineData: ["offline-cache", "sync-queue", "data-migrations", "secure-storage"],
  runtimeQuality: ["logging", "crash-reporting", "feature-flags", "settings-screen", "diagnostics-screen"],
  delivery: ["ci-cd", "release-checklist", "design-system", "test-plan", "env-secrets"]
} as const;

function unique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}

function withPreferredItems<T extends string>(current: readonly T[] | undefined, preferred: readonly T[], max = 4): T[] {
  return unique([...(current ?? []), ...preferred]).slice(0, max);
}

function modeInstruction(mode: GenerationMode, baseline: ArchitectureSpec): string {
  const platformHints = PROFILE_ALLOWED_OPTIONS[baseline.profileId];
  const allowed = {
    architectureStyle: platformHints.architectureStyle,
    stateManagement: platformHints.stateManagement,
    navigationStyle: platformHints.navigationStyle,
    distributionStores: platformHints.distributionStores,
    ...PRODUCT_ALLOWED_OPTIONS
  };

  if (mode === "commercial") {
    return [
      "Commercial / GPT mode must produce a production-oriented commercial architecture, not the same selection as the open-model mode.",
      "Bias the spec toward release readiness, app-store delivery, telemetry, monetization boundaries, operational diagnostics and environment separation.",
      "Prefer environmentMode=multi, analytics=true, networking=true, persistence=true, localization=true, and push=true when platform-appropriate.",
      "Prefer monetization values subscription and in-app-purchases; runtimeQuality values logging, crash-reporting, feature-flags, diagnostics-screen; delivery values ci-cd, release-checklist, env-secrets, test-plan.",
      `Allowed normalized option values: ${JSON.stringify(allowed)}.`
    ].join(" ");
  }

  if (mode === "hf-open") {
    return [
      "HF-open / Qwen mode must produce an open-model engineering architecture, not the same selection as the commercial GPT mode.",
      "Bias the spec toward code structure, domain boundaries, local-first data, integration seams, documentation, testing and maintainable generated source.",
      "Prefer networking=true, persistence=true, localization=true, analytics=true, and push=false unless the user explicitly requested push.",
      "Prefer offlineData values offline-cache, sync-queue, data-migrations, secure-storage; runtimeQuality values logging, settings-screen, diagnostics-screen; delivery values design-system, test-plan, ci-cd.",
      "Avoid adding monetization values unless they are already requested by the user or clearly needed by the domain.",
      `Allowed normalized option values: ${JSON.stringify(allowed)}.`
    ].join(" ");
  }

  return `Use the selected generation mode ${mode} while keeping profile-safe option values: ${JSON.stringify(allowed)}.`;
}

const stringFields = ["architectureStyle", "stateManagement", "navigationStyle"] as const;
const featureFields = ["hasAuth", "hasAnalytics", "hasLocalization", "hasPush", "hasNetworking", "hasPersistence"] as const;

function wantsAiSpec(mode?: GenerationMode): boolean {
  return mode === "commercial" || mode === "hf-open";
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

function objectField(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

function architecturePatchSchema(baseline: ArchitectureSpec): Record<string, unknown> {
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
      "recommendations",
      "product"
    ],
    properties: {
      architectureStyle: { type: "string", enum: PROFILE_ALLOWED_OPTIONS[baseline.profileId].architectureStyle },
      stateManagement: { type: "string", enum: PROFILE_ALLOWED_OPTIONS[baseline.profileId].stateManagement },
      navigationStyle: { type: "string", enum: PROFILE_ALLOWED_OPTIONS[baseline.profileId].navigationStyle },
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
      recommendations: stringArray,
      product: {
        type: "object",
        additionalProperties: false,
        required: ["distributionStores", "monetization", "offlineData", "runtimeQuality", "delivery"],
        properties: {
          distributionStores: { ...stringArray, items: { type: "string", enum: PROFILE_ALLOWED_OPTIONS[baseline.profileId].distributionStores } },
          monetization: { ...stringArray, items: { type: "string", enum: [...PRODUCT_ALLOWED_OPTIONS.monetization] } },
          offlineData: { ...stringArray, items: { type: "string", enum: [...PRODUCT_ALLOWED_OPTIONS.offlineData] } },
          runtimeQuality: { ...stringArray, items: { type: "string", enum: [...PRODUCT_ALLOWED_OPTIONS.runtimeQuality] } },
          delivery: { ...stringArray, items: { type: "string", enum: [...PRODUCT_ALLOWED_OPTIONS.delivery] } }
        }
      }
    }
  };
}

function buildPrompt(answers: QuestionnaireAnswers, baseline: ArchitectureSpec, mode: GenerationMode): string {
  const userInstruction = typeof answers.aiInstruction === "string" && answers.aiInstruction.trim()
    ? answers.aiInstruction.trim().slice(0, 2000)
    : "";

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
    "Mode-specific objective:",
    modeInstruction(mode, baseline),
    "",
    "User answers:",
    JSON.stringify(answers, null, 2),
    "",
    "Additional user instruction:",
    userInstruction || "No additional instruction was provided.",
    "",
    "Baseline spec:",
    JSON.stringify({
      profileId: baseline.profileId,
      architecture: baseline.architecture,
      features: baseline.features,
      product: baseline.product,
      modules: baseline.modules.filter((module) => module.enabled).map((module) => ({
        featureId: module.featureId,
        supported: module.supported,
        required: module.required
      })),
      warnings: baseline.dependencyPlan.warnings
    }, null, 2),
    "",
    "Choose architectureStyle/stateManagement/navigationStyle/features/product arrays so this mode creates a visibly different generated package while staying platform-safe.",
    "Do not simply echo the baseline values. Respect explicit user context, but make the mode-specific architecture tradeoff visible in files, modules, metrics and advisor notes.",
    "",
    "Required JSON shape:",
    JSON.stringify({
      architectureStyle: baseline.architecture.style,
      stateManagement: baseline.architecture.stateManagement,
      navigationStyle: baseline.architecture.navigationStyle,
      environmentMode: answers.environmentMode ?? "single",
      features: {
        auth: Boolean(answers.hasAuth),
        analytics: Boolean(answers.hasAnalytics),
        localization: Boolean(answers.hasLocalization),
        push: Boolean(answers.hasPush),
        networking: Boolean(answers.hasNetworking),
        persistence: Boolean(answers.hasPersistence)
      },
      includeExampleScreen: Boolean(answers.includeExampleScreen),
      explanation: "One concise explanation of the selected architecture.",
      assumptions: ["Concrete assumption about product or delivery context."],
      risks: ["Concrete implementation risk."],
      recommendations: ["Concrete next engineering recommendation."],
      product: {
        distributionStores: answers.distributionStores ?? [],
        monetization: answers.monetization ?? [],
        offlineData: answers.offlineData ?? [],
        runtimeQuality: answers.runtimeQuality ?? [],
        delivery: answers.delivery ?? []
      }
    }, null, 2)
  ].join("\n");
}

function normalizePatch(
  answers: QuestionnaireAnswers,
  baseline: ArchitectureSpec,
  patch: RawArchitecturePatch,
  warnings: string[]
): { answers: QuestionnaireAnswers; assumptions: string[]; risks: string[]; recommendations: string[]; explanation?: string } {
  const nextAnswers: QuestionnaireAnswers = { ...answers, generationMode: answers.generationMode ?? "baseline", includeLLMNotes: true };
  const architecture = objectField(patch.architecture);
  const fieldAliases: Record<(typeof stringFields)[number], unknown[]> = {
    architectureStyle: [patch.architectureStyle, architecture.style, architecture.architectureStyle],
    stateManagement: [patch.stateManagement, architecture.stateManagement, architecture.state],
    navigationStyle: [patch.navigationStyle, architecture.navigationStyle, architecture.navigation]
  };

  for (const field of stringFields) {
    const value = fieldAliases[field].map(asString).find(Boolean);
    if (value) {
      nextAnswers[field] = value;
    } else {
      warnings.push(`AI spec patch missed ${field}; deterministic baseline value was kept.`);
    }
  }

  const environmentMode = patch.environmentMode ?? architecture.environmentMode;
  if (environmentMode === "single" || environmentMode === "multi") {
    nextAnswers.environmentMode = environmentMode;
  } else {
    warnings.push("AI spec patch missed environmentMode; deterministic baseline value was kept.");
  }

  const features = objectField(patch.features);
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

  const product = objectField(patch.product);
  const distributionStores = asStringArray(product.distributionStores);
  const monetization = asStringArray(product.monetization);
  const offlineData = asStringArray(product.offlineData);
  const runtimeQuality = asStringArray(product.runtimeQuality);
  const delivery = asStringArray(product.delivery);
  if (distributionStores.length > 0) nextAnswers.distributionStores = distributionStores as QuestionnaireAnswers["distributionStores"];
  if (monetization.length > 0) nextAnswers.monetization = monetization as QuestionnaireAnswers["monetization"];
  if (offlineData.length > 0) nextAnswers.offlineData = offlineData as QuestionnaireAnswers["offlineData"];
  if (runtimeQuality.length > 0) nextAnswers.runtimeQuality = runtimeQuality as QuestionnaireAnswers["runtimeQuality"];
  if (delivery.length > 0) nextAnswers.delivery = delivery as QuestionnaireAnswers["delivery"];

  nextAnswers.profile = baseline.profileId;
  nextAnswers.projectName = answers.projectName;
  nextAnswers.appDisplayName = answers.appDisplayName;
  nextAnswers.packageId = answers.packageId;
  nextAnswers.aiInstruction = answers.aiInstruction;

  return {
    answers: nextAnswers,
    assumptions: asStringArray(patch.assumptions),
    risks: asStringArray(patch.risks),
    recommendations: asStringArray(patch.recommendations),
    explanation: asString(patch.explanation)
  };
}

function applyModeSignature(
  answers: QuestionnaireAnswers,
  mode: GenerationMode
): QuestionnaireAnswers {
  const next: QuestionnaireAnswers = { ...answers };

  if (mode === "commercial") {
    next.environmentMode = "multi";
    next.hasAnalytics = true;
    next.hasNetworking = true;
    next.hasPersistence = true;
    next.hasLocalization = true;
    next.hasPush = true;
    next.includeExampleScreen = true;
    next.distributionStores = withPreferredItems(next.distributionStores, ["apple-app-store"], 2) as QuestionnaireAnswers["distributionStores"];
    next.monetization = withPreferredItems(next.monetization, ["subscription", "in-app-purchases"], 3) as QuestionnaireAnswers["monetization"];
    next.offlineData = withPreferredItems(next.offlineData, ["secure-storage", "sync-queue"], 3) as QuestionnaireAnswers["offlineData"];
    next.runtimeQuality = withPreferredItems(next.runtimeQuality, ["logging", "crash-reporting", "feature-flags", "diagnostics-screen"], 4) as QuestionnaireAnswers["runtimeQuality"];
    next.delivery = withPreferredItems(next.delivery, ["ci-cd", "release-checklist", "env-secrets", "test-plan"], 4) as QuestionnaireAnswers["delivery"];
  }

  if (mode === "hf-open") {
    next.hasAnalytics = true;
    next.hasNetworking = true;
    next.hasPersistence = true;
    next.hasLocalization = true;
    next.hasPush = Boolean(answers.hasPush);
    next.includeExampleScreen = true;
    next.monetization = unique(next.monetization ?? []).filter((item) => item !== "subscription" && item !== "in-app-purchases") as QuestionnaireAnswers["monetization"];
    next.offlineData = withPreferredItems(next.offlineData, ["offline-cache", "sync-queue", "data-migrations", "secure-storage"], 4) as QuestionnaireAnswers["offlineData"];
    next.runtimeQuality = withPreferredItems(next.runtimeQuality, ["logging", "settings-screen", "diagnostics-screen"], 4) as QuestionnaireAnswers["runtimeQuality"];
    next.delivery = withPreferredItems(next.delivery, ["design-system", "test-plan", "ci-cd"], 4) as QuestionnaireAnswers["delivery"];
  }

  return next;
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

export async function synthesizeArchitectureSpec(
  answers: QuestionnaireAnswers,
  options: ArchitectureSynthesisOptions = {}
): Promise<ArchitectureSynthesisResult> {
  const mode = answers.generationMode ?? "baseline";
  const baseline = buildArchitectureSpec(answers);
  const llmEnabled = options.llmEnabled ?? env.LLM_ENABLED;

  if (!llmEnabled || !wantsAiSpec(mode)) {
    const metadata: ArchitectureSynthesisSummary = {
      provider: "deterministic",
      mode,
      usedAi: false,
      status: "baseline",
      warnings: llmEnabled ? [] : ["LLM_ENABLED is false; deterministic ArchitectureSpec was used."],
      assumptions: [],
      risks: [],
      recommendations: []
    };
    return { spec: applyExplanation(baseline, metadata), metadata };
  }

  const provider = options.forcedProvider ?? selectProvider(mode);
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
  const providerResult = options.providerResult ?? (provider === "openai"
    ? await runOpenAIJson({
      prompt,
      schema: architecturePatchSchema(baseline),
      schemaName: "architecture_spec_patch",
      systemPrompt: "You generate controlled JSON patches for a mobile ArchitectureSpec. Return only valid JSON.",
      maxOutputTokens: Math.max(env.LLM_MAX_NEW_TOKENS, 900)
    })
    : await runHuggingFaceJson({
      prompt,
      schema: architecturePatchSchema(baseline),
      schemaName: "architecture_spec_patch",
      systemPrompt: "You generate controlled JSON patches for a mobile ArchitectureSpec. Return only valid JSON matching the requested schema.",
      maxOutputTokens: Math.max(env.LLM_MAX_NEW_TOKENS, 900)
    }));

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
  const modeShapedAnswers = applyModeSignature(normalized.answers, mode);
  const spec = buildArchitectureSpec({
    ...modeShapedAnswers,
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
