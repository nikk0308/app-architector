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
  aiBlueprint?: unknown;
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

function normalizeSlug(value: string, fallback: string): string {
  return (value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function safeRelativePath(value: string, fallbackName: string, extension: string): string | null {
  const cleaned = value
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.{2,}/g, "")
    .split("/")
    .map((part) => part.trim().replace(/[<>:"|?*]/g, ""))
    .filter(Boolean)
    .join("/");
  if (!cleaned || cleaned.includes("../") || cleaned.startsWith(".")) {
    return null;
  }
  if (/\.[a-z0-9]+$/i.test(cleaned)) {
    return cleaned;
  }
  return `${cleaned}/${fallbackName}.${extension}`;
}

function defaultBlueprintExtension(profile: QuestionnaireAnswers["profile"]): string {
  if (profile === "ios") return "swift";
  if (profile === "flutter") return "dart";
  if (profile === "react-native") return "ts";
  return "cs";
}

function normalizeBlueprint(
  patch: RawArchitecturePatch,
  baseline: ArchitectureSpec,
  mode: GenerationMode,
  provider: ProviderName,
  model: string | undefined,
  warnings: string[]
): ArchitectureSpec["aiBlueprint"] {
  const raw = objectField(patch.aiBlueprint);
  const rawModules = Array.isArray(raw.modules) ? raw.modules : [];
  const extension = defaultBlueprintExtension(baseline.profileId);
  const modules: NonNullable<ArchitectureSpec["aiBlueprint"]>["modules"] = [];
  const knownPaths = new Set<string>();
  const moduleLimit = mode === "commercial" ? 24 : mode === "hf-open" ? 22 : 20;
  const fileLimit = mode === "commercial" ? 20 : mode === "hf-open" ? 18 : 16;

  rawModules.slice(0, moduleLimit).forEach((rawModule, moduleIndex) => {
    const moduleObject = objectField(rawModule);
    const name = asString(moduleObject.name) ?? `AIModule${moduleIndex + 1}`;
    const moduleSlug = normalizeSlug(name, `ai-module-${moduleIndex + 1}`);
    const rawFiles = Array.isArray(moduleObject.files) ? moduleObject.files : [];
    const files: NonNullable<ArchitectureSpec["aiBlueprint"]>["modules"][number]["files"] = [];

    rawFiles.slice(0, fileLimit).forEach((rawFile, fileIndex) => {
      const fileObject = objectField(rawFile);
      const fallbackName = `${moduleSlug.replace(/(^|-)([a-z])/g, (_, _dash, letter) => letter.toUpperCase()) || "AIBoundary"}${fileIndex + 1}`;
      const path = safeRelativePath(asString(fileObject.path) ?? "", fallbackName, extension)
        ?? `AI/${moduleSlug}/${fallbackName}.${extension}`;
      if (knownPaths.has(path)) {
        return;
      }
      knownPaths.add(path);
      const kindCandidate = asString(fileObject.kind) ?? "source";
      const kind = ["source", "config", "resource", "documentation", "test"].includes(kindCandidate) ? kindCandidate as "source" | "config" | "resource" | "documentation" | "test" : "source";
      files.push({
        path,
        kind,
        role: asString(fileObject.role) ?? "source boundary",
        description: asString(fileObject.description) ?? `${path.split("/").pop()} is an AI-proposed ${name} file.`,
        module: normalizeSlug(asString(fileObject.module) ?? name, moduleSlug)
      });
    });

    if (files.length > 0) {
      modules.push({
        name,
        purpose: asString(moduleObject.purpose) ?? `AI-proposed ${name} module for ${mode} generation.`,
        emphasis: asString(moduleObject.emphasis) ?? (mode === "commercial" ? "production readiness" : "code structure"),
        files
      });
    }
  });

  if (modules.length === 0) {
    warnings.push("AI response did not include usable aiBlueprint modules; provider-specific blueprint files were not added.");
    return undefined;
  }

  const validPaths = new Set(modules.flatMap((module) => module.files.map((file) => file.path)));
  const rawRelationships = Array.isArray(raw.relationships) ? raw.relationships : [];
  const relationships: NonNullable<ArchitectureSpec["aiBlueprint"]>["relationships"] = [];
  const relationKeys = new Set<string>();
  for (const rawRelationship of rawRelationships.slice(0, 360)) {
    const relationObject = objectField(rawRelationship);
    const from = asString(relationObject.from);
    const to = asString(relationObject.to);
    if (!from || !to || from === to || !validPaths.has(from) || !validPaths.has(to)) {
      continue;
    }
    const relation = normalizeSlug(asString(relationObject.relation) ?? "uses", "uses");
    const key = `${from}|${to}|${relation}`;
    if (relationKeys.has(key)) {
      continue;
    }
    relationKeys.add(key);
    relationships.push({
      from,
      to,
      relation,
      reason: asString(relationObject.reason) ?? `${from.split("/").pop()} ${relation} ${to.split("/").pop()}.`
    });
  }

  const flatFiles = modules.flatMap((module) => module.files);
  for (let index = 1; relationships.length < Math.min(260, Math.max(48, Math.ceil(flatFiles.length * 2.25))) && index < flatFiles.length; index += 1) {
    const source = flatFiles[index - 1];
    const target = flatFiles[index];
    const relation = index % 5 === 0 ? "documents" : index % 4 === 0 ? "tests" : index % 3 === 0 ? "configures" : "uses";
    const key = `${source.path}|${target.path}|${relation}`;
    if (!relationKeys.has(key)) {
      relationKeys.add(key);
      relationships.push({
        from: source.path,
        to: target.path,
        relation,
        reason: `${source.path.split("/").pop()} ${relation} ${target.path.split("/").pop()} inside the AI blueprint.`
      });
    }
  }

  return {
    provider,
    mode,
    model,
    strategy: asString(raw.strategy) ?? (mode === "commercial" ? "Production-grade commercial expansion around the locked architecture." : "Open-model maintainability expansion around the locked architecture."),
    modules,
    relationships
  };
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
    maxItems: 20
  };
  const blueprintFile = {
    type: "object",
    additionalProperties: false,
    required: ["path", "kind", "role", "description", "module"],
    properties: {
      path: { type: "string" },
      kind: { type: "string", enum: ["source", "config", "resource", "documentation", "test"] },
      role: { type: "string" },
      description: { type: "string" },
      module: { type: "string" }
    }
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
      "product",
      "aiBlueprint"
    ],
    properties: {
      // Core user-selected architecture knobs are accepted for backward compatibility,
      // but the normalizer preserves the user's chosen architecture/state/navigation.
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
      },
      aiBlueprint: {
        type: "object",
        additionalProperties: false,
        required: ["strategy", "modules", "relationships"],
        properties: {
          strategy: { type: "string" },
          modules: {
            type: "array",
            minItems: 6,
            maxItems: 24,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "purpose", "emphasis", "files"],
              properties: {
                name: { type: "string" },
                purpose: { type: "string" },
                emphasis: { type: "string" },
                files: { type: "array", minItems: 3, maxItems: 20, items: blueprintFile }
              }
            }
          },
          relationships: {
            type: "array",
            maxItems: 260,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["from", "to", "relation", "reason"],
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                relation: { type: "string" },
                reason: { type: "string" }
              }
            }
          }
        }
      }
    }
  };
}

