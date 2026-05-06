#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const diagnosticsDir = process.env.DIAGNOSTICS_DIR || path.join(root, "artifacts");
const appModulePath = path.join(root, "apps", "api", "dist", "app.js");
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function markdown(report) {
  return [
    "# Runtime health smoke",
    "",
    `Status: ${report.status}`,
    `HTTP /api/health: ${report.healthStatusCode}`,
    `HTTP /api/health/ready: ${report.readyStatusCode}`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.status.toUpperCase()} ${check.id}: ${check.message}`)
  ].join("\n");
}

async function run() {
  if (!fs.existsSync(appModulePath)) {
    throw new Error("API dist/app.js is missing. Run npm run build -w @mag/api before runtime smoke.");
  }

  const { createApp } = await import(pathToFileURL(appModulePath).href);
  const app = createApp();
  const health = await app.inject({ method: "GET", url: "/api/health" });
  const ready = await app.inject({ method: "GET", url: "/api/health/ready" });
  await app.close();

  const healthPayload = health.json();
  const readyPayload = ready.json();
  const serialized = JSON.stringify({ healthPayload, readyPayload });
  const checks = [
    {
      id: "health.status-code",
      status: health.statusCode === 200 ? "passed" : "failed",
      message: "/api/health returns HTTP 200."
    },
    {
      id: "ready.status-code",
      status: [200, 503].includes(ready.statusCode) ? "passed" : "failed",
      message: "/api/health/ready returns readiness status without crashing."
    },
    {
      id: "runtime.checks-present",
      status: Array.isArray(readyPayload.checks) && readyPayload.checks.length > 0 ? "passed" : "failed",
      message: "Runtime readiness exposes checks."
    },
    {
      id: "runtime.no-secret-names",
      status: !serialized.includes("OPENAI_API_KEY") && !serialized.includes("HF_TOKEN") ? "passed" : "failed",
      message: "Runtime health response does not include secret variable names or raw secret values."
    }
  ];
  const failed = checks.filter((check) => check.status === "failed");
  const report = {
    status: failed.length === 0 ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    healthStatusCode: health.statusCode,
    readyStatusCode: ready.statusCode,
    checks,
    runtimeStatus: readyPayload.status,
    providerCount: readyPayload.providers?.length ?? 0
  };

  fs.mkdirSync(diagnosticsDir, { recursive: true });
  writeJson(path.join(diagnosticsDir, "runtime-health-smoke.json"), report);
  writeText(path.join(diagnosticsDir, "runtime-health-smoke.md"), `${markdown(report)}\n`);

  if (failed.length > 0) {
    console.error(markdown(report));
    process.exit(1);
  }
  console.log(markdown(report));
}

run().catch((error) => {
  const report = {
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    checks: []
  };
  fs.mkdirSync(diagnosticsDir, { recursive: true });
  writeJson(path.join(diagnosticsDir, "runtime-health-smoke.json"), report);
  writeText(path.join(diagnosticsDir, "runtime-health-smoke.md"), `# Runtime health smoke\n\nStatus: failed\n\n${report.error}\n`);
  console.error(report.error);
  process.exit(1);
});
