import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { FileRelationshipGraph, GeneratedArtifactSummary, TreeNode } from "@mag/shared";
import { FileIcon } from "./FileIcon";

type ExplorerNode = {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  depth: number;
  children: ExplorerNode[];
};

type RelationshipItem = {
  path: string;
  title: string;
  relation: string;
};

type Relationship = {
  key: "uses" | "usedBy" | "other";
  label: string;
  values: RelationshipItem[];
};

type RelationshipSortMode = "alpha" | "relation";

interface FileTreeViewerProps {
  nodes: TreeNode[];
  artifacts?: GeneratedArtifactSummary[];
  relationshipGraph?: FileRelationshipGraph;
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
    metadataFile: string;
    asset: string;
    scene: string;
    prefab: string;
    resource: string;
    localization: string;
    environment: string;
    projectConfig: string;
    productConfig: string;
    relationshipMap: string;
    pipeline: string;
    test: string;
    other: string;
    relationships: string;
    uses: string;
    usedBy: string;
    manages: string;
    directChildren: string;
    nestedFiles: string;
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
  const lower = path.toLowerCase();
  const ext = extension(lower);

  if (lower.endsWith(".unity")) return "scene";
  if (lower.endsWith(".prefab")) return "prefab";
  if (/\.(png|jpg|jpeg|webp|svg|asset|mat|fbx|wav|mp3|ogg|controller|anim|asmdef|meta|shader|hlsl|cginc)$/i.test(lower)) return "resource";
  if (ext === "xcstrings" || ext === "arb" || lower.includes("/i18n/") || lower.includes("/l10n/") || lower.includes("localization")) return "localization";
  if (lower.endsWith("architecture/file-relationships.graph.json") || lower.includes("/architecture/relationships/")) return "relationship";
  if (lower.includes("/architecture/") && lower.endsWith(".json")) return "metadata";
  if (lower.includes("/test/") || lower.includes("/tests/") || /\.(test|spec)\.(ts|tsx|js|jsx|dart)$/i.test(lower)) return "test";
  if (lower.includes("/delivery/") || lower.includes("/ci/") || lower.includes("/.github/")) return "pipeline";
  if (lower.includes("/product/") || lower.includes("/distribution/") || lower.includes("/monetization/") || lower.includes("/offline/") || lower.includes("/quality/")) return ext === "json" ? "product-config" : "source";
  if (["env", "xcconfig"].includes(ext)) return "environment";
  if (["pbxproj", "xcodeproj", "csproj", "sln", "gradle", "properties", "plist", "xml", "lock"].includes(ext) || ["project.yml", "pubspec.yaml", "package.json"].includes(fileName(lower))) return "project-config";
  if (lower.endsWith(".md")) return "documentation";
  if (/\.(ts|tsx|js|jsx|swift|dart|cs|kt|java)$/i.test(lower)) return "source";
  if (/\.(json|yaml|yml|txt)$/i.test(lower)) return artifact?.kind === "metadata" ? "metadata" : "config";
  return artifact?.kind ?? "other";
}

function categoryLabel(category: string, labels: FileTreeViewerProps["labels"]): string {
  const map: Record<string, string> = {
    folder: labels.folder,
    source: labels.sourceCode,
    config: labels.config,
    metadata: labels.metadataFile,
    documentation: labels.documentation,
    asset: labels.asset,
    scene: labels.scene,
    prefab: labels.prefab,
    resource: labels.resource,
    localization: labels.localization,
    environment: labels.environment,
    "project-config": labels.projectConfig,
    "product-config": labels.productConfig,
    relationship: labels.relationshipMap,
    pipeline: labels.pipeline,
    test: labels.test,
    other: labels.other
  };
  return map[category] ?? labels.other;
}

