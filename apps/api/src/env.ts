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
const outputRoot = process.env.OUTPUT_ROOT
  ? path.resolve(process.env.OUTPUT_ROOT)
  : path.resolve(storageRoot, "generated");

export const env = {
  PORT: port,
  HOST: process.env.HOST ?? "0.0.0.0",
  OUTPUT_ROOT: outputRoot,
  GENERATED_OUTPUT_DIR: path.resolve(outputRoot, "projects"),
  GENERATED_ZIP_DIR: path.resolve(outputRoot, "zips"),
  DATABASE_PATH: process.env.DATABASE_PATH ?? path.resolve(storageRoot, "app.db"),
  REGISTRY_PATH: process.env.REGISTRY_PATH ?? path.resolve(repoRoot, "config", "artifact-registry.json"),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
  ENABLE_LLM_ENRICHMENT: process.env.ENABLE_LLM_ENRICHMENT === "true"
};
