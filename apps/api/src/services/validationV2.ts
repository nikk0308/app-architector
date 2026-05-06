import fs from "node:fs";
import path from "node:path";
import {
  mergeValidationV2Reports,
  validateGeneratedOutputStructure,
  validateRegistryTemplateDrift,
  type ArchitectureSynthesisSummary,
  type ArtifactManifest,
  type HybridRefinementReport,
  type TreeNode,
  type ValidationV2Report
} from "@mag/shared";
import { env } from "../env.js";
import { repoRoot } from "../runtimePaths.js";

interface RegistryOutput {
  path?: string;
  template?: string;
}

interface RegistryEntry {
  id?: string;
  outputs?: Record<string, RegistryOutput[]>;
}

export interface ValidationV2Bundle {
  preMaterialization: ValidationV2Report;
  postMaterialization?: ValidationV2Report;
}

function loadRegistry(): RegistryEntry[] {
  try {
    const raw = fs.readFileSync(env.REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as RegistryEntry[];
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { artifacts?: unknown }).artifacts)) {
      return (parsed as { artifacts: RegistryEntry[] }).artifacts;
    }
  } catch {
    return [];
  }
  return [];
}

function registryOutputsForProfile(entry: RegistryEntry, profileId: string): RegistryOutput[] {
  const outputs = entry.outputs ?? {};
  return outputs[profileId] ?? outputs.default ?? [];
}

function missingTemplateArtifactIds(manifest: ArtifactManifest, registry: RegistryEntry[]): string[] {
  const entries = new Map(registry.filter((entry) => entry.id).map((entry) => [entry.id, entry]));
  const missing = new Set<string>();

  for (const artifact of manifest.artifacts) {
    const entry = entries.get(artifact.id);
    if (!entry) {
      continue;
    }
    for (const output of registryOutputsForProfile(entry, manifest.profileId)) {
      if (!output.template) {
        continue;
      }
      const templatePath = path.resolve(repoRoot, "services", "generator-python", "templates", output.template);
      if (!fs.existsSync(templatePath)) {
        missing.add(artifact.id);
      }
    }
  }

  return [...missing].sort();
}

export function requiredGeneratedPaths(input: {
  rootFolderName: string;
  manifest: ArtifactManifest;
  architectureSynthesis?: ArchitectureSynthesisSummary;
  hybridRefinement?: HybridRefinementReport;
}): string[] {
  const root = input.rootFolderName;
  const required = new Set([
    `${root}/README.md`,
    `${root}/.mag/artifact-manifest.json`,
    `${root}/.mag/validation-report.json`
  ]);

  if (input.manifest.artifacts.some((artifact) => artifact.id === "meta.advisor")) {
    required.add(`${root}/.mag/architecture-advisor.json`);
    required.add(`${root}/docs/architecture-decisions.md`);
  }

  if (input.architectureSynthesis && (input.architectureSynthesis.mode !== "baseline" || input.architectureSynthesis.usedAi)) {
    required.add(`${root}/.mag/architecture-synthesis.json`);
  }

  if (input.hybridRefinement) {
    required.add(`${root}/.mag/hybrid-refinement.json`);
    for (const patch of input.hybridRefinement.acceptedPatches) {
      required.add(`${root}/${patch.path}`);
    }
  }

  return [...required].sort();
}

export function buildPreMaterializationValidation(input: {
  manifest: ArtifactManifest;
  fileTree: TreeNode[];
  architectureSynthesis?: ArchitectureSynthesisSummary;
  hybridRefinement?: HybridRefinementReport;
}): ValidationV2Report {
  const registry = loadRegistry();
  const registryIds = registry.map((entry) => entry.id).filter((id): id is string => Boolean(id));
  const driftReport = validateRegistryTemplateDrift({
    manifest: input.manifest,
    registryArtifactIds: registryIds,
    missingTemplateIds: missingTemplateArtifactIds(input.manifest, registry)
  });
  const outputReport = validateGeneratedOutputStructure({
    stage: "pre-materialization",
    rootFolderName: input.manifest.rootFolderName,
    fileTree: input.fileTree,
    requiredPaths: requiredGeneratedPaths({
      rootFolderName: input.manifest.rootFolderName,
      manifest: input.manifest,
      architectureSynthesis: input.architectureSynthesis,
      hybridRefinement: input.hybridRefinement
    })
  });

  return mergeValidationV2Reports("pre-materialization", [driftReport, outputReport]);
}

function collectOutputFileTree(outputRoot: string, rootFolderName: string): TreeNode[] {
  const root = path.join(outputRoot, rootFolderName);
  const nodes: TreeNode[] = [];
  if (!fs.existsSync(root)) {
    return nodes;
  }

  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }
    const stat = fs.statSync(current);
    const relative = path.relative(outputRoot, current).replace(/\\/g, "/");
    if (relative) {
      nodes.push({ path: relative, type: stat.isDirectory() ? "directory" : "file" });
    }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        pending.push(path.join(current, entry));
      }
    }
  }

  return nodes.sort((a, b) => a.path.localeCompare(b.path));
}

export function readZipEntries(zipPath: string): string[] {
  if (!fs.existsSync(zipPath)) {
    return [];
  }
  const buffer = fs.readFileSync(zipPath);
  const eocdSignature = 0x06054b50;
  const centralDirectorySignature = 0x02014b50;
  let eocdOffset = -1;

  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === eocdSignature) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) {
    return [];
  }

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: string[] = [];
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset + 46 <= end && buffer.readUInt32LE(offset) === centralDirectorySignature) {
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    entries.push(buffer.subarray(fileNameStart, fileNameEnd).toString("utf8").replace(/\\/g, "/"));
    offset = fileNameEnd + extraLength + commentLength;
  }

  return entries.sort();
}

export function buildPostMaterializationValidation(input: {
  outputDir: string;
  zipPath: string;
  manifest: ArtifactManifest;
  architectureSynthesis?: ArchitectureSynthesisSummary;
  hybridRefinement?: HybridRefinementReport;
}): ValidationV2Report {
  const fileTree = collectOutputFileTree(input.outputDir, input.manifest.rootFolderName);
  const zipEntries = readZipEntries(input.zipPath);
  const zipSizeBytes = fs.existsSync(input.zipPath) ? fs.statSync(input.zipPath).size : 0;

  return validateGeneratedOutputStructure({
    stage: "post-materialization",
    rootFolderName: input.manifest.rootFolderName,
    fileTree,
    requiredPaths: requiredGeneratedPaths({
      rootFolderName: input.manifest.rootFolderName,
      manifest: input.manifest,
      architectureSynthesis: input.architectureSynthesis,
      hybridRefinement: input.hybridRefinement
    }),
    zipEntries,
    zipSizeBytes
  });
}
