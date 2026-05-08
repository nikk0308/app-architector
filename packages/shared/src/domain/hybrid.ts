import type { AdvisorProvider, ArtifactManifest, GenerationMode, TreeNode } from "../types.js";

export const HYBRID_REFINEMENT_SCHEMA_VERSION = "1.0" as const;

export const HYBRID_REFINEMENT_KINDS = ["documentation"] as const;
export type HybridRefinementKind = typeof HYBRID_REFINEMENT_KINDS[number];

export const HYBRID_REFINEMENT_PATHS = [
  "README.md",
  "docs/architecture-decisions.md",
  "docs/next-steps.md",
  "docs/testing-strategy.md",
  "docs/deployment-notes.md"
] as const;

export const HYBRID_REFINEMENT_BLOCKED_PATTERNS = [
  "api_key",
  "apikey",
  "authorization:",
  "bearer ",
  "client_secret",
  "deploy_ssh_private_key",
  "hf_token",
  "openai_api_key",
  "private key",
  "secret=",
  "token="
] as const;

export interface HybridArtifactPatch {
  path: string;
  kind: HybridRefinementKind;
  operation: "replace-file" | "append-section";
  content: string;
  rationale: string;
}

export interface HybridRefinementPolicy {
  allowFileCreation: boolean;
  allowRequiredArtifactRemoval: false;
  allowRootStructureChanges: false;
  allowProfileChanges: false;
  allowedPathPrefixes: readonly string[];
  allowedOperations: HybridArtifactPatch["operation"][];
  maxPatchCount: number;
  maxContentLength: number;
}

export interface HybridRefinementInput {
  manifest: ArtifactManifest;
  fileTree: TreeNode[];
  patches: HybridArtifactPatch[];
}

export interface HybridPolicyValidationResult {
  accepted: HybridArtifactPatch[];
  rejected: Array<{
    patch: HybridArtifactPatch;
    reason: string;
  }>;
}

export interface HybridRefinementReport {
  schemaVersion: typeof HYBRID_REFINEMENT_SCHEMA_VERSION;
  enabled: boolean;
  mode: GenerationMode;
  provider: AdvisorProvider;
  model?: string;
  status: "disabled" | "applied" | "partial" | "fallback" | "rejected";
  acceptedPatches: HybridArtifactPatch[];
  rejectedPatches: HybridPolicyValidationResult["rejected"];
  warnings: string[];
}

export const DEFAULT_HYBRID_REFINEMENT_POLICY: HybridRefinementPolicy = {
  allowFileCreation: true,
  allowRequiredArtifactRemoval: false,
  allowRootStructureChanges: false,
  allowProfileChanges: false,
  allowedPathPrefixes: HYBRID_REFINEMENT_PATHS,
  allowedOperations: ["replace-file", "append-section"],
  maxPatchCount: 4,
  maxContentLength: 6000
};

function normalizePatchPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
}

function hasPathTraversal(path: string): boolean {
  return path.split("/").some((segment) => segment === "..");
}

function isAllowedPath(path: string, policy: HybridRefinementPolicy): boolean {
  return policy.allowedPathPrefixes.some((allowedPath) => path === allowedPath || path.startsWith(`${allowedPath.replace(/\/$/, "")}/`));
}

function fileExists(path: string, fileTree: TreeNode[]): boolean {
  return fileTree.some((node) => node.type === "file" && normalizePatchPath(node.path).endsWith(path));
}

function containsSensitiveValue(content: string): boolean {
  const normalized = content.toLowerCase();
  return HYBRID_REFINEMENT_BLOCKED_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function reject(patch: HybridArtifactPatch, reason: string): HybridPolicyValidationResult["rejected"][number] {
  return { patch, reason };
}

export function validateHybridRefinementPatches(
  input: HybridRefinementInput,
  policy: HybridRefinementPolicy = DEFAULT_HYBRID_REFINEMENT_POLICY
): HybridPolicyValidationResult {
  const accepted: HybridArtifactPatch[] = [];
  const rejected: HybridPolicyValidationResult["rejected"] = [];
  const seenPaths = new Set<string>();
  const patches = input.patches.slice(0, Math.max(policy.maxPatchCount, 0));

  if (input.patches.length > policy.maxPatchCount) {
    for (const patch of input.patches.slice(policy.maxPatchCount)) {
      rejected.push(reject(patch, `Patch limit exceeded; max ${policy.maxPatchCount} patches are allowed.`));
    }
  }

  for (const patch of patches) {
    const normalizedPath = normalizePatchPath(patch.path);
    const normalizedPatch: HybridArtifactPatch = {
      ...patch,
      path: normalizedPath,
      kind: "documentation"
    };

    if (!normalizedPath) {
      rejected.push(reject(normalizedPatch, "Patch path is empty."));
      continue;
    }
    if (normalizedPath.startsWith("/") || hasPathTraversal(normalizedPath)) {
      rejected.push(reject(normalizedPatch, "Patch path must stay inside the generated project root."));
      continue;
    }
    if (normalizedPath.startsWith("architecture/")) {
      rejected.push(reject(normalizedPatch, "Hybrid refinement cannot modify architecture graph contracts."));
      continue;
    }
    if (!normalizedPath.endsWith(".md")) {
      rejected.push(reject(normalizedPatch, "Hybrid refinement v1 only accepts Markdown documentation patches."));
      continue;
    }
    if (!isAllowedPath(normalizedPath, policy)) {
      rejected.push(reject(normalizedPatch, "Patch path is outside the hybrid allowlist."));
      continue;
    }
    if (!policy.allowedOperations.includes(normalizedPatch.operation)) {
      rejected.push(reject(normalizedPatch, "Patch operation is not allowed by the hybrid policy."));
      continue;
    }
    if (!policy.allowFileCreation && !fileExists(normalizedPath, input.fileTree)) {
      rejected.push(reject(normalizedPatch, "Patch would create a new file, but file creation is disabled."));
      continue;
    }
    if (!normalizedPatch.content.trim()) {
      rejected.push(reject(normalizedPatch, "Patch content is empty."));
      continue;
    }
    if (normalizedPatch.content.length > policy.maxContentLength) {
      rejected.push(reject(normalizedPatch, `Patch content exceeds ${policy.maxContentLength} characters.`));
      continue;
    }
    if (containsSensitiveValue(normalizedPatch.content)) {
      rejected.push(reject(normalizedPatch, "Patch content looks like it contains a secret or credential."));
      continue;
    }
    if (seenPaths.has(`${normalizedPath}:${normalizedPatch.operation}`)) {
      rejected.push(reject(normalizedPatch, "Duplicate patch target and operation."));
      continue;
    }

    seenPaths.add(`${normalizedPath}:${normalizedPatch.operation}`);
    accepted.push(normalizedPatch);
  }

  return { accepted, rejected };
}
