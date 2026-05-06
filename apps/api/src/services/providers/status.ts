import type { AIProviderStatusSummary } from "@mag/shared";
import { env } from "../../env.js";

export function getProviderStatusSummaries(): AIProviderStatusSummary[] {
  return [
    {
      provider: "deterministic",
      enabled: true,
      status: "ready",
      capabilities: ["advisor", "spec-synthesis"],
      reason: "Deterministic fallback is always available and does not require model credentials."
    },
    {
      provider: "huggingface",
      enabled: env.LLM_ENABLED && Boolean(env.HF_TOKEN),
      status: !env.LLM_ENABLED ? "disabled" : env.HF_TOKEN ? "ready" : "fallback",
      model: env.HF_MODEL,
      capabilities: ["advisor", "spec-synthesis"],
      reason: !env.LLM_ENABLED
        ? "LLM_ENABLED is false."
        : env.HF_TOKEN
          ? "Hugging Face token is configured; runtime availability is checked during spec synthesis and advisor execution."
          : "HF_TOKEN is not configured."
    },
    {
      provider: "openai",
      enabled: env.LLM_ENABLED && Boolean(env.OPENAI_API_KEY),
      status: !env.LLM_ENABLED ? "disabled" : env.OPENAI_API_KEY ? "ready" : "fallback",
      model: env.OPENAI_MODEL,
      capabilities: ["advisor", "spec-synthesis", "hybrid-refinement"],
      reason: !env.LLM_ENABLED
        ? "LLM_ENABLED is false."
        : env.OPENAI_API_KEY
          ? "OpenAI key is configured for controlled spec synthesis, advisor output and hybrid refinement."
          : "OPENAI_API_KEY is not configured."
    }
  ];
}
