import type { ArtifactManifest, GeneratedArtifactKind, TreeNode } from "../types.js";

export const HYBRID_REFINEMENT_KINDS = ["documentation", "source", "config"] as const;
export type HybridRefinementKind = typeof HYBRID_REFINEMENT_KINDS[number];

export const HYBRID_REFINEMENT_PATHS = [
  "README.md",
  "docs/",
  ".env.example"
] as const;

export interface HybridArtifactPatch {
  path: string;
  kind: HybridRefinementKind | GeneratedArtifactKind;
  operation: "replace-section" | "append-section" | "annotate";
  content: string;
  rationale: string;
}

export interface HybridRefinementPolicy {
  allowFileCreation: false;
  allowRequiredArtifactRemoval: false;
  allowRootStructureChanges: false;
  allowProfileChanges: false;
  allowedPathPrefixes: readonly string[];
  allowedOperations: HybridArtifactPatch["operation"][];
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

export const DEFAULT_HYBRID_REFINEMENT_POLICY: HybridRefinementPolicy = {
  allowFileCreation: false,
  allowRequiredArtifactRemoval: false,
  allowRootStructureChanges: false,
  allowProfileChanges: false,
  allowedPathPrefixes: HYBRID_REFINEMENT_PATHS,
  allowedOperations: ["replace-section", "append-section", "annotate"]
};
