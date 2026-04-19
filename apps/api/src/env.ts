import path from "node:path";
import { config } from "dotenv";
import { repoRoot, storageRoot } from "./runtimePaths.js";

config();

const port = Number(process.env.PORT ?? 4000);
const outputRoot = process.env.OUTPUT_ROOT
  ? path.resolve(process.env.OUTPUT_ROOT)
  : path.resolve(storageRoot, "generated");

export const env = {
  PORT: Number.isFinite(port) ? port : 4000,
  HOST: process.env.HOST ?? "0.0.0.0",
  OUTPUT_ROOT: outputRoot,
  GENERATED_OUTPUT_DIR: path.resolve(outputRoot, "projects"),
  GENERATED_ZIP_DIR: path.resolve(outputRoot, "zips"),
  DATABASE_PATH: process.env.DATABASE_PATH ?? path.resolve(storageRoot, "app.db"),
  REGISTRY_PATH: process.env.REGISTRY_PATH ?? path.resolve(repoRoot, "config", "artifact-registry.json"),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
  ENABLE_LLM_ENRICHMENT: process.env.ENABLE_LLM_ENRICHMENT === "true"
};
