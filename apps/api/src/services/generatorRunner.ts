import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { GenerationPlan, NormalizedProfile, TreeNode } from "@mag/shared";
import { env } from "../env.js";
import { buildTemplateContext } from "./preview.js";

export interface GeneratorResponse {
  outputDir: string;
  zipPath: string;
  fileTree: TreeNode[];
  fileCount: number;
}

export async function runGenerator(profile: NormalizedProfile, plan: GenerationPlan, generationId: string): Promise<GeneratorResponse> {
  fs.mkdirSync(path.resolve(process.cwd(), env.OUTPUT_ROOT), { recursive: true });

  const payload = {
    generationId,
    profile,
    plan,
    templateContext: buildTemplateContext(profile),
    outputRoot: path.resolve(process.cwd(), env.OUTPUT_ROOT),
    registryPath: env.REGISTRY_PATH,
    templateRoot: env.TEMPLATE_ROOT
  };

  return new Promise((resolve, reject) => {
    const child = spawn(env.PYTHON_BIN, [env.GENERATOR_SCRIPT], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Generator failed with code ${code}: ${stderr || stdout}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as GeneratorResponse);
      } catch (error) {
        reject(new Error(`Cannot parse generator output: ${String(error)} :: ${stdout}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
