import path from "node:path";
import { config } from "dotenv";
import { repoRoot, storageRoot } from "./runtimePaths.js";

const envFile = process.env.MAG_ENV_FILE;

if (envFile) {
  config({ path: envFile });
}

config();

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const port = numberFromEnv("PORT", 3000);
const apiRequestTimeoutMs = numberFromEnv("API_REQUEST_TIMEOUT_MS", 360_000);
const requestBodyLimitBytes = numberFromEnv("REQUEST_BODY_LIMIT_BYTES", 1_048_576);
const generatorTimeoutMs = numberFromEnv("GENERATOR_TIMEOUT_MS", 360_000);
const outputRoot = process.env.OUTPUT_ROOT
  ? path.resolve(process.env.OUTPUT_ROOT)
  : path.resolve(storageRoot, "generated");

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: port,
  HOST: process.env.HOST ?? "0.0.0.0",
  OUTPUT_ROOT: outputRoot,
  GENERATED_OUTPUT_DIR: path.resolve(outputRoot, "projects"),
  GENERATED_ZIP_DIR: path.resolve(outputRoot, "zips"),
  DATABASE_PATH: process.env.DATABASE_PATH ?? path.resolve(storageRoot, "app.db"),
  REGISTRY_PATH: process.env.REGISTRY_PATH ?? path.resolve(repoRoot, "config", "artifact-registry.json"),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  API_REQUEST_TIMEOUT_MS: apiRequestTimeoutMs,
  REQUEST_BODY_LIMIT_BYTES: requestBodyLimitBytes,
  GENERATOR_TIMEOUT_MS: generatorTimeoutMs,
  STORAGE_RETENTION_DAYS: numberFromEnv("STORAGE_RETENTION_DAYS", 14),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
  ENABLE_LLM_ENRICHMENT: process.env.ENABLE_LLM_ENRICHMENT === "true",
  LLM_ENABLED: process.env.LLM_ENABLED === "true" || process.env.ENABLE_LLM_ENRICHMENT === "true",
  STRICT_AI_MODE_FAILURES: process.env.STRICT_AI_MODE_FAILURES !== "false",
  HF_TOKEN: process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_TOKEN ?? "",
  HF_MODEL: process.env.HF_MODEL ?? "Qwen/Qwen2.5-Coder-32B-Instruct",
  HF_ENDPOINT: process.env.HF_ENDPOINT ?? "",
  HF_PROVIDER: process.env.HF_PROVIDER ?? "nscale",
  LLM_TIMEOUT_MS: Math.max(numberFromEnv("LLM_TIMEOUT_MS", 300_000), 60_000),
  LLM_MAX_NEW_TOKENS: Math.max(numberFromEnv("LLM_MAX_NEW_TOKENS", 14_000), 4_000)
};
