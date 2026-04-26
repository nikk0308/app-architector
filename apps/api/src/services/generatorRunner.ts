import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildArtifactManifest, buildArchitectureSpec, validateArtifactManifest, type ArchitectureSpec, type ArtifactManifest, type GenerationPlan, type NormalizedProfile, type QuestionnaireAnswers, type ValidationReport } from "@mag/shared";
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
}

function buildTemplateContext(profile: NormalizedProfile, spec: ArchitectureSpec) {
  return {
    projectName: profile.projectName,
    appDisplayName: profile.appDisplayName,
    projectSlug: profile.projectSlug,
    projectPascal: profile.projectPascal,
    project_slug: profile.projectSlug,
    project_pascal: profile.projectPascal,
    app_display_name: profile.appDisplayName,
    package_id: profile.packageId,
    packageId: profile.packageId,
    profile: profile.profile,
    generationMode: profile.generationMode,
    architectureStyle: profile.architectureStyle,
    stateManagement: profile.stateManagement,
    navigationStyle: profile.navigationStyle,
    environmentMode: profile.environmentMode,
    entryPoint: profile.entryPoint,
    explanation: profile.explanation,
    profileNotes: spec.dependencyPlan.warnings,
    features: {
      auth: profile.features.auth,
      analytics: profile.features.analytics,
      localization: profile.features.localization,
      push: profile.features.push,
      networking: profile.features.networking,
      persistence: profile.features.persistence,
      exampleScreen: spec.features.exampleScreen,
      llmNotes: spec.features.llmNotes
    }
  };
}

class GeneratorRunner {
  async run(input: GeneratorExecutionInput): Promise<GeneratorExecutionResult> {
    fs.mkdirSync(input.outputDir, { recursive: true });
    fs.mkdirSync(path.dirname(input.zipPath), { recursive: true });

    const generationRoot = input.outputDir;
    const logFilePath = path.join(generationRoot, "generator.log");
    const generatorScriptPath = path.resolve(repoRoot, "services", "generator-python", "generator_cli.py");

    const payload = JSON.stringify({
      generationId: input.generationId,
      profile: input.profile,
      spec: input.spec,
      manifest: input.manifest,
      plan: input.plan,
      validation: input.validation,
      templateContext: buildTemplateContext(input.profile, input.spec),
      outputDir: input.outputDir,
      zipPath: input.zipPath
    });

    return await new Promise<GeneratorExecutionResult>((resolve) => {
      const child = spawn("python3", [generatorScriptPath], {
        cwd: repoRoot,
        env: {
          ...process.env,
          OPENAI_API_KEY: env.OPENAI_API_KEY,
          OPENAI_MODEL: env.OPENAI_MODEL,
          ENABLE_LLM_ENRICHMENT: env.ENABLE_LLM_ENRICHMENT ? "true" : "false"
        },
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        fs.writeFileSync(logFilePath, `Failed to spawn generator: ${error.message}\n`, "utf8");
        resolve({ success: false, error: error.message, logFilePath });
      });

      child.on("close", (code) => {
        const combinedOutput = [stdout, stderr].filter(Boolean).join("\n");
        fs.writeFileSync(logFilePath, combinedOutput || "Generator completed with no output.\n", "utf8");

        if (code === 0 && fs.existsSync(input.zipPath)) {
          resolve({ success: true, zipPath: input.zipPath, logFilePath });
          return;
        }

        const errorMessage = stderr.trim() || stdout.trim() || `Generator exited with code ${code ?? -1}`;
        resolve({ success: false, error: errorMessage, logFilePath });
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
    hasPersistence: profile.features.persistence
  };
}

export async function runGenerator(
  profile: NormalizedProfile,
  plan: GenerationPlan,
  generationId: string
): Promise<{ zipPath: string; outputDir: string; fileTree: ReturnType<typeof buildFileTreePreview>; manifest: ArtifactManifest; validation: ValidationReport; spec: ArchitectureSpec }> {
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
