import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  buildArtifactManifest,
  buildArchitectureSpec,
  validateArtifactManifest,
  type ArchitectureSpec,
  type ArtifactManifest,
  type GenerationPlan,
  type NormalizedProfile,
  type QuestionnaireAnswers,
  type TreeNode,
  type ValidationReport
} from "@mag/shared";
import { env } from "../env.js";
import { generationOutputPath, repoRoot, zipOutputPath } from "../runtimePaths.js";
import { buildFileTreePreview } from "./preview.js";
import { buildTemplateVariables } from "./templateVariables.js";

export interface GeneratorExecutionInput {
  generationId: string;
  profile: NormalizedProfile;
  spec: ArchitectureSpec;
  manifest: ArtifactManifest;
  plan: GenerationPlan;
  validation: ValidationReport;
  outputDir: string;
  zipPath: string;
}

export interface GeneratorExecutionResult {
  success: boolean;
  zipPath?: string;
  error?: string;
  logFilePath: string;
  diagnosticsPath: string;
}

function safeWriteJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildFailureDiagnostics(input: GeneratorExecutionInput, error: string): Record<string, unknown> {
  return {
    status: "failed",
    generationId: input.generationId,
    error,
    paths: {
      outputDir: input.outputDir,
      zipPath: input.zipPath
    },
    profile: input.profile,
    spec: input.spec,
    manifestSummary: input.manifest.summary,
    validation: input.validation,
    createdAt: new Date().toISOString()
  };
}

class GeneratorRunner {
  async run(input: GeneratorExecutionInput): Promise<GeneratorExecutionResult> {
    fs.mkdirSync(input.outputDir, { recursive: true });
    fs.mkdirSync(path.dirname(input.zipPath), { recursive: true });

    const logFilePath = path.join(input.outputDir, "generator.log");
    const diagnosticsPath = path.join(input.outputDir, input.manifest.rootFolderName, ".mag", "generation-diagnostics.json");
    const generatorScriptPath = path.resolve(repoRoot, "services", "generator-python", "generator_cli.py");
    const templateContext = buildTemplateVariables(input.profile, input.spec, input.manifest);

    safeWriteJson(path.join(input.outputDir, ".mag", "api-payload-preview.json"), {
      generationId: input.generationId,
      profile: input.profile,
      spec: input.spec,
      manifest: input.manifest,
      plan: input.plan,
      validation: input.validation,
      templateContext,
      outputDir: input.outputDir,
      zipPath: input.zipPath
    });

    const payload = JSON.stringify({
      generationId: input.generationId,
      profile: input.profile,
      spec: input.spec,
      manifest: input.manifest,
      plan: input.plan,
      validation: input.validation,
      templateContext,
      outputDir: input.outputDir,
      zipPath: input.zipPath
    });

    return await new Promise<GeneratorExecutionResult>((resolve) => {
      const pythonBin = process.env.GENERATOR_PYTHON_BIN ?? process.env.PYTHON_BIN ?? "python3";
      const child = spawn(pythonBin, [generatorScriptPath], {
        cwd: repoRoot,
        env: {
          ...process.env,
          PYTHONNOUSERSITE: "1",
          PYTHONDONTWRITEBYTECODE: "1",
          OPENAI_API_KEY: env.OPENAI_API_KEY,
          OPENAI_MODEL: env.OPENAI_MODEL,
          ENABLE_LLM_ENRICHMENT: env.ENABLE_LLM_ENRICHMENT ? "true" : "false"
        },
        stdio: ["pipe", "pipe", "pipe"]
      });

      let settled = false;
      let stdout = "";
      let stderr = "";
      const timeoutMs = Number(process.env.GENERATOR_TIMEOUT_MS ?? 120_000);
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }
        const error = `Generator timed out after ${timeoutMs}ms`;
        child.kill("SIGTERM");
        fs.writeFileSync(logFilePath, [stdout, stderr, error].filter(Boolean).join("\n"), "utf8");
        safeWriteJson(diagnosticsPath, buildFailureDiagnostics(input, error));
        settled = true;
        resolve({ success: false, error, logFilePath, diagnosticsPath });
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        if (settled) {
          return;
        }
        clearTimeout(timeout);
        fs.writeFileSync(logFilePath, `Failed to spawn generator: ${error.message}\n`, "utf8");
        safeWriteJson(diagnosticsPath, buildFailureDiagnostics(input, error.message));
        settled = true;
        resolve({ success: false, error: error.message, logFilePath, diagnosticsPath });
      });

      child.on("close", (code) => {
        if (settled) {
          return;
        }
        clearTimeout(timeout);
        const combinedOutput = [stdout, stderr].filter(Boolean).join("\n");
        fs.writeFileSync(logFilePath, combinedOutput || "Generator completed with no output.\n", "utf8");

        if (code === 0 && fs.existsSync(input.zipPath)) {
          settled = true;
          resolve({ success: true, zipPath: input.zipPath, logFilePath, diagnosticsPath });
          return;
        }

        const errorMessage = stderr.trim() || stdout.trim() || `Generator exited with code ${code ?? -1}`;
        safeWriteJson(diagnosticsPath, buildFailureDiagnostics(input, errorMessage));
        settled = true;
        resolve({ success: false, error: errorMessage, logFilePath, diagnosticsPath });
      });

      child.stdin.write(payload);
      child.stdin.end();
    });
  }
}

export const generatorRunner = new GeneratorRunner();

function profileToAnswers(profile: NormalizedProfile): QuestionnaireAnswers {
  return {
    profile: profile.profile,
    generationMode: profile.generationMode,
    projectName: profile.projectName,
    appDisplayName: profile.appDisplayName,
    packageId: profile.packageId,
    architectureStyle: profile.architectureStyle,
    stateManagement: profile.stateManagement,
    navigationStyle: profile.navigationStyle,
    environmentMode: profile.environmentMode,
    hasAuth: profile.features.auth,
    hasAnalytics: profile.features.analytics,
    hasLocalization: profile.features.localization,
    hasPush: profile.features.push,
    hasNetworking: profile.features.networking,
    hasPersistence: profile.features.persistence,
    includeExampleScreen: true,
    includeLLMNotes: profile.generationMode !== "baseline"
  };
}

export async function runGenerator(
  profile: NormalizedProfile,
  plan: GenerationPlan,
  generationId: string
): Promise<{
  zipPath: string;
  outputDir: string;
  fileTree: TreeNode[];
  manifest: ArtifactManifest;
  validation: ValidationReport;
  spec: ArchitectureSpec;
}> {
  const spec = buildArchitectureSpec(profileToAnswers(profile));
  const manifest = buildArtifactManifest(spec);
  const validation = validateArtifactManifest(spec, manifest);
  const outputDir = generationOutputPath(env.OUTPUT_ROOT, generationId);
  const zipPath = zipOutputPath(env.OUTPUT_ROOT, generationId);

  const execution = await generatorRunner.run({
    generationId,
    profile,
    spec,
    manifest,
    plan,
    validation,
    outputDir,
    zipPath
  });

  if (!execution.success || !execution.zipPath) {
    throw new Error(execution.error ?? "Generator failed");
  }

  const fileTree = buildFileTreePreview(manifest, buildTemplateVariables(profile, spec, manifest));

  return {
    zipPath: execution.zipPath,
    outputDir,
    fileTree,
    manifest,
    validation,
    spec
  };
}
