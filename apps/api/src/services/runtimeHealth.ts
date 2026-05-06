import fs from "node:fs";
import path from "node:path";
import {
  CONTRACT_VERSIONS,
  type RuntimeHealthCheck,
  type RuntimeHealthReport,
  type RuntimeHealthStatus
} from "@mag/shared";
import { env } from "../env.js";
import { repoRoot } from "../runtimePaths.js";
import { getProviderStatusSummaries } from "./providers/status.js";

function check(condition: boolean, id: string, message: string, details?: RuntimeHealthCheck["details"]): RuntimeHealthCheck {
  return {
    id,
    status: condition ? "passed" : "failed",
    message,
    details
  };
}

function warning(condition: boolean, id: string, message: string, details?: RuntimeHealthCheck["details"]): RuntimeHealthCheck {
  return {
    id,
    status: condition ? "passed" : "warning",
    message,
    details
  };
}

function canWriteDirectory(directory: string): boolean {
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.accessSync(directory, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function registryIsReadable(): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(env.REGISTRY_PATH, "utf8")) as unknown;
    return Array.isArray(parsed) || Boolean(parsed && typeof parsed === "object" && Array.isArray((parsed as { artifacts?: unknown }).artifacts));
  } catch {
    return false;
  }
}

function statusFromChecks(checks: RuntimeHealthCheck[]): RuntimeHealthStatus {
  return checks.some((item) => item.status === "failed") ? "degraded" : "ready";
}

export function buildRuntimeHealthReport(): RuntimeHealthReport {
  const generatorPath = path.resolve(repoRoot, "services", "generator-python", "generator_cli.py");
  const providers = getProviderStatusSummaries().map((provider) => ({
    provider: provider.provider,
    enabled: provider.enabled,
    status: provider.status,
    model: provider.model,
    reason: provider.reason
  }));
  const checks: RuntimeHealthCheck[] = [
    check(fs.existsSync(env.REGISTRY_PATH) && registryIsReadable(), "registry.readable", "Artifact registry exists and has a supported shape."),
    check(fs.existsSync(generatorPath), "generator.script", "Python generator script exists."),
    check(canWriteDirectory(env.GENERATED_OUTPUT_DIR), "storage.output-writable", "Generated project output directory is writable."),
    check(canWriteDirectory(env.GENERATED_ZIP_DIR), "storage.zip-writable", "Generated ZIP directory is writable."),
    check(canWriteDirectory(path.dirname(env.DATABASE_PATH)), "storage.database-dir-writable", "Database directory is writable."),
    check(env.API_REQUEST_TIMEOUT_MS >= 10_000, "timeout.api", "API request timeout is configured for generation workloads.", { timeoutMs: env.API_REQUEST_TIMEOUT_MS }),
    check(env.GENERATOR_TIMEOUT_MS >= 10_000, "timeout.generator", "Generator timeout is configured for materialization workloads.", { timeoutMs: env.GENERATOR_TIMEOUT_MS }),
    warning(env.NODE_ENV !== "production" || env.CORS_ORIGIN !== "*", "cors.production-origin", "Production deployments should use an explicit CORS origin."),
    warning(env.STORAGE_RETENTION_DAYS >= 1, "storage.retention", "Storage retention is configured for cleanup tooling.", { retentionDays: env.STORAGE_RETENTION_DAYS })
  ];

  return {
    status: statusFromChecks(checks),
    generatedAt: new Date().toISOString(),
    checks,
    providers,
    contractVersions: CONTRACT_VERSIONS
  };
}
