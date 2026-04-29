#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const diagnosticsDir = process.env.DIAGNOSTICS_DIR || path.join(root, "deploy-diagnostics");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function check(condition, id, message, details = {}) {
  const item = { id, status: condition ? "passed" : "failed", message, details };
  checks.push(item);
}

function contains(haystack, needle) {
  return haystack.includes(needle);
}

const checks = [];

try {
  const sharedIndex = read("packages/shared/src/index.ts");
  const sharedTypes = read("packages/shared/src/types.ts");
  const appSource = read("apps/api/src/app.ts");
  const advisorSource = read("apps/api/src/services/advisor/architectureAdvisor.ts");
  const generatorRunnerSource = read("apps/api/src/services/generatorRunner.ts");
  const templateVariablesSource = read("apps/api/src/services/templateVariables.ts");
  const deployWorkflow = read(".github/workflows/03_deploy.yml");
  const registry = JSON.parse(read("config/artifact-registry.json"));

  check(
    (contains(sharedIndex, "ArtifactManifest") || contains(sharedIndex, "export * from \"./types.js\"")) && contains(sharedTypes, "interface ArtifactManifest"),
    "shared.artifact-manifest-export",
    "@mag/shared exposes the ArtifactManifest contract used by the API advisor."
  );

  check(
    (contains(sharedIndex, "ArchitectureAdvisorReport") || contains(sharedIndex, "export * from \"./types.js\"")) && contains(sharedTypes, "interface ArchitectureAdvisorReport"),
    "shared.advisor-report-export",
    "@mag/shared exposes the phase 3 advisor report contract."
  );

  check(
    !contains(sharedIndex, "ArchitectureManifest") && !contains(advisorSource, "ArchitectureManifest"),
    "shared.no-legacy-architecture-manifest-name",
    "Legacy ArchitectureManifest references are absent; phase 3 uses ArtifactManifest."
  );

  check(
    contains(advisorSource, "ArtifactManifest"),
    "api.advisor-uses-artifact-manifest",
    "Architecture advisor imports and consumes ArtifactManifest."
  );

  check(
    !contains(appSource, "profile.includeLLMNotes") && contains(appSource, "spec.features.llmNotes"),
    "api.no-normalized-profile-include-llm-notes",
    "The API no longer reads includeLLMNotes from NormalizedProfile; it reads the normalized spec feature flag."
  );

  check(
    contains(generatorRunnerSource, "advisorReport") && contains(templateVariablesSource, "advisor_json") && contains(templateVariablesSource, "advisor_markdown"),
    "api.generator-carries-advisor-payload",
    "Generator payload carries advisor JSON and Markdown template variables."
  );

  const advisorRegistry = registry.find((artifact) => artifact.id === "meta.advisor");
  const advisorOutputs = advisorRegistry?.outputs?.default ?? [];
  const advisorPaths = advisorOutputs.map((output) => output.path).sort();

  check(
    Boolean(advisorRegistry) && advisorPaths.includes(".mag/architecture-advisor.json") && advisorPaths.includes("docs/architecture-decisions.md"),
    "registry.advisor-artifacts",
    "Artifact registry emits durable advisor artifacts into generated archives.",
    { advisorPaths }
  );

  check(
    exists("services/generator-python/templates/common/architecture-advisor.json.tpl")
      && exists("services/generator-python/templates/common/architecture-decisions.md.tpl"),
    "templates.advisor-templates",
    "Advisor JSON and Markdown templates exist for the Python generator."
  );

  check(
    !contains(deployWorkflow, "actions/upload-artifact@v4") && !contains(deployWorkflow, "actions/upload-artifact@v6")
      && contains(deployWorkflow, "actions/upload-artifact@v7"),
    "workflow.node24-upload-artifact",
    "Deploy workflow uses the Node 24 upload-artifact action line, not deprecated Node 20 action revisions."
  );

  check(
    (contains(deployWorkflow, "npm run verify:phase3") || contains(deployWorkflow, "node scripts/verify/phase3_contracts.mjs")),
    "workflow.phase3-contract-step",
    "Deploy workflow runs the fast phase 3 contract verifier before build."
  );
} catch (error) {
  checks.push({
    id: "phase3.contract-runner",
    status: "failed",
    message: "Phase 3 contract verifier crashed before completing all checks.",
    details: { error: error instanceof Error ? error.message : String(error) }
  });
}

const failed = checks.filter((item) => item.status === "failed");
const report = {
  status: failed.length === 0 ? "passed" : "failed",
  createdAt: new Date().toISOString(),
  root,
  summary: {
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length
  },
  checks
};

fs.mkdirSync(diagnosticsDir, { recursive: true });
fs.writeFileSync(path.join(diagnosticsDir, "phase3-contracts.json"), `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  "# Phase 3 advisor contract verification",
  "",
  `Status: ${report.status}`,
  `Passed: ${report.summary.passed}/${report.summary.total}`,
  "",
  ...checks.map((item) => `- ${item.status === "passed" ? "PASS" : "FAIL"} ${item.id}: ${item.message}`)
];
fs.writeFileSync(path.join(diagnosticsDir, "phase3-contracts.md"), `${lines.join("\n")}\n`);

if (failed.length > 0) {
  console.error(lines.join("\n"));
  process.exit(1);
}

console.log(lines.join("\n"));
