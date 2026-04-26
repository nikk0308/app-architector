import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

export const apiRoot = path.resolve(currentDir, "..");
export const repoRoot = path.resolve(apiRoot, "..", "..");
export const storageRoot = path.resolve(repoRoot, "storage");

export function generationOutputPath(outputRoot: string, generationId: string): string {
  return path.resolve(outputRoot, generationId);
}

export function zipOutputPath(outputRoot: string, generationId: string): string {
  return path.resolve(outputRoot, `${generationId}.zip`);
}
