import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { GeneratedArtifactSummary, RunArtifactRecord } from "@mag/shared";

const REQUIRED_OUTPUT_SUFFIXES = [
  "README.md",
  "docs/architecture-decisions.md",
  "architecture/file-relationships.graph.json"
] as const;

function stripRoot(pathValue: string, rootFolderName: string): string {
  const normalized = pathValue.replace(/\\/g, "/");
  const prefix = `${rootFolderName}/`;
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

function hashFile(filePath: string): string | undefined {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return undefined;
  }
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function requiredForPath(relativePath: string): boolean {
  return REQUIRED_OUTPUT_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));
}

export function buildRunArtifactRecords(input: {
  runId: string;
  rootFolderName: string;
  outputDir: string;
  artifacts: GeneratedArtifactSummary[];
}): RunArtifactRecord[] {
  const outputRoot = path.join(input.outputDir, input.rootFolderName);
  return input.artifacts.map((artifact) => {
    const relativePath = stripRoot(artifact.path, input.rootFolderName);
    const absolutePath = path.join(outputRoot, relativePath);
    const exists = fs.existsSync(absolutePath);
    const stat = exists ? fs.statSync(absolutePath) : undefined;

    return {
      runId: input.runId,
      path: artifact.path,
      kind: artifact.kind,
      required: requiredForPath(relativePath),
      generated: Boolean(exists && stat?.isFile()),
      sizeBytes: stat?.isFile() ? stat.size : undefined,
      hash: hashFile(absolutePath),
      description: artifact.description
    };
  });
}