function localizedKnownDescription(path: string, type: "file" | "directory", language: "ua" | "en"): string | undefined {
  const lower = path.toLowerCase();
  const ua = language === "ua";

  if (type === "directory") {
    if (lower.includes("/features") || lower.includes("/modules")) return ua ? "Межа feature/module для продуктової логіки." : "Feature/module boundary for generated product logic.";
    if (lower.includes("/product/")) return ua ? "Product-рівень із конфігами, менеджерами та контрактами модулів." : "Product layer with configs, managers and module contracts.";
    if (lower.includes("/services")) return ua ? "Сервісна межа для інфраструктурних відповідальностей." : "Service boundary for infrastructure concerns.";
    if (lower.includes("/navigation")) return ua ? "Шар навігації та маршрутизації." : "Navigation and routing layer.";
    if (lower.includes("/config")) return ua ? "Конфігурація середовища і runtime-параметрів." : "Environment and runtime configuration.";
    if (lower.includes("/architecture")) return ua ? "Архітектурні допоміжні файли, які можна візуалізувати або використовувати для аналізу структури." : "Architecture support files that can be visualized or used to inspect the structure.";
    return ua ? "Згенерована папка архітектурного пакета." : "Generated architecture package folder.";
  }

  if (lower.endsWith("readme.md")) return ua ? "Огляд проєкту, setup-нотатки і підсумок архітектури." : "Project overview, setup notes and generated architecture summary.";
  if (lower.endsWith("architecture/file-relationships.graph.json")) return ua ? "Граф зв’язків між source, config, ресурсами, сценами, префабами і модулями. Формат придатний для майбутньої візуалізації." : "Graph-ready relationship map between source, config, resources, scenes, prefabs and modules.";
  if (lower.endsWith(".unity")) return ua ? "Unity scene: стартова або bootstrap-сцена для запуску застосунку." : "Unity scene: startup or bootstrap scene for app launch.";
  if (lower.endsWith(".prefab")) return ua ? "Unity prefab resource, який збирає runtime-об’єкт або composition root." : "Unity prefab resource that composes a runtime object or composition root.";
  if (lower.includes("monetization")) return ua ? "Межа монетизації: config, manager, entitlement або purchase gateway." : "Monetization boundary: config, manager, entitlement or purchase gateway.";
  if (lower.includes("distribution")) return ua ? "Публікаційна межа: store target, release channel або release manager." : "Publishing boundary: store target, release channel or release manager.";
  if (lower.includes("offline")) return ua ? "Offline/data межа: cache, sync queue або repository coordination." : "Offline/data boundary: cache, sync queue or repository coordination.";
  if (lower.includes("quality")) return ua ? "Runtime quality межа: diagnostics, logging, flags або safety checks." : "Runtime quality boundary: diagnostics, logging, flags or safety checks.";
  if (lower.includes("delivery")) return ua ? "Delivery межа: pipeline, checklist або build environment handoff." : "Delivery boundary: pipeline, checklist or build environment handoff.";
  if (lower.includes("auth")) return ua ? "Межа авторизації для входу, стану або token handling." : "Authentication boundary for sign-in, state or token handling.";
  if (lower.includes("analytics")) return ua ? "Межа аналітичних подій і tracking." : "Analytics event and tracking boundary.";
  if (lower.includes("localization") || lower.includes("i18n") || lower.includes("l10n")) return ua ? "Ресурси локалізації та шар доступу до текстів." : "Localization resources and text access layer.";
  if (lower.includes("push")) return ua ? "Заготовка межі push-сповіщень." : "Push notification placeholder boundary.";
  if (lower.includes("network") || lower.includes("api")) return ua ? "Межа мережевої комунікації." : "Network communication boundary.";
  if (lower.includes("persistence") || lower.includes("storage") || lower.includes("cache")) return ua ? "Межа локальних даних, кешу або persistence." : "Local data, cache or persistence boundary.";
  if (lower.includes("navigation") || lower.includes("router") || lower.includes("coordinator")) return ua ? "Файл навігації або routing." : "Navigation/routing source file.";
  if (lower.includes("config") || lower.includes("env")) return ua ? "Конфігураційний файл або env placeholder." : "Configuration source or environment placeholder.";
  if (lower.includes("usecase") || lower.includes("policy") || lower.includes("mapper") || lower.includes("registry") || lower.includes("adapter") || lower.includes("bridge") || lower.includes("monitor") || lower.includes("resolver")) return ua ? "Companion-файл модуля: окрема відповідальність, яка підв'язується до manager/service межі." : "Module companion file: a focused responsibility wired into the manager/service boundary.";
  return undefined;
}

