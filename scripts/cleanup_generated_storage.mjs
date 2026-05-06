#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const apply = process.argv.includes("--apply");
const retentionDays = Number(process.env.STORAGE_RETENTION_DAYS ?? 14);
const storageRoot = path.resolve(process.env.OUTPUT_ROOT ?? path.join(root, "storage", "generated"));
const allowedRoot = path.resolve(root, "storage");
const cutoff = Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function collectCandidates(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true })
    .map((entry) => path.join(directory, entry.name))
    .filter((entryPath) => {
      const stat = fs.statSync(entryPath);
      return stat.mtimeMs < cutoff;
    });
}

if (!isInside(allowedRoot, storageRoot) && storageRoot !== allowedRoot) {
  throw new Error(`Refusing cleanup outside ${allowedRoot}: ${storageRoot}`);
}

const candidates = [
  ...collectCandidates(path.join(storageRoot, "projects")),
  ...collectCandidates(path.join(storageRoot, "zips"))
].sort();

const report = {
  mode: apply ? "apply" : "dry-run",
  retentionDays,
  storageRoot,
  candidates
};

if (apply) {
  for (const candidate of candidates) {
    fs.rmSync(candidate, { recursive: true, force: true });
  }
}

console.log(JSON.stringify(report, null, 2));
