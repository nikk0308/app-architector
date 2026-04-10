import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";
import { repoRoot } from "./runtimePaths.js";

const configuredEnvFile = process.env.MAG_ENV_FILE?.trim();
if (configuredEnvFile && fs.existsSync(configuredEnvFile)) {
  dotenv.config({ path: configuredEnvFile, override: true });
}

const defaultEnvFile = path.resolve(repoRoot, ".env");
if (fs.existsSync(defaultEnvFile)) {
  dotenv.config({ path: defaultEnvFile });
}

dotenv.config();

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_PATH: z.string().default("./data/app.db"),
  OUTPUT_ROOT: z.string().default("./storage/generations"),
  PYTHON_BIN: z.string().default("python3"),
  GENERATOR_SCRIPT: z.string().optional(),
  REGISTRY_PATH: z.string().optional(),
  TEMPLATE_ROOT: z.string().optional(),
  LLM_PROVIDER: z.string().default("disabled"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("error"),
  MAG_ENV_FILE: z.string().optional()
});

const rawEnv = envSchema.parse(process.env);

export const env = {
  ...rawEnv,
  GENERATOR_SCRIPT: rawEnv.GENERATOR_SCRIPT ?? path.resolve(repoRoot, "services/generator-python/generator_cli.py"),
  REGISTRY_PATH: rawEnv.REGISTRY_PATH ?? path.resolve(repoRoot, "config/artifact-registry.json"),
  TEMPLATE_ROOT: rawEnv.TEMPLATE_ROOT ?? path.resolve(repoRoot, "services/generator-python/templates")
};