function buildPrompt(answers: QuestionnaireAnswers, baseline: ArchitectureSpec, mode: GenerationMode): string {
  const userInstruction = typeof answers.aiInstruction === "string" && answers.aiInstruction.trim()
    ? answers.aiInstruction.trim().slice(0, 4000)
    : "";
  const projectPascal = baseline.naming.projectPascal;
  const root = baseline.naming.rootDirectoryName;
  const platform = baseline.profileId;
  const extByProfile: Record<string, string> = { ios: "swift", flutter: "dart", "react-native": "ts", unity: "cs" };
  const ext = extByProfile[platform] ?? "ts";

  const modeGoal = mode === "commercial"
    ? [
      "GPT mode should act like a senior product/platform architect for a commercial app.",
      "Keep the user's selected platform, architecture style, state management and navigation untouched, but propose a richer implementation blueprint around release readiness, monetization, store compliance, telemetry, operations, risk controls, environment separation and business-critical flows.",
      "It may add many files/modules when they are justified. Prefer pragmatic production boundaries and explicit diagnostics. Do not copy the Qwen/open-model shape."
    ].join(" ")
    : mode === "hf-open"
      ? [
        "Qwen/open-model mode should act like a code-structure and maintainability architect.",
        "Keep the user's selected platform, architecture style, state management and navigation untouched, but propose a richer implementation blueprint around domain boundaries, contracts, local-first/offline data, clean module seams, testability, generated source clarity and documentation.",
        "It may add many files/modules when they are justified. Prefer readable source scaffolding and architectural seams. Do not copy the GPT/commercial shape."
      ].join(" ")
      : modeInstruction(mode, baseline);

  return [
    "You are producing an AI architecture blueprint for App Architector, a controlled starter-project generator used as a diploma laboratory stand for comparing AI generation.",
    "Return only valid JSON matching the provided schema. No Markdown. No comments. No extra text.",
    "IMPORTANT: the user-selected core architecture knobs are locked. Do NOT try to change platform/profile, architecture style, state management, navigation style or package identity. Your differentiation must come from the blueprint: modules, files, responsibilities, relationships, risks and recommendations.",
    "The deterministic materializer will turn your aiBlueprint.files into real generated files, so every file path must be concrete, platform-appropriate, safe, and relative to the project root, without leading slash or '..'.",
    `Use the root folder ${root}. Paths inside aiBlueprint must be relative to that root, for example Assets/Scripts/Commercial/RevenueGuard.${ext} or Docs/CommercialReadiness.md. Do not include the root folder in file paths.`,
    `Use the selected platform ${platform}. Source files should usually use .${ext}; tests may use source/test naming that is natural for the platform.`,
    "Each file must have a useful role and description, because the UI displays this in the generated tree. Avoid generic 'source artifact'.",
    "Relationships should reference file paths that appear in aiBlueprint.modules[].files[].path. Use relation labels like wires, uses, implements, configures, observes, routes-to, renders, persists-through, validates, tracks, documents, tests. Do not generate placeholder self-links; every relation must connect two different files.",
    "Produce enough blueprint depth to make this AI mode visibly different from baseline and from the other AI provider. For normal diploma comparison runs, aim for 60-160 additional AI blueprint files and at least 2 relationships per blueprint file. Fewer is acceptable only when the user's domain is genuinely tiny, and then explain why.",
    "Keep all choices platform-safe and aligned with the user form. You may refine optional feature/product lists only when it improves the generated package; do not disable a user-requested feature just to be different.",
    "",
    "Mode-specific objective:",
    modeGoal,
    "",
    "Locked baseline selected by the user:",
    JSON.stringify({
      profileId: baseline.profileId,
      projectName: baseline.projectName,
      appDisplayName: baseline.appDisplayName,
      packageId: baseline.naming.packageId,
      architecture: baseline.architecture,
      features: baseline.features,
      product: baseline.product,
      enabledModules: baseline.modules.filter((module) => module.enabled).map((module) => module.featureId),
      dependencyWarnings: baseline.dependencyPlan.warnings
    }, null, 2),
    "",
    "User answers:",
    JSON.stringify(answers, null, 2),
    "",
    "Additional user instruction:",
    userInstruction || "No additional instruction was provided.",
    "",
    "Required JSON shape example:",
    JSON.stringify({
      architectureStyle: baseline.architecture.style,
      stateManagement: baseline.architecture.stateManagement,
      navigationStyle: baseline.architecture.navigationStyle,
      environmentMode: answers.environmentMode ?? baseline.architecture.environmentMode,
      features: {
        auth: Boolean(answers.hasAuth),
        analytics: Boolean(answers.hasAnalytics),
        localization: Boolean(answers.hasLocalization),
        push: Boolean(answers.hasPush),
        networking: answers.hasNetworking !== false,
        persistence: Boolean(answers.hasPersistence)
      },
      includeExampleScreen: answers.includeExampleScreen ?? true,
      explanation: "Why this AI blueprint extends the locked architecture.",
      assumptions: ["Concrete assumption about product or delivery context."],
      risks: ["Concrete implementation risk."],
      recommendations: ["Concrete next engineering recommendation."],
      product: {
        distributionStores: answers.distributionStores ?? baseline.product.distributionStores,
        monetization: answers.monetization ?? baseline.product.monetization,
        offlineData: answers.offlineData ?? baseline.product.offlineData,
        runtimeQuality: answers.runtimeQuality ?? baseline.product.runtimeQuality,
        delivery: answers.delivery ?? baseline.product.delivery
      },
      aiBlueprint: {
        strategy: "One sentence describing the generation strategy.",
        modules: [
          {
            name: "CommercialReadiness",
            purpose: "Explains why this module exists.",
            emphasis: "production risk, store readiness, telemetry, or code maintainability",
            files: [
              {
                path: `Assets/Scripts/${projectPascal}/CommercialReadiness/RevenueGuard.${ext}`,
                kind: "source",
                role: "service",
                description: "Validates purchase and entitlement state before premium flows are opened.",
                module: "commercial-readiness"
              }
            ]
          }
        ],
        relationships: [
          {
            from: `Assets/Scripts/${projectPascal}/CommercialReadiness/RevenueGuard.${ext}`,
            to: `Assets/Scripts/${projectPascal}/CommercialReadiness/RevenueGuard.${ext}`,
            relation: "documents",
            reason: "Replace this example with a real relation between two different blueprint files."
          }
        ]
      }
    }, null, 2)
  ].join("\n");
}

