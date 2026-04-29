import type { AIProviderStatusSummary } from "@mag/shared";
import { env } from "../../env.js";

export function getProviderStatusSummaries(): AIProviderStatusSummary[] {
  return [
    {
      provider: "deterministic",
      enabled: true,
      status: "ready",
      capabilities: ["advisor"],
      reason: "Deterministic fallback is always available and does not require model credentials."
    },
    {
      provider: "huggingface",
      enabled: env.LLM_ENABLED && Boolean(env.HF_TOKEN),
      status: !env.LLM_ENABLED ? "disabled" : env.HF_TOKEN ? "ready" : "fallback",
      model: env.HF_MODEL,
      capabilities: ["advisor"],
      reason: !env.LLM_ENABLED
        ? "LLM_ENABLED is false."
        : env.HF_TOKEN
          ? "Hugging Face token is configured; runtime availability is checked during advisor execution."
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
          ? "OpenAI key is configured; provider execution will be added behind the shared adapter contract."
          : "OPENAI_API_KEY is not configured."
    }
  ];
}
