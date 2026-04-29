import type {
  ArchitectureAdvisorReport,
  ArchitectureAdvisorStatus,
  ArtifactManifest,
  ArchitectureSpec,
  GenerationMode,
  QuestionnaireAnswers,
  ValidationReport
} from "@mag/shared";
import { env } from "../../env.js";
import { buildAdvisorPrompt } from "./prompt.js";
import { runHuggingFaceAdvisor } from "./provider.js";
import { parseAdvisorResponse } from "./parser.js";
import { buildDeterministicAdvisorReport } from "./deterministic.js";

export interface AdvisorBuildInput {
  answers: QuestionnaireAnswers;
  spec: ArchitectureSpec;
  manifest: ArtifactManifest;
  validation: ValidationReport;
  mode?: GenerationMode;
}

export function getAdvisorStatus(): ArchitectureAdvisorStatus {
  if (!env.LLM_ENABLED) {
    return {
      enabled: false,
      provider: "deterministic",
      status: "disabled",
      reason: "LLM_ENABLED is false. Deterministic advisor fallback is still available."
    };
  }

  if (!env.HF_TOKEN) {
    return {
      enabled: false,
      provider: "huggingface",
      status: "fallback",
      model: env.HF_MODEL,
      reason: "HF_TOKEN is not configured. The API will use deterministic advisor output."
    };
  }

  return {
    enabled: true,
    provider: "huggingface",
    status: "ready",
    model: env.HF_MODEL
  };
}

function wantsProvider(mode?: GenerationMode): boolean {
  return mode === "hf-open" || mode === "hybrid";
}

function advisorMode(input: {
  status: ArchitectureAdvisorReport["status"];
  provider: ArchitectureAdvisorReport["provider"];
}): NonNullable<ArchitectureAdvisorReport["mode"]> {
  if (input.provider === "huggingface" && input.status === "ready") {
    return "llm";
  }
  if (input.status === "disabled") {
    return "disabled-fallback";
  }
  if (input.provider === "deterministic") {
    return input.status === "fallback" ? "llm-fallback" : "deterministic-fallback";
  }
  return "llm-fallback";
}

function featureRecommendations(spec: ArchitectureSpec): string[] {
  const recommendations = [
    `Keep the ${spec.architecture.style} boundary visible in folders, tests and README examples.`,
    "Treat generated services as replaceable ports until real product endpoints are selected."
  ];

  if (spec.features.auth) {
    recommendations.push("Add token refresh, logout and unauthorized-state tests before connecting production auth.");
  }
  if (spec.features.persistence) {
    recommendations.push("Define a migration strategy before replacing the generated local persistence placeholder.");
  }
  if (spec.features.analytics) {
    recommendations.push("Document analytics event names early so generated navigation hooks do not drift from product metrics.");
  }
  if (spec.features.push) {
    recommendations.push("Keep push credentials outside the generated source tree and inject them through environment-specific config.");
  }

  return recommendations;
}

function withReportMetadata(report: ArchitectureAdvisorReport, input: AdvisorBuildInput): ArchitectureAdvisorReport {
  const llmUsed = report.provider === "huggingface" && report.status === "ready";
  const llmWarnings = report.provider === "deterministic" ? report.warnings : [];

  return {
    ...report,
    schemaVersion: report.schemaVersion ?? "1.0",
    advisorVersion: report.advisorVersion ?? "phase3",
    mode: report.mode ?? advisorMode({ status: report.status, provider: report.provider }),
    architecture: report.architecture ?? {
      style: input.spec.architecture.style,
      rationale: input.spec.explanation,
      platforms: [input.spec.profileId]
    },
    modules: report.modules ?? input.spec.modules
      .filter((module) => module.enabled)
      .map((module) => ({
        id: module.featureId,
        enabled: module.enabled,
        required: module.required,
        artifactIds: module.artifactIds
      })),
    assumptions: report.assumptions ?? [
      "The generated package is a starter architecture, not a complete production application.",
      "External credentials, API contracts and deployment-specific values must be supplied outside the generated ZIP.",
      "The deterministic advisor path remains available when no LLM provider is configured."
    ],
    recommendations: report.recommendations ?? featureRecommendations(input.spec),
    llm: report.llm ?? {
      enabled: env.LLM_ENABLED,
      used: llmUsed,
      status: llmUsed ? "used" : env.LLM_ENABLED ? "unavailable" : "disabled",
      provider: report.provider,
      model: report.model,
      warnings: llmWarnings
    }
  };
}

export async function buildArchitectureAdvisorReport(input: AdvisorBuildInput): Promise<ArchitectureAdvisorReport> {
  const createdAt = new Date().toISOString();
  const status = getAdvisorStatus();

  if (!env.LLM_ENABLED || !wantsProvider(input.mode)) {
    return withReportMetadata(buildDeterministicAdvisorReport({
      ...input,
      createdAt,
      status: env.LLM_ENABLED ? "fallback" : "disabled",
      warnings: status.reason ? [status.reason] : []
    }), input);
  }

  const prompt = buildAdvisorPrompt(input);
  const providerResult = await runHuggingFaceAdvisor(prompt);

  if (!providerResult.ok || !providerResult.text) {
    return withReportMetadata(buildDeterministicAdvisorReport({
      ...input,
      createdAt,
      status: "fallback",
      provider: "deterministic",
      model: providerResult.model,
      warnings: [`Provider fallback: ${providerResult.error ?? "unknown provider error"}`]
    }), input);
  }

  const parsed = parseAdvisorResponse(providerResult.text, createdAt);
  if (!parsed) {
    return withReportMetadata(buildDeterministicAdvisorReport({
      ...input,
      createdAt,
      status: "fallback",
      provider: "deterministic",
      model: providerResult.model,
      warnings: ["Provider fallback: model response did not match the expected JSON schema."]
    }), input);
  }

  return withReportMetadata({
    ...parsed,
    status: "ready",
    provider: "huggingface",
    model: providerResult.model
  }, input);
}