function normalizePatch(
  answers: QuestionnaireAnswers,
  baseline: ArchitectureSpec,
  patch: RawArchitecturePatch,
  warnings: string[],
  provider: ProviderName,
  model: string | undefined,
  mode: GenerationMode
): { answers: QuestionnaireAnswers; assumptions: string[]; risks: string[]; recommendations: string[]; explanation?: string; aiBlueprint?: ArchitectureSpec["aiBlueprint"] } {
  // Keep the user's core architecture selections locked. GPT/Qwen differentiation must
  // come from the AI blueprint depth and rationale, not from silently switching
  // architectureStyle/stateManagement/navigationStyle behind the user's back.
  const nextAnswers: QuestionnaireAnswers = {
    ...answers,
    generationMode: answers.generationMode ?? "baseline",
    includeLLMNotes: true,
    profile: baseline.profileId,
    architectureStyle: answers.architectureStyle ?? baseline.architecture.style,
    stateManagement: answers.stateManagement ?? baseline.architecture.stateManagement,
    navigationStyle: answers.navigationStyle ?? baseline.architecture.navigationStyle,
    projectName: answers.projectName,
    appDisplayName: answers.appDisplayName,
    packageId: answers.packageId,
    aiInstruction: answers.aiInstruction
  };

  const environmentMode = patch.environmentMode ?? objectField(patch.architecture).environmentMode;
  if (environmentMode === "single" || environmentMode === "multi") {
    nextAnswers.environmentMode = environmentMode;
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
      // Do not disable an explicitly selected feature. The AI may add depth around it,
      // but it should not remove the user's chosen architecture inputs.
      const original = answers[field];
      nextAnswers[field] = original === true ? true : value;
    }
  }

  const includeExampleScreen = asBoolean(patch.includeExampleScreen);
  if (typeof includeExampleScreen === "boolean") {
    nextAnswers.includeExampleScreen = answers.includeExampleScreen === false ? false : includeExampleScreen;
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

  const aiBlueprint = normalizeBlueprint(patch, baseline, mode, provider, model, warnings);

  return {
    answers: nextAnswers,
    assumptions: asStringArray(patch.assumptions),
    risks: asStringArray(patch.risks),
    recommendations: asStringArray(patch.recommendations),
    explanation: asString(patch.explanation),
    aiBlueprint
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
      maxOutputTokens: Math.max(env.LLM_MAX_NEW_TOKENS, mode === "commercial" ? 12000 : 10000)
    })
    : await runHuggingFaceJson({
      prompt,
      schema: architecturePatchSchema(baseline),
      schemaName: "architecture_spec_patch",
      systemPrompt: "You generate controlled JSON patches for a mobile ArchitectureSpec. Return only valid JSON matching the requested schema.",
      maxOutputTokens: Math.max(env.LLM_MAX_NEW_TOKENS, mode === "commercial" ? 12000 : 10000)
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
  const normalized = normalizePatch(answers, baseline, parsed, warnings, provider, providerResult.model, mode);
  const spec = buildArchitectureSpec({
    ...normalized.answers,
    generationMode: mode,
    includeLLMNotes: true
  });
  spec.aiBlueprint = normalized.aiBlueprint;
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

  const explainedSpec = applyExplanation(spec, metadata, normalized.explanation);
  explainedSpec.aiBlueprint = normalized.aiBlueprint;
  return { spec: explainedSpec, metadata };
}
