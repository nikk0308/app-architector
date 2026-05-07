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

type Relationship = {
  label: string;
  value: string;
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
  if (/\.(png|jpg|jpeg|webp|svg|asset|mat|fbx|wav|mp3)$/i.test(lower)) return "resource";
  if (ext === "xcstrings" || ext === "arb" || lower.includes("/i18n/") || lower.includes("/l10n/") || lower.includes("localization")) return "localization";
  if (lower.endsWith(".mag/file-relationships.json")) return "relationship";
  if (lower.includes("/.mag/")) return "metadata";
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
    if (lower.includes("/.mag")) return ua ? "Метадані генератора і audit-артефакти." : "Generator metadata and audit artifacts.";
    if (lower.includes("/generationmode") || lower.includes("/generation_mode")) return ua ? "Видима межа обраного режиму генерації." : "Visible boundary for the selected generation mode.";
    return ua ? "Згенерована папка архітектурного пакета." : "Generated architecture package folder.";
  }

  if (lower.endsWith("readme.md")) return ua ? "Огляд проєкту, setup-нотатки і підсумок архітектури." : "Project overview, setup notes and generated architecture summary.";
  if (lower.endsWith(".mag/architecture-spec.json")) return ua ? "Структурований ArchitectureSpec, який визначає профіль, модулі та архітектурні рішення." : "Structured ArchitectureSpec that defines profile, modules and architecture decisions.";
  if (lower.endsWith(".mag/architecture-advisor.json")) return ua ? "Advisor-звіт із rationale, ризиками, припущеннями і рекомендаціями." : "Advisor report with rationale, risks, assumptions and recommendations.";
  if (lower.endsWith(".mag/artifact-manifest.json")) return ua ? "Manifest артефактів: пояснює, які файли включено і чому." : "Artifact manifest: explains which files were included and why.";
  if (lower.endsWith(".mag/validation-report.json")) return ua ? "Звіт перевірки normalized spec і manifest перед матеріалізацією ZIP." : "Validation report for the normalized spec and manifest before ZIP materialization.";
  if (lower.endsWith(".mag/file-relationships.json")) return ua ? "Карта зв’язків між конфігами, менеджерами, модулями і metadata-файлами." : "Relationship map between configs, managers, modules and metadata files.";
  if (lower.includes(".mag/generation-mode-")) return ua ? "Профіль режиму генерації: Baseline, GPT, Qwen або Hybrid та його вплив на spec." : "Generation mode profile: Baseline, GPT, Qwen or Hybrid and its influence on the spec.";
  if (lower.endsWith(".unity")) return ua ? "Unity scene: стартова або bootstrap-сцена для запуску застосунку." : "Unity scene: startup or bootstrap scene for app launch.";
  if (lower.endsWith(".prefab")) return ua ? "Unity prefab resource, який збирає runtime-об’єкт або composition root." : "Unity prefab resource that composes a runtime object or composition root.";
  if (lower.includes("generationmode") || lower.includes("generation_mode") || lower.includes("modeboundary")) return ua ? "Source boundary, який робить відмінність режиму генерації видимою у дереві." : "Source boundary that makes the generation mode difference visible in the tree.";
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
  return undefined;
}

function inferDescription(path: string, type: "file" | "directory", language: "ua" | "en", artifact?: GeneratedArtifactSummary): string {
  return localizedKnownDescription(path, type, language)
    ?? artifact?.description
    ?? (language === "ua" ? "Згенерований файл архітектурного пакета." : "Generated architecture package file.");
}

function relationshipsFor(path: string, type: "file" | "directory", labels: FileTreeViewerProps["labels"], language: "ua" | "en"): Relationship[] {
  const lower = path.toLowerCase();
  const ua = language === "ua";
  const rows: Relationship[] = [];
  if (type === "directory") {
    if (lower.includes("/product/")) {
      rows.push({ label: labels.manages, value: ua ? "Конфіги JSON, manager scripts і contracts усередині цієї product-межі." : "JSON configs, manager scripts and contracts inside this product boundary." });
    }
    return rows;
  }
  if (lower.endsWith(".mag/architecture-spec.json")) {
    rows.push({ label: labels.usedBy, value: "artifact-manifest.json, generation-mode-profile.json, file-relationships.json" });
  }
  if (lower.endsWith(".mag/artifact-manifest.json")) {
    rows.push({ label: labels.usedBy, value: ua ? "Deterministic materializer і validation report." : "Deterministic materializer and validation report." });
  }
  if (lower.endsWith(".mag/file-relationships.json")) {
    rows.push({ label: labels.uses, value: "ArchitectureSpec + selected product modules" });
  }
  if (lower.includes("/product/") || lower.includes("/distribution/") || lower.includes("/delivery/")) {
    if (lower.endsWith(".json")) rows.push({ label: labels.usedBy, value: ua ? "Manager script у відповідній product-папці." : "Manager script in the matching product folder." });
    if (lower.includes("manager") || lower.includes("coordinator") || lower.includes("pipeline")) rows.push({ label: labels.manages, value: ua ? "Config JSON, contract/state files і platform handoff." : "Config JSON, contract/state files and platform handoff." });
    if (lower.includes("state") || lower.includes("gateway") || lower.includes("target") || lower.includes("queue") || lower.includes("repository") || lower.includes("checklist") || lower.includes("environment")) rows.push({ label: labels.usedBy, value: ua ? "Product manager або coordinator цієї межі." : "Product manager or coordinator for this boundary." });
  }
  if (lower.endsWith(".prefab")) rows.push({ label: labels.usedBy, value: "AppManager / BootSceneController" });
  if (lower.endsWith(".unity")) rows.push({ label: labels.uses, value: "BootSceneController + AppRoot.prefab" });
  return rows;
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
  const relationships = relationshipsFor(selected.path, selected.type, labels, language);

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
          {relationships.length > 0 ? (
            <div className="relationship-panel">
              <strong>{labels.relationships}</strong>
              {relationships.map((relationship) => (
                <span key={`${relationship.label}-${relationship.value}`}>
                  <small>{relationship.label}</small>
                  <em>{relationship.value}</em>
                </span>
              ))}
            </div>
          ) : null}
          {stats ? (
            <p className="detail-note">
              {labels.children}: {stats.direct} {labels.directChildren}, {stats.nestedFiles} {labels.nestedFiles}.
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
