import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../env.js";
import { generationOutputPath, zipOutputPath } from "../runtimePaths.js";

function buildGenerationId(projectSlug: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = crypto.randomBytes(4).toString("hex");
  return `${timestamp}-${projectSlug}-${suffix}`;
}

export function createRunDirectories(projectSlug: string): {
  generationId: string;
  outputDir: string;
  zipPath: string;
} {
  const generationId = buildGenerationId(projectSlug);
  const outputDir = generationOutputPath(env.GENERATED_OUTPUT_DIR, generationId);
  const zipPath = zipOutputPath(env.GENERATED_ZIP_DIR, generationId);

  fs.mkdirSync(path.dirname(outputDir), { recursive: true });
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });

  return {
    generationId,
    outputDir,
    zipPath
  };
}
