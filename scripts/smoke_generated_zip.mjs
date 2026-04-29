#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const diagnosticsDir = process.env.DIAGNOSTICS_DIR || path.join(root, "artifacts");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mag_phase3_smoke_"));
const outputDir = path.join(workDir, "out");
const zipPath = path.join(workDir, "generated.zip");
const payloadPath = path.join(workDir, "payload.json");
const generatorPath = path.join(root, "services", "generator-python", "generator_cli.py");
const pythonCandidates = [
  process.env.GENERATOR_PYTHON_BIN,
  process.env.PYTHON_BIN,
  "python3",
  "python",
  "py"
].filter(Boolean);
let pythonBin = pythonCandidates[0];

const requiredRelativePaths = [
  ".mag/architecture-advisor.json",
  ".mag/architecture-synthesis.json",
  "docs/architecture-decisions.md"
];

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function inspectZip(zipFile) {
  const script = [
    "import json, sys, zipfile",
    "with zipfile.ZipFile(sys.argv[1]) as z:",
    "    print(json.dumps(z.namelist()))"
  ].join("\n");
  const result = spawnSync(pythonBin, ["-c", script, zipFile], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Could not inspect zip: ${result.stderr || result.stdout || "unknown python error"}`);
  }
  return JSON.parse(result.stdout);
}

function resolvePython() {
  for (const candidate of pythonCandidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (!result.error && result.status === 0) {
      pythonBin = candidate;
      return;
    }
  }
}

function markdown(report) {
  const checks = report.checks.map((item) => `- ${item.status === "passed" ? "PASS" : "FAIL"} ${item.id}: ${item.message}`);
  return [
    "# Generated ZIP inspection",
    "",
    `Status: ${report.status}`,
    `ZIP: ${report.zipPath}`,
    `Output root: ${report.outputRoot}`,
    "",
    "## Checks",
    "",
    ...checks,
    "",
    "## Required artifacts",
    "",
    ...report.requiredArtifacts.map((item) => `- ${item.path}: ${item.present ? "present" : "missing"}`)
  ].join("\n");
}

function payload() {
  return {
    generationId: "phase3-smoke",
    profile: {
      profile: "flutter",
      projectName: "Phase Three",
      appDisplayName: "Phase Three",
      generationMode: "hybrid",
      includeLLMNotes: true
    },
    spec: {
      version: "1.0",
      profileId: "flutter",
      generationMode: "hybrid",
      appDisplayName: "Phase Three",
      projectName: "Phase Three",
      naming: {
        projectSlug: "phase-three",
        projectPascal: "PhaseThree",
        packageId: "com.example.phasethree",
        rootDirectoryName: "phase-three"
      },
      architecture: {
        style: "feature-first",
        entryPoint: "lib/main.dart",
        stateManagement: "provider",
        navigationStyle: "router",
        environmentMode: "single"
      },
      features: {
        auth: false,
        analytics: false,
        localization: false,
        push: false,
        networking: true,
        persistence: true,
        exampleScreen: true,
        llmNotes: true
      },
      modules: [{ featureId: "navigation", enabled: true, supported: true, required: true, source: "mandatory", artifactIds: [], notes: [] }],
      dependencyPlan: { requiredFeatures: [], optionalFeatures: [], relationships: [], warnings: [] },
      explanation: "Smoke profile for generated ZIP inspection."
    },
    manifest: {
      version: "1.0",
      profileId: "flutter",
      generationMode: "hybrid",
      rootFolderName: "phase-three",
      artifacts: [
        {
          id: "meta.advisor",
          title: "Architecture advisor report",
          reason: "Advisor smoke test",
          required: false,
          category: "metadata",
          source: "advisor"
        }
      ],
      summary: { totalArtifacts: 1, requiredArtifacts: 0, featureArtifacts: 0 },
      notes: []
    },
    validation: { status: "passed", issues: [], metrics: { missingRequiredArtifacts: 0, unsupportedEnabledFeatures: 0, duplicateArtifacts: 0 } },
    architectureSynthesis: {
      provider: "deterministic",
      mode: "hybrid",
      usedAi: false,
      status: "fallback",
      warnings: ["Smoke payload uses deterministic synthesis."],
      assumptions: [],
      risks: [],
      recommendations: []
    },
    advisorReport: {
      version: "1.0",
      schemaVersion: "1.0",
      advisorVersion: "phase3",
      status: "fallback",
      provider: "deterministic",
      mode: "deterministic-fallback",
      summary: "Smoke-test architecture plan.",
      architecture: {
        style: "feature-first",
        rationale: "Keep generated modules separated and easy to replace.",
        platforms: ["flutter"]
      },
      modules: [{ id: "navigation", enabled: true, required: true, artifactIds: [] }],
      assumptions: ["Smoke payload uses deterministic advisor output."],
      decisions: [
        {
          id: "smoke-decision",
          title: "Smoke decision",
          recommendation: "Keep generated modules separated.",
          rationale: "The starter project remains easier to extend.",
          impact: "medium",
          files: ["meta.advisor"]
        }
      ],
      recommendations: ["Review generated advisor docs before extending templates."],
      nextSteps: ["Add project-specific screens"],
      risks: [],
      warnings: [],
      llm: {
        enabled: false,
        used: false,
        status: "disabled",
        provider: "deterministic",
        warnings: []
      },
      createdAt: "2026-04-28T00:00:00.000Z"
    },
    templateContext: {
      advisor_json: JSON.stringify({ smoke: true, schemaVersion: "1.0", advisorVersion: "phase3" }, null, 2),
      advisor_markdown: "# Architecture Decisions\n\n## Overview\n\nSmoke-test architecture plan.\n\n## Next Steps\n\n- Add project-specific screens\n"
    },
    outputDir,
    zipPath
  };
}

function run() {
  resolvePython();
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(diagnosticsDir, { recursive: true });
  const smokePayload = payload();
  writeJson(payloadPath, smokePayload);

  const generator = spawnSync(pythonBin, [generatorPath], {
    cwd: root,
    input: JSON.stringify(smokePayload),
    encoding: "utf8"
  });

  const outputRoot = path.join(outputDir, "phase-three");
  const zipEntries = fs.existsSync(zipPath) ? inspectZip(zipPath) : [];
  const requiredArtifacts = requiredRelativePaths.map((relativePath) => {
    const outputFile = path.join(outputRoot, relativePath);
    const zipEntry = `phase-three/${relativePath}`.replace(/\\/g, "/");
    return {
      path: relativePath,
      outputFile,
      outputPresent: fs.existsSync(outputFile),
      zipPresent: zipEntries.includes(zipEntry),
      present: fs.existsSync(outputFile) && zipEntries.includes(zipEntry)
    };
  });

  const advisorPath = path.join(outputRoot, ".mag", "architecture-advisor.json");
  const synthesisPath = path.join(outputRoot, ".mag", "architecture-synthesis.json");
  const decisionsPath = path.join(outputRoot, "docs", "architecture-decisions.md");
  const advisor = fs.existsSync(advisorPath) ? JSON.parse(fs.readFileSync(advisorPath, "utf8")) : null;
  const synthesis = fs.existsSync(synthesisPath) ? JSON.parse(fs.readFileSync(synthesisPath, "utf8")) : null;
  const markdownText = fs.existsSync(decisionsPath) ? fs.readFileSync(decisionsPath, "utf8") : "";

  const checks = [
    { id: "generator.exit-code", status: generator.status === 0 ? "passed" : "failed", message: `Generator exited with code ${generator.status}.` },
    { id: "zip.exists", status: fs.existsSync(zipPath) ? "passed" : "failed", message: "Generated ZIP exists." },
    { id: "zip.not-empty", status: fs.existsSync(zipPath) && fs.statSync(zipPath).size > 0 ? "passed" : "failed", message: "Generated ZIP is not empty." },
    { id: "advisor-json.present", status: requiredArtifacts[0].present ? "passed" : "failed", message: ".mag/architecture-advisor.json exists in output and ZIP." },
    { id: "synthesis-json.present", status: requiredArtifacts[1].present ? "passed" : "failed", message: ".mag/architecture-synthesis.json exists in output and ZIP." },
    { id: "decisions-md.present", status: requiredArtifacts[2].present ? "passed" : "failed", message: "docs/architecture-decisions.md exists in output and ZIP." },
    { id: "advisor-json.parseable", status: advisor && advisor.schemaVersion === "1.0" ? "passed" : "failed", message: "Advisor JSON is parseable and carries schemaVersion." },
    { id: "synthesis-json.parseable", status: synthesis && synthesis.mode === "hybrid" ? "passed" : "failed", message: "Architecture synthesis JSON is parseable and carries mode metadata." },
    { id: "decisions-md.meaningful", status: markdownText.length > 80 && markdownText.includes("Architecture Decisions") ? "passed" : "failed", message: "Advisor markdown has meaningful content." }
  ];
  const failed = checks.filter((item) => item.status === "failed");
  const report = {
    status: failed.length === 0 ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    workDir,
    outputRoot,
    zipPath,
    zipSize: fs.existsSync(zipPath) ? fs.statSync(zipPath).size : 0,
    requiredArtifacts,
    zipEntries,
    advisorSummary: advisor?.summary,
    checks,
    generator: {
      status: generator.status,
      error: generator.error ? generator.error.message : undefined,
      stdout: generator.stdout,
      stderr: generator.stderr
    }
  };

  writeJson(path.join(diagnosticsDir, "generated-zip-inspection.json"), report);
  writeText(path.join(diagnosticsDir, "generated-zip-inspection.md"), `${markdown(report)}\n`);
  writeText(path.join(diagnosticsDir, "advisor-smoke.log"), [
    `$ ${pythonBin} ${generatorPath}`,
    generator.stdout,
    generator.stderr,
    `status=${generator.status}`,
    `inspection=${report.status}`
  ].filter(Boolean).join("\n"));

  if (failed.length > 0) {
    console.error(markdown(report));
    process.exit(1);
  }

  console.log(markdown(report));
}

try {
  run();
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