function meaningfulArtifactDescription(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  const weak = new Set([
    "source artifact",
    "config artifact",
    "metadata artifact",
    "documentation artifact",
    "other artifact",
    "generated architecture package file"
  ]);
  return weak.has(normalized) || /^.* artifact$/.test(normalized) ? undefined : value;
}

function inferDescription(path: string, type: "file" | "directory", language: "ua" | "en", artifact?: GeneratedArtifactSummary): string {
  return localizedKnownDescription(path, type, language)
    ?? meaningfulArtifactDescription(artifact?.description)
    ?? (language === "ua" ? "Згенерований файл архітектурного пакета." : "Generated architecture package file.");
}

function relationshipsFor(path: string, type: "file" | "directory", labels: FileTreeViewerProps["labels"], language: "ua" | "en"): Relationship[] {
  const lower = path.toLowerCase();
  const ua = language === "ua";
  const rows: Relationship[] = [];
  if (type === "directory") {
    if (lower.includes("/product/")) {
      rows.push({ key: "other", label: labels.manages, values: [{ path: path, title: ua ? "Конфіги JSON, manager scripts і contracts" : "JSON configs, manager scripts and contracts", relation: "manages" }] });
    }
    return rows;
  }
  if (lower.endsWith("architecture/file-relationships.graph.json")) {
    rows.push({ key: "uses", label: labels.uses, values: [{ path: "generated file tree", title: ua ? "усе згенероване дерево файлів" : "the generated file tree", relation: "maps" }, { path: "source/config/resource boundaries", title: "source/config/resource boundaries", relation: "maps" }] });
  }
  if (lower.includes("/product/") || lower.includes("/distribution/") || lower.includes("/delivery/") || lower.includes("/features/") || lower.includes("/modules/")) {
    if (lower.endsWith(".json")) rows.push({ key: "usedBy", label: labels.usedBy, values: [{ path: "manager", title: ua ? "Manager script у відповідній product-папці" : "Manager script in the matching product folder", relation: "configures" }] });
    if (lower.includes("manager") || lower.includes("coordinator") || lower.includes("pipeline")) rows.push({ key: "uses", label: labels.manages, values: [{ path: "Config JSON", title: "Config JSON", relation: "manages" }, { path: "contract/state files", title: "contract/state files", relation: "manages" }, { path: "platform handoff", title: "platform handoff", relation: "manages" }] });
    if (lower.includes("state") || lower.includes("gateway") || lower.includes("target") || lower.includes("queue") || lower.includes("repository") || lower.includes("checklist") || lower.includes("environment") || lower.includes("policy") || lower.includes("mapper") || lower.includes("registry") || lower.includes("adapter")) rows.push({ key: "usedBy", label: labels.usedBy, values: [{ path: "manager/coordinator", title: ua ? "Manager або coordinator цієї межі" : "Manager or coordinator for this boundary", relation: "used-by" }] });
  }
  if (lower.endsWith(".prefab")) rows.push({ key: "usedBy", label: labels.usedBy, values: [{ path: "AppManager", title: "AppManager", relation: "binds" }, { path: "BootSceneController", title: "BootSceneController", relation: "instantiates" }] });
  if (lower.endsWith(".unity")) rows.push({ key: "uses", label: labels.uses, values: [{ path: "BootSceneController", title: "BootSceneController", relation: "instantiates" }, { path: "AppRoot.prefab", title: "AppRoot.prefab", relation: "instantiates" }] });
  return rows;
}

function filename(value: string): string {
  return fileName(value).replace(/\/$/, "");
}

