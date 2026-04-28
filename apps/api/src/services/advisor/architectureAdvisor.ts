import type {
  ArchitectureAdvisorReport,
  ArchitectureAdvisorStatus,
  ArchitectureManifest,
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
  manifest: ArchitectureManifest;
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

export async function buildArchitectureAdvisorReport(input: AdvisorBuildInput): Promise<ArchitectureAdvisorReport> {
  const createdAt = new Date().toISOString();
  const status = getAdvisorStatus();

  if (!env.LLM_ENABLED || !wantsProvider(input.mode)) {
    return buildDeterministicAdvisorReport({
      ...input,
      createdAt,
      status: env.LLM_ENABLED ? "fallback" : "disabled",
      warnings: status.reason ? [status.reason] : []
    });
  }

  const prompt = buildAdvisorPrompt(input);
  const providerResult = await runHuggingFaceAdvisor(prompt);

  if (!providerResult.ok || !providerResult.text) {
    return buildDeterministicAdvisorReport({
      ...input,
      createdAt,
      status: "fallback",
      provider: "deterministic",
      model: providerResult.model,
      warnings: [`Provider fallback: ${providerResult.error ?? "unknown provider error"}`]
    });
  }

  const parsed = parseAdvisorResponse(providerResult.text, createdAt);
  if (!parsed) {
    return buildDeterministicAdvisorReport({
      ...input,
      createdAt,
      status: "fallback",
      provider: "deterministic",
      model: providerResult.model,
      warnings: ["Provider fallback: model response did not match the expected JSON schema."]
    });
  }

  return {
    ...parsed,
    status: "ready",
    provider: "huggingface",
    model: providerResult.model
  };
}
