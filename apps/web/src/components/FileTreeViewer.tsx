import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { GeneratedArtifactSummary, TreeNode } from "@mag/shared";
import { FileIcon } from "./FileIcon";

type ExplorerNode = {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  depth: number;
  children: ExplorerNode[];
};

interface FileTreeViewerProps {
  nodes: TreeNode[];
  artifacts?: GeneratedArtifactSummary[];
  language: "ua" | "en";
  labels: {
    title: string;
    copy: string;
    copied: string;
    copyPath: string;
    files: string;
    folders: string;
    docs: string;
    metadata: string;
    empty: string;
    selectedItem: string;
    type: string;
    path: string;
    description: string;
    category: string;
    extension: string;
    generatedBy: string;
    children: string;
    folder: string;
    file: string;
    sourceCode: string;
    config: string;
    documentation: string;
    asset: string;
    other: string;
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

function extension(path: string): string {
  const name = fileName(path).toLowerCase();
  if (name === ".env" || name.endsWith(".env.example")) return "env";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) : "";
}

function artifactFor(path: string, artifacts?: GeneratedArtifactSummary[]): GeneratedArtifactSummary | undefined {
  return artifacts?.find((artifact) => cleanPath(artifact.path) === cleanPath(path));
}

function nodeCategory(path: string, type: "file" | "directory", artifact?: GeneratedArtifactSummary): string {
  if (type === "directory") return "folder";
  if (artifact?.kind) return artifact.kind;
  const lower = path.toLowerCase();
  if (lower.includes("/.mag/")) return "metadata";
  if (lower.endsWith(".md")) return "documentation";
  if (/\.(ts|tsx|js|jsx|swift|dart|cs)$/i.test(lower)) return "source";
  if (/\.(json|yaml|yml|env|xcconfig|arb)$/i.test(lower)) return "config";
  if (/\.(prefab|unity|xcstrings)$/i.test(lower)) return "asset";
  return "other";
}

function categoryLabel(category: string, labels: FileTreeViewerProps["labels"]): string {
  if (category === "folder") return labels.folder;
  if (category === "source") return labels.sourceCode;
  if (category === "config") return labels.config;
  if (category === "metadata") return labels.metadata;
  if (category === "documentation") return labels.documentation;
  if (category === "asset") return labels.asset;
  return labels.other;
}

function inferDescription(path: string, type: "file" | "directory", language: "ua" | "en", artifact?: GeneratedArtifactSummary): string {
  if (artifact?.description) return artifact.description;
  const lower = path.toLowerCase();
  const ua = language === "ua";
  if (type === "directory") {
    if (lower.includes("/features") || lower.includes("/modules")) return ua ? "Межа feature/module для продуктової логіки." : "Feature/module boundary for generated product logic.";
    if (lower.includes("/services")) return ua ? "Сервісна межа для інфраструктурних відповідальностей." : "Service boundary for infrastructure concerns.";
    if (lower.includes("/navigation")) return ua ? "Шар навігації та маршрутизації." : "Navigation and routing layer.";
    if (lower.includes("/config")) return ua ? "Конфігурація середовища і runtime-параметрів." : "Environment and runtime configuration.";
    if (lower.includes("/.mag")) return ua ? "Метадані генератора і audit-артефакти." : "Generator metadata and audit artifacts.";
    return ua ? "Згенерована межа папки." : "Generated folder boundary.";
  }
  if (lower.endsWith("readme.md")) return ua ? "Огляд проєкту, setup-нотатки і підсумок архітектури." : "Project overview, setup notes and generated architecture summary.";
  if (lower.endsWith(".mag/architecture-spec.json")) return ua ? "Структурований ArchitectureSpec, який використовує генератор." : "Structured ArchitectureSpec used by the generator.";
  if (lower.endsWith(".mag/architecture-advisor.json")) return ua ? "Advisor-звіт з rationale, ризиками і рекомендаціями." : "Advisor output with design rationale, risks and recommendations.";
  if (lower.endsWith(".mag/artifact-manifest.json")) return ua ? "Manifest артефактів, який пояснює включені файли." : "Artifact manifest that explains why files were included.";
  if (lower.endsWith(".mag/validation-report.json")) return ua ? "Validation-звіт для згенерованої структури." : "Validation report for the generated structure.";
  if (lower.includes("auth")) return ua ? "Межа авторизації для входу, стану або токенів." : "Authentication boundary for sign-in, state or token handling.";
  if (lower.includes("analytics")) return ua ? "Межа аналітичних подій і tracking." : "Analytics event and tracking boundary.";
  if (lower.includes("localization") || lower.includes("i18n") || lower.includes("l10n")) return ua ? "Ресурси локалізації та шар доступу до текстів." : "Localization resources and text access layer.";
  if (lower.includes("push")) return ua ? "Заготовка межі push-сповіщень." : "Push notification placeholder boundary.";
  if (lower.includes("network") || lower.includes("api")) return ua ? "Межа мережевої комунікації." : "Network communication boundary.";
  if (lower.includes("persistence") || lower.includes("storage") || lower.includes("cache")) return ua ? "Межа локальних даних, кешу або persistence." : "Local data, cache or persistence boundary.";
  if (lower.includes("navigation") || lower.includes("router") || lower.includes("coordinator")) return ua ? "Файл навігації або routing." : "Navigation/routing source file.";
  if (lower.includes("config") || lower.includes("env")) return ua ? "Конфігураційний файл або env placeholder." : "Configuration source or environment placeholder.";
  return ua ? "Згенерований файл проєкту." : "Generated project file.";
}

function ensureDirectory(map: Map<string, ExplorerNode>, path: string): ExplorerNode {
  const existing = map.get(path);
  if (existing) return existing;
  const parts = path.split("/").filter(Boolean);
  const parentPath = parts.slice(0, -1).join("/");
  const node: ExplorerNode = {
    id: `directory:${path}`,
    name: parts[parts.length - 1] ?? path,
    path,
    type: "directory",
    depth: Math.max(0, parts.length - 1),
    children: []
  };
  map.set(path, node);
  if (parentPath) {
    ensureDirectory(map, parentPath).children.push(node);
  }
  return node;
}

function buildTree(nodes: TreeNode[]): ExplorerNode[] {
  const map = new Map<string, ExplorerNode>();
  const roots: ExplorerNode[] = [];
  const sorted = [...nodes].sort((left, right) => cleanPath(left.path).localeCompare(cleanPath(right.path)));

  for (const raw of sorted) {
    const path = cleanPath(raw.path);
    if (!path) continue;
    const parts = path.split("/").filter(Boolean);
    if (raw.type === "directory") {
      ensureDirectory(map, path);
      continue;
    }
    const parentPath = parts.slice(0, -1).join("/");
    const node: ExplorerNode = {
      id: `file:${path}`,
      name: parts[parts.length - 1] ?? path,
      path,
      type: "file",
      depth: Math.max(0, parts.length - 1),
      children: []
    };
    if (parentPath) {
      ensureDirectory(map, parentPath).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const parented = new Set<ExplorerNode>();
  for (const item of map.values()) {
    for (const child of item.children) parented.add(child);
  }
  for (const item of map.values()) {
    if (!parented.has(item)) roots.push(item);
  }

  const sortChildren = (items: ExplorerNode[]): ExplorerNode[] => {
    items.sort((left, right) => {
      if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
    for (const item of items) sortChildren(item.children);
    return items;
  };

  return sortChildren(roots);
}

function flattenVisible(nodes: ExplorerNode[], expanded: Set<string>): ExplorerNode[] {
  const result: ExplorerNode[] = [];
  const visit = (node: ExplorerNode) => {
    result.push(node);
    if (node.type === "directory" && expanded.has(node.path)) {
      node.children.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return result;
}

function folderStats(node: ExplorerNode): { direct: number; nestedFiles: number } {
  let nestedFiles = 0;
  const visit = (item: ExplorerNode) => {
    if (item.type === "file") nestedFiles += 1;
    item.children.forEach(visit);
  };
  node.children.forEach(visit);
  return { direct: node.children.length, nestedFiles };
}

function treeText(nodes: ExplorerNode[], expanded = new Set<string>()): string {
  const rows = expanded.size > 0 ? flattenVisible(nodes, expanded) : flattenVisible(nodes, new Set(nodes.map((node) => node.path)));
  return rows.map((node) => `${"  ".repeat(node.depth)}${node.type === "directory" ? "/" : "-"} ${node.name}`).join("\n");
}

export function FileTreeViewer({ nodes, artifacts, language, labels }: FileTreeViewerProps) {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const allFolders = useMemo(() => new Set(nodes.filter((node) => node.type === "directory").map((node) => cleanPath(node.path))), [nodes]);
  const [expanded, setExpanded] = useState<Set<string>>(allFolders);
  const visible = useMemo(() => flattenVisible(tree, expanded), [tree, expanded]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selected = visible.find((node) => node.path === selectedPath) ?? visible[0];

  useEffect(() => {
    setExpanded(allFolders);
    setSelectedPath(null);
  }, [allFolders]);

  const fileCount = nodes.filter((node) => node.type === "file").length;
  const folderCount = nodes.filter((node) => node.type === "directory").length;
  const docsCount = nodes.filter((node) => node.path.toLowerCase().endsWith(".md")).length;
  const metadataCount = nodes.filter((node) => node.path.includes("/.mag/") && node.type === "file").length;

  async function copyTree(): Promise<void> {
    await navigator.clipboard?.writeText(treeText(tree, allFolders));
  }

  async function copyPath(path: string): Promise<void> {
    await navigator.clipboard?.writeText(path);
  }

  function toggleFolder(path: string): void {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  if (nodes.length === 0 || !selected) {
    return <div className="empty-state">{labels.empty}</div>;
  }

  const selectedArtifact = artifactFor(selected.path, artifacts);
  const selectedCategory = nodeCategory(selected.path, selected.type, selectedArtifact);
  const stats = selected.type === "directory" ? folderStats(selected) : null;

  return (
    <section className="console-card tree-console explorer-card">
      <div className="section-head explorer-head">
        <div>
          <span className="kicker">{labels.title}</span>
          <h2>{tree[0]?.name ?? labels.title}</h2>
        </div>
        <button className="ghost-button" type="button" onClick={() => void copyTree()}>
          {labels.copy}
        </button>
      </div>

      <div className="tree-metrics compact-metrics">
        <span><small>{labels.files}</small><strong>{fileCount}</strong></span>
        <span><small>{labels.folders}</small><strong>{folderCount}</strong></span>
        <span><small>{labels.docs}</small><strong>{docsCount}</strong></span>
        <span><small>{labels.metadata}</small><strong>{metadataCount}</strong></span>
      </div>

      <div className="file-explorer">
        <div className="file-tree" role="tree">
          {visible.map((node) => {
            const isFolder = node.type === "directory";
            const isOpen = expanded.has(node.path);
            const artifact = artifactFor(node.path, artifacts);
            const category = nodeCategory(node.path, node.type, artifact);
            const tag = categoryLabel(category, labels);
            return (
              <div
                className={`tree-row ${isFolder ? "folder-row" : "file-row"} ${selected.path === node.path ? "selected" : ""}`}
                key={node.id}
                style={{ "--tree-depth": node.depth } as CSSProperties}
                role="treeitem"
                aria-selected={selected.path === node.path}
                onClick={() => setSelectedPath(node.path)}
              >
                <button
                  className={isFolder ? "tree-toggle" : "tree-toggle placeholder"}
                  type="button"
                  aria-label={isOpen ? "Collapse folder" : "Expand folder"}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isFolder) toggleFolder(node.path);
                  }}
                >
                  {isFolder ? (isOpen ? "−" : "+") : ""}
                </button>
                <FileIcon path={node.path} type={node.type} isOpen={isOpen} />
                <span className="tree-name" title={node.path}>{node.name}</span>
                <span className={`tree-tag ${category}`}>{tag}</span>
              </div>
            );
          })}
        </div>

        <aside className="file-detail-panel">
          <span className="kicker">{labels.selectedItem}</span>
          <h3>{selected.name}</h3>
          <div className="file-detail-grid">
            <span><small>{labels.type}</small><strong>{categoryLabel(selectedCategory, labels)}</strong></span>
            <span><small>{labels.extension}</small><strong>{selected.type === "directory" ? "-" : extension(selected.path).toUpperCase() || "-"}</strong></span>
            <span><small>{labels.category}</small><strong>{selectedCategory}</strong></span>
            <span><small>{labels.generatedBy}</small><strong>App Architector</strong></span>
          </div>
          <label className="path-field">
            <small>{labels.path}</small>
            <code>{selected.path}</code>
          </label>
          <p>{inferDescription(selected.path, selected.type, language, selectedArtifact)}</p>
          {stats ? (
            <p className="detail-note">{labels.children}: {stats.direct} direct, {stats.nestedFiles} files nested.</p>
          ) : null}
          <button className="ghost-button" type="button" onClick={() => void copyPath(selected.path)}>
            {labels.copyPath}
          </button>
        </aside>
      </div>
    </section>
  );
}