function graphPathVariants(value: string): string[] {
  const clean = cleanPath(value).replace(/^\/+/, "");
  const parts = clean.split("/").filter(Boolean);
  const variants = new Set<string>([clean]);

  // The UI tree stores paths with the generated root folder, while the generated
  // relationship graph stores paths relative to that root. Keep both variants so
  // selected files can match graph edges in both preview and completed-run views.
  if (parts.length > 1) {
    variants.add(parts.slice(1).join("/"));
  }

  return Array.from(variants).filter(Boolean);
}

function pathsMatch(left: string, right: string): boolean {
  const leftVariants = graphPathVariants(left);
  const rightVariants = graphPathVariants(right);
  return leftVariants.some((leftValue) => rightVariants.some((rightValue) => leftValue === rightValue));
}

function compactRelationPath(value: string): string {
  const clean = cleanPath(value).replace(/^\/+/, "");
  const parts = clean.split("/").filter(Boolean);
  const withoutRoot = parts.length > 2 ? parts.slice(1) : parts;
  const tail = withoutRoot.slice(-2);
  return tail.length > 0 ? tail.join("/") : filename(value);
}

function relationName(value: string): string {
  return value.replace(/-/g, " ");
}

function relationshipValue(value: string, relation: string): RelationshipItem {
  return { path: cleanPath(value), title: compactRelationPath(value), relation: relationName(relation) };
}

