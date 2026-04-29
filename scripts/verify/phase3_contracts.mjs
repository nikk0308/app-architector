#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const diagnosticsDir = process.env.DIAGNOSTICS_DIR || path.join(root, "artifacts");
const sourceRoots = ["apps", "packages", "services", "config", "scripts", ".github"];
const ignoredSegments = new Set([".git", "node_modules", "dist", "coverage", "deploy-diagnostics", "artifacts", "storage"]);

const checks = [];
const logLines = [];

function log(line) {
  logLines.push(line);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function contains(haystack, needle) {
  return haystack.includes(needle);
}

function check(condition, id, message, details = {}) {
  const item = { id, status: condition ? "passed" : "failed", message, details };
  checks.push(item);
}

function shouldSkip(entryPath) {
  return entryPath.split(path.sep).some((segment) => ignoredSegments.has(segment));
}

function walkFiles(start) {
  const absoluteStart = path.join(root, start);
  if (!fs.existsSync(absoluteStart)) {
    return [];
  }
  const files = [];
  const pending = [absoluteStart];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || shouldSkip(path.relative(root, current))) {
      continue;
    }

    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        pending.push(path.join(current, entry));
      }
      continue;
    }
    if (stat.isFile()) {
      files.push(current);
    }
  }

  return files.sort();
}

function sourceFiles() {
  return sourceRoots.flatMap(walkFiles);
}

function scan(pattern) {
  const matches = [];
  for (const file of sourceFiles()) {
    const relativeFile = path.relative(root, file).replace(/\\/g, "/");
    if (relativeFile === "scripts/verify/phase3_contracts.mjs") {
      continue;
    }
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push({
          file: relativeFile,
          line: index + 1,
          text: line.trim().slice(0, 240)
        });
      }
    });
  }
  return matches;
}

function packageSummary(packagePaths) {
  return packagePaths.map((packagePath) => {
    const parsed = readJson(packagePath);
    return {
      path: packagePath,
      name: parsed.name,
      private: Boolean(parsed.private),
      version: parsed.version,
      workspaces: parsed.workspaces,
      scripts: parsed.scripts ?? {},
      dependencies: Object.keys(parsed.dependencies ?? {}).sort(),
      devDependencies: Object.keys(parsed.devDependencies ?? {}).sort()
    };
  });
}

