import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
  ArchitectureSpec,
  ArtifactManifest,
  GenerationPlan,
  NormalizedProfile,
  ValidationReport
} from "@mag/shared";
import { env } from "../env.js";

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
    const generatorScriptPath = path.resolve(process.cwd(), "services", "generator-python", "generator_cli.py");

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
        cwd: process.cwd(),
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
