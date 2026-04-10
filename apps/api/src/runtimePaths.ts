import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

export const apiPackageRoot = path.resolve(currentDir, "..");
export const repoRoot = path.resolve(apiPackageRoot, "../..");
