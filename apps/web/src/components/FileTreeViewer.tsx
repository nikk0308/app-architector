import type { CSSProperties } from "react";
import type { GeneratedArtifactSummary, TreeNode } from "@mag/shared";

interface FileTreeViewerProps {
  nodes: TreeNode[];
  artifacts?: GeneratedArtifactSummary[];
  labels: {
    title: string;
    copy: string;
    copied: string;
    files: string;
    folders: string;
    docs: string;
    metadata: string;
    empty: string;
  };
}

function cleanPath(path: string): string {
  return path.replace(/\/$/, "");
}

function fileName(path: string): string {
  const cleaned = cleanPath(path);
  const parts = cleaned.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : cleaned;
}

function depth(path: string): number {
  return Math.max(0, cleanPath(path).split("/").filter(Boolean).length - 1);
}

function iconFor(node: TreeNode): string {
  if (node.type === "directory") {
    return "▸";
  }
  const lower = node.path.toLowerCase();
  if (lower.includes("/.mag/")) return "◇";
  if (lower.endsWith(".md")) return "◆";
  if (/\.(ts|tsx|js|jsx|swift|dart|cs)$/i.test(lower)) return "●";
  if (/\.(json|yaml|yml|env|xcconfig|arb)$/i.test(lower)) return "□";
  return "•";
}

function describe(path: string, artifacts?: GeneratedArtifactSummary[]): string | undefined {
  const match = artifacts?.find((artifact) => artifact.path === path);
  if (match?.description) {
    return match.description;
  }
  if (path.endsWith("README.md")) return "Project overview and setup guide.";
  if (path.includes("/.mag/")) return "Generation metadata for audit and validation.";
  if (path.includes("/Services/") || path.includes("/services/")) return "Service boundary skeleton.";
  if (path.includes("/Features/") || path.includes("/features/")) return "Feature-facing starter file.";
  if (path.includes("/Navigation/") || path.includes("/navigation/")) return "Navigation boundary.";
  return undefined;
}

function treeText(nodes: TreeNode[]): string {
  return nodes
    .map((node) => `${"  ".repeat(depth(node.path))}${node.type === "directory" ? "▸" : "-"} ${fileName(node.path)}`)
    .join("\n");
}

export function FileTreeViewer({ nodes, artifacts, labels }: FileTreeViewerProps) {
  const fileCount = nodes.filter((node) => node.type === "file").length;
  const folderCount = nodes.filter((node) => node.type === "directory").length;
  const docsCount = nodes.filter((node) => node.path.toLowerCase().endsWith(".md")).length;
  const metadataCount = nodes.filter((node) => node.path.includes("/.mag/") && node.type === "file").length;

  async function copyTree(): Promise<void> {
    await navigator.clipboard?.writeText(treeText(nodes));
  }

  if (nodes.length === 0) {
    return <div className="empty-state">{labels.empty}</div>;
  }

  return (
    <section className="console-card tree-console">
      <div className="section-head">
        <div>
          <span className="kicker">{labels.title}</span>
          <h2>{nodes[0]?.path.replace(/\/$/, "")}</h2>
        </div>
        <button className="ghost-button" type="button" onClick={() => void copyTree()}>
          {labels.copy}
        </button>
      </div>

      <div className="tree-metrics">
        <span>{labels.files}<strong>{fileCount}</strong></span>
        <span>{labels.folders}<strong>{folderCount}</strong></span>
        <span>{labels.docs}<strong>{docsCount}</strong></span>
        <span>{labels.metadata}<strong>{metadataCount}</strong></span>
      </div>

      <div className="file-tree" role="tree">
        {nodes.map((node) => {
          const note = node.type === "file" ? describe(node.path, artifacts) : undefined;
          return (
            <div
              className={node.type === "directory" ? "tree-row folder-row" : "tree-row file-row"}
              key={`${node.type}:${node.path}`}
              style={{ "--tree-depth": depth(node.path) } as CSSProperties}
              role="treeitem"
            >
              <span className="tree-icon">{iconFor(node)}</span>
              <span className="tree-name" title={node.path}>{fileName(node.path)}</span>
              {note ? <span className="tree-note">{note}</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
