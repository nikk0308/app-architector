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
  ".mag/file-relationships.json",
  ".mag/generation-mode-hybrid.json",
  ".mag/hybrid-refinement.json",
  ".mag/platform-pack.json",
  "lib/generation_mode/hybrid_mode_boundary.dart",
  "lib/product/monetization/monetization_manager.dart",
  "lib/product/offline/offline_data_coordinator.dart",
  "docs/next-steps.md",
  "docs/platform-pack.md",
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
      product: {
        distributionStores: ["google-play"],
        monetization: ["subscription"],
        offlineData: ["sync-queue"],
        runtimeQuality: ["logging"],
        delivery: ["release-checklist"]
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
        },
        {
          id: "docs.platform-pack",
          title: "Platform pack guide",
          reason: "Platform pack smoke test",
          required: true,
          category: "metadata",
          source: "baseline"
        },
        {
          id: "mode.hybrid",
          title: "Hybrid generation mode boundary",
          reason: "Mode boundary smoke test",
          required: true,
          category: "profile",
          source: "advisor"
        },
        {
          id: "meta.relationships",
          title: "File relationships map",
          reason: "Relationship smoke test",
          required: true,
          category: "metadata",
          source: "baseline"
        },
        {
          id: "monetization.subscription",
          title: "Subscription monetization boundary",
          reason: "Product module smoke test",
          required: false,
          category: "feature",
          source: "baseline"
        },
        {
          id: "offline.sync-queue",
          title: "Sync queue boundary",
          reason: "Offline module smoke test",
          required: false,
          category: "feature",
          source: "baseline"
        }
      ],
      summary: { totalArtifacts: 6, requiredArtifacts: 3, featureArtifacts: 2 },
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
    hybridRefinement: {
      schemaVersion: "1.0",
      enabled: true,
      mode: "hybrid",
      provider: "openai",
      model: "smoke-provider",
      status: "applied",
      acceptedPatches: [
        {
          path: "docs/next-steps.md",
          kind: "documentation",
          operation: "replace-file",
          content: "# Next Steps\n\n- Replace smoke endpoints with product APIs.\n- Confirm storage and auth boundaries before production wiring.\n",
          rationale: "Smoke verifies that allowlisted hybrid documentation patches are materialized."
        }
      ],
      rejectedPatches: [],
      warnings: []
    },
    templateContext: {
      advisor_json: JSON.stringify({ smoke: true, schemaVersion: "1.0", advisorVersion: "phase3" }, null, 2),
      advisor_markdown: "# Architecture Decisions\n\n## Overview\n\nSmoke-test architecture plan.\n\n## Next Steps\n\n- Add project-specific screens\n",
      project_name: "Phase Three",
      profile: "flutter",
      profile_id: "flutter",
      generation_mode: "hybrid",
      mode_display_name: "Hybrid",
      mode_strategy_summary: "Baseline creates the canonical structure, then AI refines approved documentation zones.",
      mode_relationship_summary: "BaselineSpec -> HybridPolicy -> AdvisorDocs -> Deterministic ZIP",
      mode_boundary_pascal: "HybridModeBoundary",
      mode_boundary_camel: "hybridModeBoundary",
      mode_boundary_snake: "hybrid_mode_boundary",
      mode_metadata_file: "generation-mode-hybrid.json",
      architecture_style: "feature-first",
      state_management: "riverpod",
      navigation_style: "router",
      monetization_strategies: "Subscription",
      offline_data_options: "Sync Queue",
      product_readiness_markdown: "## Monetization\n- Subscription\n\n## Offline/Data\n- Sync Queue\n",
      product_readiness_json: JSON.stringify({ monetization: ["subscription"], offlineData: ["sync-queue"] }, null, 2),
      file_relationships_json: JSON.stringify({
        version: "1.0",
        relationships: [
          {
            source: "phase-three/product/monetization/subscription.json",
            target: "phase-three/lib/product/monetization/monetization_manager.dart",
            relation: "configured-by"
          }
        ]
      }, null, 2),
      platform_pack_json: JSON.stringify({ profileId: "flutter", label: "Flutter smoke pack", featureMatrix: { networking: "full" } }, null, 2),
      platform_pack_markdown: "# Flutter smoke pack\n\n## Feature Support Matrix\n\n| Feature | Support |\n| --- | --- |\n| networking | full |\n\n## Quality Gates\n\n- Smoke validates generated platform pack documentation.\n"
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
  const hasRequired = (relativePath) => requiredArtifacts.find((item) => item.path === relativePath)?.present ?? false;

  const advisorPath = path.join(outputRoot, ".mag", "architecture-advisor.json");
  const synthesisPath = path.join(outputRoot, ".mag", "architecture-synthesis.json");
  const hybridPath = path.join(outputRoot, ".mag", "hybrid-refinement.json");
  const platformPackPath = path.join(outputRoot, ".mag", "platform-pack.json");
  const hybridDocPath = path.join(outputRoot, "docs", "next-steps.md");
  const platformPackDocPath = path.join(outputRoot, "docs", "platform-pack.md");
  const decisionsPath = path.join(outputRoot, "docs", "architecture-decisions.md");
  const advisor = fs.existsSync(advisorPath) ? JSON.parse(fs.readFileSync(advisorPath, "utf8")) : null;
  const synthesis = fs.existsSync(synthesisPath) ? JSON.parse(fs.readFileSync(synthesisPath, "utf8")) : null;
  const hybrid = fs.existsSync(hybridPath) ? JSON.parse(fs.readFileSync(hybridPath, "utf8")) : null;
  const platformPack = fs.existsSync(platformPackPath) ? JSON.parse(fs.readFileSync(platformPackPath, "utf8")) : null;
  const hybridDocText = fs.existsSync(hybridDocPath) ? fs.readFileSync(hybridDocPath, "utf8") : "";
  const platformPackDocText = fs.existsSync(platformPackDocPath) ? fs.readFileSync(platformPackDocPath, "utf8") : "";
  const markdownText = fs.existsSync(decisionsPath) ? fs.readFileSync(decisionsPath, "utf8") : "";
  const duplicateZipEntries = zipEntries.filter((entry, index, list) => list.indexOf(entry) !== index);
  const invalidZipEntries = zipEntries.filter((entry) => entry.startsWith("/") || entry.split("/").includes(".."));

  const checks = [
    { id: "generator.exit-code", status: generator.status === 0 ? "passed" : "failed", message: `Generator exited with code ${generator.status}.` },
    { id: "zip.exists", status: fs.existsSync(zipPath) ? "passed" : "failed", message: "Generated ZIP exists." },
    { id: "zip.not-empty", status: fs.existsSync(zipPath) && fs.statSync(zipPath).size > 0 ? "passed" : "failed", message: "Generated ZIP is not empty." },
    { id: "zip.no-duplicate-entries", status: duplicateZipEntries.length === 0 ? "passed" : "failed", message: "Generated ZIP has no duplicate entries." },
    { id: "zip.safe-relative-entries", status: invalidZipEntries.length === 0 ? "passed" : "failed", message: "Generated ZIP entries are safe relative paths." },
    { id: "advisor-json.present", status: hasRequired(".mag/architecture-advisor.json") ? "passed" : "failed", message: ".mag/architecture-advisor.json exists in output and ZIP." },
    { id: "synthesis-json.present", status: hasRequired(".mag/architecture-synthesis.json") ? "passed" : "failed", message: ".mag/architecture-synthesis.json exists in output and ZIP." },
    { id: "relationships-json.present", status: hasRequired(".mag/file-relationships.json") ? "passed" : "failed", message: ".mag/file-relationships.json exists in output and ZIP." },
    { id: "mode-json.present", status: hasRequired(".mag/generation-mode-hybrid.json") ? "passed" : "failed", message: ".mag/generation-mode-hybrid.json exists in output and ZIP." },
    { id: "mode-boundary.present", status: hasRequired("lib/generation_mode/hybrid_mode_boundary.dart") ? "passed" : "failed", message: "Mode-specific source boundary exists in output and ZIP." },
    { id: "monetization-manager.present", status: hasRequired("lib/product/monetization/monetization_manager.dart") ? "passed" : "failed", message: "Monetization module generates a manager script." },
    { id: "offline-coordinator.present", status: hasRequired("lib/product/offline/offline_data_coordinator.dart") ? "passed" : "failed", message: "Offline/data module generates a coordinator script." },
    { id: "hybrid-json.present", status: hasRequired(".mag/hybrid-refinement.json") ? "passed" : "failed", message: ".mag/hybrid-refinement.json exists in output and ZIP." },
    { id: "platform-pack-json.present", status: hasRequired(".mag/platform-pack.json") ? "passed" : "failed", message: ".mag/platform-pack.json exists in output and ZIP." },
    { id: "hybrid-doc.present", status: hasRequired("docs/next-steps.md") ? "passed" : "failed", message: "docs/next-steps.md exists in output and ZIP." },
    { id: "platform-pack-doc.present", status: hasRequired("docs/platform-pack.md") ? "passed" : "failed", message: "docs/platform-pack.md exists in output and ZIP." },
    { id: "decisions-md.present", status: hasRequired("docs/architecture-decisions.md") ? "passed" : "failed", message: "docs/architecture-decisions.md exists in output and ZIP." },
    { id: "advisor-json.parseable", status: advisor && advisor.schemaVersion === "1.0" ? "passed" : "failed", message: "Advisor JSON is parseable and carries schemaVersion." },
    { id: "synthesis-json.parseable", status: synthesis && synthesis.mode === "hybrid" ? "passed" : "failed", message: "Architecture synthesis JSON is parseable and carries mode metadata." },
    { id: "hybrid-json.parseable", status: hybrid && hybrid.status === "applied" && hybrid.acceptedPatches?.length === 1 ? "passed" : "failed", message: "Hybrid refinement JSON is parseable and carries accepted patches." },
    { id: "platform-pack-json.parseable", status: platformPack && platformPack.profileId === "flutter" ? "passed" : "failed", message: "Platform pack JSON is parseable and carries profile metadata." },
    { id: "hybrid-doc.meaningful", status: hybridDocText.length > 80 && hybridDocText.includes("Next Steps") ? "passed" : "failed", message: "Hybrid markdown patch has meaningful content." },
    { id: "platform-pack-doc.meaningful", status: platformPackDocText.length > 80 && platformPackDocText.includes("Feature Support Matrix") ? "passed" : "failed", message: "Platform pack guide has meaningful content." },
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
    duplicateZipEntries,
    invalidZipEntries,
    advisorSummary: advisor?.summary,
    hybridStatus: hybrid?.status,
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