function graphRelationshipsFor(path: string, graph: FileRelationshipGraph | undefined, labels: FileTreeViewerProps["labels"]): Relationship[] {
  const edges = graph?.graph?.edges ?? [];
  if (edges.length === 0) {
    return [];
  }

  const groups: Record<"uses" | "usedBy", Map<string, RelationshipItem>> = {
    uses: new Map(),
    usedBy: new Map()
  };

  const add = (key: "uses" | "usedBy", value: RelationshipItem) => {
    const stableKey = `${value.path}::${value.relation}`;
    groups[key].set(stableKey, value);
  };

  for (const edge of edges) {
    if (pathsMatch(edge.from, path)) {
      add(edge.relation === "used-by" ? "usedBy" : "uses", relationshipValue(edge.to, edge.relation));
    }
    if (pathsMatch(edge.to, path)) {
      add(edge.relation === "used-by" ? "uses" : "usedBy", relationshipValue(edge.from, edge.relation));
    }
  }

  return [
    { key: "uses" as const, label: labels.uses, values: Array.from(groups.uses.values()) },
    { key: "usedBy" as const, label: labels.usedBy, values: Array.from(groups.usedBy.values()) }
  ].filter((group) => group.values.length > 0);
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
  if (parentPath) ensureDirectory(map, parentPath).children.push(node);
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
    if (parentPath) ensureDirectory(map, parentPath).children.push(node);
    else roots.push(node);
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
    if (node.type === "directory" && expanded.has(node.path)) node.children.forEach(visit);
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

function treeText(nodes: ExplorerNode[], expanded: Set<string>): string {
  return flattenVisible(nodes, expanded).map((node) => `${"  ".repeat(node.depth)}${node.type === "directory" ? "/" : "-"} ${node.name}`).join("\n");
}

function relationIcon(relation: string): string {
  const value = relation.toLowerCase();
  if (value.includes("instantiate") || value.includes("compose")) return "+";
  if (value.includes("config")) return "⚙";
  if (value.includes("document")) return "i";
  if (value.includes("route")) return "→";
  if (value.includes("style")) return "✦";
  if (value.includes("validate") || value.includes("cover")) return "✓";
  if (value.includes("manage") || value.includes("own")) return "◆";
  if (value.includes("bind") || value.includes("wire")) return "⌁";
  if (value.includes("render")) return "▣";
  if (value.includes("used by") || value.includes("used-by")) return "↙";
  return "↗";
}

function sortedRelationshipValues(values: RelationshipItem[], mode: RelationshipSortMode): RelationshipItem[] {
  return [...values].sort((left, right) => {
    if (mode === "relation") {
      const relationOrder = left.relation.localeCompare(right.relation);
      if (relationOrder !== 0) return relationOrder;
    }
    return left.title.localeCompare(right.title);
  });
}

export function FileTreeViewer({ nodes, artifacts, relationshipGraph, language, labels }: FileTreeViewerProps) {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const allFolders = useMemo(() => new Set(nodes.filter((node) => node.type === "directory").map((node) => cleanPath(node.path))), [nodes]);
  const [expanded, setExpanded] = useState<Set<string>>(allFolders);
  const visible = useMemo(() => flattenVisible(tree, expanded), [tree, expanded]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [relationshipSort, setRelationshipSort] = useState<RelationshipSortMode>("alpha");
  const selected = visible.find((node) => node.path === selectedPath) ?? visible[0];

  useEffect(() => {
    setExpanded(allFolders);
    setSelectedPath(null);
  }, [allFolders]);

  const fileCount = nodes.filter((node) => node.type === "file").length;
  const folderCount = nodes.filter((node) => node.type === "directory").length;
  const docsCount = nodes.filter((node) => node.path.toLowerCase().endsWith(".md")).length;
  const metadataCount = nodes.filter((node) => node.path.includes("/architecture/") && node.type === "file").length;

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
  const relationships = graphRelationshipsFor(selected.path, relationshipGraph, labels);
  const visibleRelationships = relationships.length > 0 ? relationships : relationshipsFor(selected.path, selected.type, labels, language);

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
                  {isFolder ? (isOpen ? "-" : "+") : ""}
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
          {visibleRelationships.length > 0 ? (
            <div className="relationship-panel">
              <div className="relationship-toolbar">
                <strong>{labels.relationships}</strong>
                <div className="relationship-sort-toggle" aria-label={language === "ua" ? "Сортування зв’язків" : "Relationship sorting"}>
                  <button
                    className={relationshipSort === "alpha" ? "active" : ""}
                    type="button"
                    title={language === "ua" ? "Сортувати за алфавітом" : "Sort alphabetically"}
                    aria-label={language === "ua" ? "Сортувати за алфавітом" : "Sort alphabetically"}
                    onClick={() => setRelationshipSort("alpha")}
                  >
                    A↓
                  </button>
                  <button
                    className={relationshipSort === "relation" ? "active" : ""}
                    type="button"
                    title={language === "ua" ? "Сортувати за типом зв’язку" : "Sort by relationship type"}
                    aria-label={language === "ua" ? "Сортувати за типом зв’язку" : "Sort by relationship type"}
                    onClick={() => setRelationshipSort("relation")}
                  >
                    ◇
                  </button>
                </div>
              </div>
              <div className="relationship-columns">
                {visibleRelationships.map((relationship) => {
                  const values = sortedRelationshipValues(relationship.values, relationshipSort);
                  return (
                    <section className={`relationship-group ${relationship.key}`} key={`${relationship.key}-${relationship.label}`}>
                      <div className="relationship-group-head">
                        <span className="relationship-direction-icon">{relationship.key === "usedBy" ? "↙" : relationship.key === "uses" ? "↗" : "⌁"}</span>
                        <small>{relationship.label}</small>
                        <b>{values.length}</b>
                      </div>
                      <ul className="relationship-list">
                        {values.map((value) => (
                          <li key={`${value.path}-${value.relation}`}>
                            <span className="relationship-kind-icon" aria-hidden="true">{relationIcon(value.relation)}</span>
                            <span className="relationship-item-text">
                              <strong>{value.title}</strong>
                              <em>{value.relation}</em>
                            </span>
                            <button
                              className="relationship-copy"
                              type="button"
                              title={labels.copyPath}
                              aria-label={labels.copyPath}
                              onClick={() => void copyPath(value.path)}
                            >
                              ⧉
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : null}
          {stats ? (
            <p className="detail-note">
              {labels.children}: {stats.nestedFiles} {labels.files.toLowerCase()}
            </p>
          ) : null}
          <button className="ghost-button" type="button" onClick={() => void copyPath(selected.path)}>
            {labels.copyPath}
          </button>
        </aside>
      </div>
    </section>
  );
}