function writeDiagnostics(report, packageSummaryData) {
  fs.mkdirSync(diagnosticsDir, { recursive: true });

  const workspaceSummary = [
    "workspace-summary",
    `root=${root}`,
    `node=${process.version}`,
    `platform=${process.platform}`,
    `diagnosticsDir=${diagnosticsDir}`,
    `workspaces=${JSON.stringify(readJson("package.json").workspaces ?? [])}`,
    `sourceFiles=${sourceFiles().length}`
  ];

  const treeSummary = sourceFiles()
    .map((file) => path.relative(root, file).replace(/\\/g, "/"))
    .slice(0, 500);

  fs.writeFileSync(path.join(diagnosticsDir, "phase3-contracts.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(diagnosticsDir, "phase3-contracts.md"), `${markdownReport(report)}\n`);
  fs.writeFileSync(path.join(diagnosticsDir, "phase3-contracts.log"), `${logLines.join("\n")}\n`);
  fs.writeFileSync(path.join(diagnosticsDir, "workspace-summary.txt"), `${workspaceSummary.join("\n")}\n`);
  fs.writeFileSync(path.join(diagnosticsDir, "package-summary.json"), `${JSON.stringify(packageSummaryData, null, 2)}\n`);
  fs.writeFileSync(path.join(diagnosticsDir, "tree-summary.txt"), `${treeSummary.join("\n")}\n`);
}

function markdownReport(report) {
  return [
    "# Phase 3 advisor contract verification",
    "",
    `Status: ${report.status}`,
    `Passed: ${report.summary.passed}/${report.summary.total}`,
    "",
    ...report.checks.map((item) => `- ${item.status === "passed" ? "PASS" : "FAIL"} ${item.id}: ${item.message}`)
  ].join("\n");
}

try {
  log("Starting phase 3 contract verification.");

  const rootPackage = readJson("package.json");
  const packagePaths = [
    "package.json",
    "packages/shared/package.json",
    "apps/api/package.json",
    "apps/web/package.json"
  ];
  const packageSummaryData = packageSummary(packagePaths);

  const sharedIndex = read("packages/shared/src/index.ts");
  const sharedTypes = read("packages/shared/src/types.ts");
  const appSource = read("apps/api/src/app.ts");
  const advisorSource = read("apps/api/src/services/advisor/architectureAdvisor.ts");
  const deterministicSource = read("apps/api/src/services/advisor/deterministic.ts");
  const generatorRunnerSource = read("apps/api/src/services/generatorRunner.ts");
  const templateVariablesSource = read("apps/api/src/services/templateVariables.ts");
  const deployWorkflow = read(".github/workflows/03_deploy.yml");
  const registry = readJson("config/artifact-registry.json");

  const legacyArchitectureManifest = scan(/\bArchitectureManifest\b/);
  const directProfileIncludeLlmNotes = scan(/profile\.includeLLMNotes/);

  check(exists("package.json"), "root.package-json", "Root package.json exists.");
  check(Array.isArray(rootPackage.workspaces) && rootPackage.workspaces.includes("apps/*") && rootPackage.workspaces.includes("packages/*"), "root.workspaces", "Root package declares apps/* and packages/* workspaces.");
  check(packageSummaryData.every((pkg) => typeof pkg.scripts.build === "string" || pkg.path === "package.json"), "packages.workspace-build-scripts", "Workspace packages expose build scripts.");
  check(typeof rootPackage.scripts?.build === "string", "root.build-script", "Root package exposes a build script.");

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
    legacyArchitectureManifest.length === 0,
    "shared.no-legacy-architecture-manifest-name",
    "Legacy ArchitectureManifest references are absent; phase 3 uses ArtifactManifest.",
    { matches: legacyArchitectureManifest }
  );

  check(
    contains(advisorSource, "ArtifactManifest"),
    "api.advisor-uses-artifact-manifest",
    "Architecture advisor imports and consumes ArtifactManifest."
  );

  check(
    directProfileIncludeLlmNotes.length === 0 && contains(appSource, "spec.features.llmNotes"),
    "api.no-normalized-profile-include-llm-notes",
    "The API no longer reads includeLLMNotes from NormalizedProfile; it reads the normalized spec feature flag.",
    { matches: directProfileIncludeLlmNotes }
  );

  check(
    contains(generatorRunnerSource, "advisorReport") && contains(templateVariablesSource, "advisor_json") && contains(templateVariablesSource, "advisor_markdown"),
    "api.generator-carries-advisor-payload",
    "Generator payload carries advisor JSON and Markdown template variables."
  );

  check(
    contains(deterministicSource, "buildDeterministicAdvisorReport") && contains(advisorSource, "withReportMetadata"),
    "api.deterministic-advisor-fallback",
    "Advisor keeps a deterministic fallback and enriches reports with stable metadata."
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
    exists("scripts/smoke_generated_zip.mjs") && contains(read("scripts/smoke_phase3_advisor.sh"), "smoke_generated_zip.mjs"),
    "smoke.generated-zip-inspection",
    "Generated ZIP smoke inspection is available and wired into the phase 3 smoke wrapper."
  );

  check(
    !contains(deployWorkflow, "actions/upload-artifact@v4") && !contains(deployWorkflow, "actions/upload-artifact@v6")
      && contains(deployWorkflow, "actions/upload-artifact@v7"),
    "workflow.node24-upload-artifact",
    "Deploy workflow uses the Node 24 upload-artifact action line, not deprecated Node 20 action revisions."
  );

  check(
    contains(deployWorkflow, "if: ${{ always() }}") && contains(deployWorkflow, "path: deploy-diagnostics"),
    "workflow.always-upload-diagnostics",
    "Deploy workflow uploads diagnostics with if: always()."
  );

  check(
    contains(deployWorkflow, "build.log") && contains(deployWorkflow, "test.log") && contains(deployWorkflow, "advisor-smoke.log"),
    "workflow.core-diagnostic-logs",
    "Deploy workflow captures build, test and advisor smoke logs."
  );

  check(
    (contains(deployWorkflow, "npm run verify:phase3") || contains(deployWorkflow, "node scripts/verify/phase3_contracts.mjs")),
    "workflow.phase3-contract-step",
    "Deploy workflow runs the fast phase 3 contract verifier before build."
  );

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

  log(`Completed phase 3 contract verification with status=${report.status}.`);
  writeDiagnostics(report, packageSummaryData);

  const output = markdownReport(report);
  if (failed.length > 0) {
    console.error(output);
    process.exit(1);
  }
  console.log(output);
} catch (error) {
  const report = {
    status: "failed",
    createdAt: new Date().toISOString(),
    root,
    summary: { total: 1, passed: 0, failed: 1 },
    checks: [{
      id: "phase3.contract-runner",
      status: "failed",
      message: "Phase 3 contract verifier crashed before completing all checks.",
      details: { error: error instanceof Error ? error.message : String(error) }
    }]
  };
  log(`Verifier crashed: ${error instanceof Error ? error.message : String(error)}`);
  fs.mkdirSync(diagnosticsDir, { recursive: true });
  writeDiagnostics(report, exists("package.json") ? packageSummary(["package.json"]) : []);
  console.error(markdownReport(report));
  process.exit(1);
}
