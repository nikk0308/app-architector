#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import traceback
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from string import Template
from typing import Any, Dict, Iterable, List, Set, Tuple

ROOT = Path(__file__).resolve().parent
TEMPLATES_ROOT = ROOT / "templates"
ARTIFACT_REGISTRY_PATH = ROOT.parent.parent / "config" / "artifact-registry.json"
PLACEHOLDER_PATTERN = re.compile(r"\$\{([^}]+)\}")


class GeneratorError(RuntimeError):
    def __init__(self, code: str, message: str, **details: Any) -> None:
        super().__init__(message)
        self.code = code
        self.details = details


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_dumps(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False) + "\n"


def load_registry() -> List[Dict[str, Any]]:
    try:
        parsed = json.loads(ARTIFACT_REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - defensive diagnostics for CI/runtime
        raise GeneratorError(
            "REGISTRY_LOAD_FAILED",
            f"Could not load artifact registry: {exc}",
            registryPath=str(ARTIFACT_REGISTRY_PATH),
        ) from exc

    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict) and isinstance(parsed.get("artifacts"), list):
        return parsed["artifacts"]
    raise GeneratorError(
        "REGISTRY_SHAPE_INVALID",
        "Artifact registry must be either a list or an object with an artifacts list.",
        registryPath=str(ARTIFACT_REGISTRY_PATH),
    )


def flatten_context(context: Dict[str, Any], prefix: str = "") -> Dict[str, str]:
    flat: Dict[str, str] = {}
    for key, value in context.items():
        target_key = f"{prefix}{key}" if prefix else key
        if isinstance(value, dict):
            flat.update(flatten_context(value, prefix=f"{target_key}_"))
        else:
            flat[target_key] = "" if value is None else str(value)
    return flat


def missing_placeholders(raw: str, context: Dict[str, Any]) -> List[str]:
    flat = flatten_context(context)
    return sorted({match.group(1) for match in PLACEHOLDER_PATTERN.finditer(raw) if match.group(1) not in flat})


def render_template(template_path: Path, context: Dict[str, Any]) -> str:
    if not template_path.exists():
        raise GeneratorError(
            "TEMPLATE_NOT_FOUND",
            f"Template file does not exist: {template_path}",
            template=str(template_path.relative_to(TEMPLATES_ROOT)) if template_path.is_relative_to(TEMPLATES_ROOT) else str(template_path),
        )

    raw = template_path.read_text(encoding="utf-8")
    missing = missing_placeholders(raw, context)
    if missing:
        raise GeneratorError(
            "TEMPLATE_VARIABLE_MISSING",
            f"Template {template_path.name} references variables missing from templateContext: {', '.join(missing)}",
            template=str(template_path.relative_to(TEMPLATES_ROOT)),
            missingVariables=missing,
        )
    return Template(raw).safe_substitute(flatten_context(context))


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def safe_destination(output_root: Path, relative_template: str, context: Dict[str, Any]) -> Path:
    raw_path = Template(relative_template).safe_substitute(flatten_context(context))
    if not raw_path.strip():
        raise GeneratorError("EMPTY_OUTPUT_PATH", "Artifact output path resolved to an empty string.", pathTemplate=relative_template)
    destination = (output_root / raw_path).resolve()
    output_root_resolved = output_root.resolve()
    if output_root_resolved != destination and output_root_resolved not in destination.parents:
        raise GeneratorError(
            "OUTPUT_PATH_ESCAPE",
            "Artifact output path tried to escape the generation root.",
            pathTemplate=relative_template,
            resolvedPath=str(destination),
            outputRoot=str(output_root_resolved),
        )
    return destination


def profile_output_map(entry: Dict[str, Any], profile: str) -> List[Dict[str, Any]]:
    outputs = entry.get("outputs", {})
    return outputs.get(profile) or outputs.get("default") or []


def write_registry_outputs(
    output_root: Path,
    profile: str,
    artifact_ids: List[str],
    context: Dict[str, Any],
) -> Tuple[List[str], List[str], List[Dict[str, Any]]]:
    registry = load_registry()
    entries = {entry["id"]: entry for entry in registry if "id" in entry}
    generated_files: List[str] = []
    missing_artifacts: List[str] = []
    skipped_outputs: List[Dict[str, Any]] = []

    for artifact_id in artifact_ids:
        entry = entries.get(artifact_id)
        if not entry:
            missing_artifacts.append(artifact_id)
            continue

        outputs = profile_output_map(entry, profile)
        if not outputs:
            skipped_outputs.append({"artifactId": artifact_id, "reason": "no outputs for selected profile"})
            continue

        for output in outputs:
            output_context = {**context, **(output.get("vars") if isinstance(output.get("vars"), dict) else {})}
            destination = safe_destination(output_root, output["path"], output_context)
            ensure_parent(destination)
            if "literal" in output:
                destination.write_text(str(output["literal"]), encoding="utf-8")
            else:
                template_name = output.get("template")
                if not template_name:
                    skipped_outputs.append({"artifactId": artifact_id, "reason": "output has no literal or template"})
                    continue
                template_path = TEMPLATES_ROOT / template_name
                destination.write_text(render_template(template_path, output_context), encoding="utf-8")
            generated_files.append(str(destination.relative_to(output_root)))

    return sorted(generated_files), sorted(missing_artifacts), skipped_outputs


def collect_file_tree(output_root: Path) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    for path in sorted(output_root.rglob("*")):
        relative = str(path.relative_to(output_root))
        entries.append({"path": relative + ("/" if path.is_dir() else ""), "type": "directory" if path.is_dir() else "file"})
    return entries


def write_json(path: Path, value: Any) -> None:
    ensure_parent(path)
    path.write_text(json_dumps(value), encoding="utf-8")


def classify_graph_node(path: str) -> str:
    lower = path.lower()
    if lower.endswith(".md"):
        return "documentation"
    if lower.endswith(".unity"):
        return "scene"
    if lower.endswith(".prefab"):
        return "prefab"
    if lower.endswith((".uxml", ".uss", ".asset", ".mat", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".xcassets", ".storyboard", ".xib")):
        return "resource"
    if lower.endswith((".swift", ".dart", ".ts", ".tsx", ".js", ".jsx", ".cs", ".kt", ".java")):
        return "source"
    if lower.endswith((".json", ".yaml", ".yml", ".xml", ".plist", ".xcconfig", ".env", ".properties", ".gradle", ".arb", ".xcstrings")):
        return "config"
    return "other"


def graph_module(path: str) -> str:
    lower = path.lower()
    for key in [
        "auth",
        "analytics",
        "localization",
        "push",
        "network",
        "persistence",
        "storage",
        "monetization",
        "distribution",
        "offline",
        "quality",
        "delivery",
        "navigation",
        "design",
        "domain",
        "integration",
        "observability",
        "release",
        "testing",
    ]:
        if key in lower:
            return "networking" if key == "network" else ("storage" if key == "persistence" else key)
    if "prefab" in lower or "ui/" in lower or "resources/" in lower:
        return "ui"
    if "core" in lower:
        return "core"
    return "app"


def likely_manager(path: str) -> bool:
    name = Path(path).name.lower()
    return any(token in name for token in [
        "manager",
        "coordinator",
        "container",
        "orchestrator",
        "controller",
        "service",
        "pipeline",
        "bootstrapper",
        "repository",
        "navigator",
        "router",
        "store",
        "viewmodel",
        "presenter",
        "system",
        "registry",
        "adapter",
        "facade",
    ])


def graph_role(path: str) -> str:
    lower = path.lower()
    name = Path(path).name.lower()
    if lower.endswith(".unity"):
        return "scene"
    if lower.endswith(".prefab"):
        return "prefab"
    if lower.endswith((".uxml", ".xib", ".storyboard")):
        return "view-resource"
    if lower.endswith((".uss", ".css", ".scss")):
        return "style"
    if lower.endswith((".json", ".yaml", ".yml", ".xml", ".plist", ".xcconfig", ".env", ".properties", ".gradle", ".arb", ".xcstrings")):
        return "configuration"
    if any(token in name for token in ["protocol", "interface", "contract", "port"]):
        return "contract"
    if any(token in name for token in ["repository", "store", "cache", "dao"]):
        return "repository"
    if any(token in name for token in ["service", "client", "gateway", "adapter", "api"]):
        return "service"
    if any(token in name for token in ["manager", "coordinator", "orchestrator", "controller", "bootstrapper", "container"]):
        return "manager"
    if any(token in name for token in ["viewmodel", "presenter", "state", "bloc", "controller"]):
        return "state"
    if any(token in name for token in ["view", "screen", "page", "widget", "component"]):
        return "view"
    if any(token in name for token in ["event", "model", "dto", "entity", "request", "response"]):
        return "model"
    if any(token in name for token in ["test", "spec", "mock", "fixture"]):
        return "test"
    if lower.endswith(".md"):
        return "documentation"
    return classify_graph_node(path)


def path_tokens(path: str) -> set:
    import re

    normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", path)
    raw_tokens = re.split(r"[^A-Za-z0-9#]+", normalized)
    aliases = {
        "api": "network",
        "networking": "network",
        "networkclient": "network",
        "persistence": "storage",
        "cache": "storage",
        "store": "storage",
        "i18n": "localization",
        "l10n": "localization",
        "router": "navigation",
        "navigator": "navigation",
        "coordinator": "navigation",
        "viewmodel": "state",
        "controller": "state",
        "prefabs": "prefab",
        "scenes": "scene",
    }
    tokens = {token.lower() for token in raw_tokens if token}
    tokens.update(aliases[token] for token in list(tokens) if token in aliases)
    return tokens


def path_depth(path: str) -> int:
    return len(Path(path).parts)


def relation_priority(role: str) -> str:
    if role == "contract":
        return "implements"
    if role == "repository":
        return "persists-to"
    if role == "configuration":
        return "configured-by"
    if role in {"prefab", "view-resource"}:
        return "binds"
    if role == "scene":
        return "instantiates"
    if role == "style":
        return "styled-by"
    if role == "test":
        return "covers"
    if role == "model":
        return "uses-model"
    if role == "state":
        return "drives-state"
    if role == "view":
        return "renders"
    if role == "documentation":
        return "documents"
    return "uses"


def build_relationship_graph(output_root: Path, payload: Dict[str, Any], diagnostics: Dict[str, Any]) -> Dict[str, Any]:
    tree = collect_file_tree(output_root)
    files = [entry["path"] for entry in tree if entry.get("type") == "file"]
    spec = payload.get("spec") if isinstance(payload.get("spec"), dict) else {}
    blueprint = spec.get("aiBlueprint") if isinstance(spec.get("aiBlueprint"), dict) else None
    blueprint_files: Dict[str, Dict[str, Any]] = {}
    if blueprint:
        for module_info in blueprint.get("modules", []) if isinstance(blueprint.get("modules"), list) else []:
            if not isinstance(module_info, dict):
                continue
            for file_info in module_info.get("files", []) if isinstance(module_info.get("files"), list) else []:
                if isinstance(file_info, dict) and file_info.get("path"):
                    blueprint_files[str(file_info.get("path"))] = {**file_info, "modulePurpose": module_info.get("purpose"), "moduleName": module_info.get("name")}

    nodes = []
    for path in files:
        blueprint_file = blueprint_files.get(path)
        nodes.append({
            "id": path,
            "path": path,
            "kind": classify_graph_node(path),
            "module": str(blueprint_file.get("module") or graph_module(path)) if blueprint_file else graph_module(path),
            "role": str(blueprint_file.get("role") or graph_role(path)) if blueprint_file else graph_role(path),
            "description": str(blueprint_file.get("description") or blueprint_file.get("modulePurpose") or "") if blueprint_file else "",
            "generatedBy": "ai-blueprint" if blueprint_file else "App Architector",
        })
    edges: List[Dict[str, str]] = []
    edge_keys: Set[Tuple[str, str, str]] = set()
    node_by_path = {node["path"]: node for node in nodes}

    def add_edge(source: str, target: str, relation: str, reason: str) -> None:
        if source == target or source not in files or target not in files:
            return
        key = (source, target, relation)
        if key in edge_keys:
            return
        edge_keys.add(key)
        edge = {"from": source, "to": target, "relation": relation, "reason": reason}
        edges.append(edge)

    def role(path: str) -> str:
        return node_by_path.get(path, {}).get("role", graph_role(path))

    def module(path: str) -> str:
        return node_by_path.get(path, {}).get("module", graph_module(path))

    def best_owner(candidates: List[str], target: str) -> str | None:
        if not candidates:
            return None
        target_tokens = path_tokens(target)

        def rank(candidate: str) -> tuple:
            candidate_tokens = path_tokens(candidate)
            overlap = len(target_tokens & candidate_tokens)
            manager_bonus = 4 if likely_manager(candidate) else 0
            module_bonus = 3 if module(candidate) == module(target) else 0
            source_bonus = 1 if classify_graph_node(candidate) == "source" else 0
            depth_penalty = abs(path_depth(candidate) - path_depth(target))
            return (overlap + manager_bonus + module_bonus + source_bonus, -depth_penalty, -len(candidate))

        return sorted(candidates, key=rank, reverse=True)[0]

    root_managers = [
        path for path in files
        if likely_manager(path) and module(path) in {"app", "core", "integration", "navigation"}
    ]
    if not root_managers:
        root_managers = [
            path for path in files
            if classify_graph_node(path) == "source" and any(token in Path(path).name.lower() for token in ["app", "main", "bootstrap", "root"])
        ][:4]
    module_groups: Dict[str, List[str]] = {}
    for path in files:
        module_groups.setdefault(module(path), []).append(path)

    for group_name, module_files in module_groups.items():
        managers = [path for path in module_files if likely_manager(path)] or module_files[:1]
        manager = managers[0]
        for path in module_files:
            if path == manager:
                continue
            item_role = role(path)
            relation = relation_priority(item_role)
            if item_role in {"configuration", "style", "documentation"}:
                add_edge(path, manager, relation, f"{Path(path).name} is consumed by the {group_name} boundary.")
            else:
                add_edge(manager, path, relation, f"{Path(manager).name} coordinates the {group_name} boundary.")
            if classify_graph_node(path) in {"config", "resource", "prefab", "scene"}:
                add_edge(path, manager, "used-by", f"{Path(path).name} feeds the {group_name} runtime boundary.")
        for root in root_managers[:3]:
            if root != manager:
                add_edge(root, manager, "wires", f"{Path(root).name} wires the {group_name} boundary into the app composition.")

    source_files = [path for path in files if classify_graph_node(path) == "source"]
    config_files = [path for path in files if classify_graph_node(path) == "config"]
    resources = [path for path in files if classify_graph_node(path) in {"resource", "prefab", "scene"}]
    documents = [path for path in files if classify_graph_node(path) == "documentation"]

    managers = [path for path in source_files if likely_manager(path)]
    contracts = [path for path in source_files if role(path) == "contract"]
    repositories = [path for path in source_files if role(path) == "repository"]
    services = [path for path in source_files if role(path) == "service"]
    states = [path for path in source_files if role(path) == "state"]
    views = [path for path in source_files if role(path) == "view"]
    models = [path for path in source_files if role(path) == "model"]
    tests = [path for path in source_files if role(path) == "test"]

    for contract in contracts:
        for implementer in [path for path in source_files if path != contract and path_tokens(path) & path_tokens(contract)][:6]:
            add_edge(implementer, contract, "implements", f"{Path(implementer).name} implements or depends on the {Path(contract).name} contract.")

    for service in services:
        owner = best_owner(managers, service)
        if owner:
            add_edge(owner, service, "owns", f"{Path(owner).name} owns the service lifecycle.")
        repo = best_owner(repositories, service)
        if repo and module(repo) == module(service):
            add_edge(service, repo, "uses-repository", f"{Path(service).name} delegates persisted state to {Path(repo).name}.")
        for model_file in [path for path in models if path_tokens(path) & path_tokens(service)][:5]:
            add_edge(service, model_file, "uses-model", f"{Path(service).name} exchanges data through {Path(model_file).name}.")
        for config in [path for path in config_files if module(path) in {module(service), "app", "core"} or path_tokens(path) & path_tokens(service)][:5]:
            add_edge(config, service, "configures", f"{Path(config).name} supplies runtime settings to {Path(service).name}.")

    for repo in repositories:
        owner = best_owner(managers + services, repo)
        if owner:
            add_edge(owner, repo, "persists-through", f"{Path(owner).name} uses {Path(repo).name} as a persistence boundary.")
        for model_file in [path for path in models if module(path) == module(repo) or path_tokens(path) & path_tokens(repo)][:5]:
            add_edge(repo, model_file, "stores-model", f"{Path(repo).name} persists {Path(model_file).name}.")

    for view in views:
        state = best_owner(states, view)
        if state:
            add_edge(view, state, "observes", f"{Path(view).name} observes state from {Path(state).name}.")
        navigator = best_owner([path for path in managers if module(path) == "navigation"], view)
        if navigator:
            add_edge(navigator, view, "routes-to", f"{Path(navigator).name} routes to {Path(view).name}.")
        service = best_owner(services, view)
        if service and module(service) == module(view):
            add_edge(view, service, "uses", f"{Path(view).name} calls the module service boundary.")

    for state in states:
        service = best_owner(services + repositories, state)
        if service:
            add_edge(state, service, "depends-on", f"{Path(state).name} depends on {Path(service).name} for side effects.")

    for config in config_files:
        target = best_owner(managers + services + states, config)
        if target:
            add_edge(config, target, "configures", f"{Path(config).name} configures {Path(target).name}.")

    for test in tests:
        target = best_owner([path for path in source_files if path != test and role(path) != "test"], test)
        if target:
            add_edge(test, target, "covers", f"{Path(test).name} verifies {Path(target).name}.")

    for scene in [path for path in files if path.lower().endswith(".unity")]:
        for prefab in [path for path in files if path.lower().endswith(".prefab")][:24]:
            add_edge(scene, prefab, "instantiates", "Unity scene references generated prefabs.")
    for prefab in [path for path in files if path.lower().endswith(".prefab")]:
        matched_scripts = [
            path for path in files
            if path.lower().endswith(".cs") and (path_tokens(path) & path_tokens(prefab) or likely_manager(path))
        ][:10]
        for script in matched_scripts:
            add_edge(prefab, script, "binds", "Prefab is intended to bind to a runtime script or manager.")
    for ui_doc in [path for path in files if path.lower().endswith(".uxml")]:
        for style in [path for path in files if path.lower().endswith(".uss")][:8]:
            add_edge(ui_doc, style, "styled-by", "UI Toolkit document uses the generated style sheet.")
        controller = best_owner([path for path in files if path.lower().endswith(".cs")], ui_doc)
        if controller:
            add_edge(controller, ui_doc, "renders", f"{Path(controller).name} controls the UI document.")
    for readme in [path for path in files if path.lower().endswith("readme.md")]:
        for target in [path for path in files if "architecture" in path.lower() or "docs/" in path.lower()][:16]:
            add_edge(readme, target, "documents", "README points to architecture explanation and relationship files.")

    def first_matching(patterns: List[str]) -> str | None:
        compiled = [re.compile(pattern, re.IGNORECASE) for pattern in patterns]
        for candidate in files:
            if any(pattern.search(candidate) for pattern in compiled):
                return candidate
        return None

    def matching(patterns: List[str], limit: int = 32) -> List[str]:
        compiled = [re.compile(pattern, re.IGNORECASE) for pattern in patterns]
        return [candidate for candidate in files if any(pattern.search(candidate) for pattern in compiled)][:limit]

    def connect_one_to_many(source_patterns: List[str], target_patterns: List[str], relation: str, reason: str, limit: int = 16) -> None:
        source = first_matching(source_patterns)
        if not source:
            return
        for target in matching(target_patterns, limit):
            add_edge(source, target, relation, reason)

    profile_id = str(payload.get("profile", {}).get("profile") or payload.get("spec", {}).get("profileId") or "")
    if profile_id == "unity" or any(path.lower().endswith(".unity") for path in files):
        connect_one_to_many([r"Bootstrap\.unity$", r"SampleScene\.unity$"], [r"AppRoot\.prefab$", r"BootSceneController\.cs$"], "instantiates", "Unity bootstrap scene instantiates the composition root and boot controller.")
        connect_one_to_many([r"AppRoot\.prefab$"], [r"AppManager\.cs$", r"NavigationManager\.cs$", r".*Manager\.cs$", r".*Controller\.cs$"], "binds", "AppRoot prefab binds runtime manager scripts into the scene hierarchy.", 24)
        connect_one_to_many([r"BootSceneController\.cs$"], [r"AppManager\.cs$", r"AppConfig\.cs$", r"StateStore\.cs$"], "wires", "Boot scene controller wires the core runtime services.")
        connect_one_to_many([r"AppManager\.cs$"], [r"AppConfig\.cs$", r"StateStore\.cs$", r"NavigationManager\.cs$", r".*Manager\.cs$", r".*Service\.cs$", r".*Repository\.cs$"], "manages", "AppManager coordinates Unity services, state and managers.", 36)
        connect_one_to_many([r"NavigationManager\.cs$"], [r".*Screen.*\.cs$", r".*View.*\.cs$", r".*Controller\.cs$", r".*\.uxml$", r".*\.uss$"], "routes-to", "NavigationManager routes to generated UI controllers and UI Toolkit resources.", 28)
        connect_one_to_many([r"AnalyticsManager\.cs$"], [r"AnalyticsEvent\.cs$", r"AnalyticsConfig\.json$", r"Analytics.*Adapter\.cs$"], "tracks", "Analytics manager tracks typed events through config and adapters.", 16)
        connect_one_to_many([r"AuthManager\.cs$"], [r"AuthRepository\.cs$", r"AuthState\.cs$", r"AuthToken.*\.cs$", r"Auth.*Gateway\.cs$"], "uses-repository", "Auth manager coordinates repository, state and token boundaries.", 20)

    if profile_id == "ios" or any(path.lower().endswith("app.swift") for path in files):
        connect_one_to_many([r".*App\.swift$"], [r"AppCoordinator\.swift$", r"AppState\.swift$", r"AppEnvironment\.swift$"], "wires", "SwiftUI app entry wires coordinator, state and environment.")
        connect_one_to_many([r"AppCoordinator\.swift$"], [r"NavigationRoute\.swift$", r".*View\.swift$", r".*Screen\.swift$", r".*ViewModel\.swift$"], "routes-to", "Coordinator routes to SwiftUI screens and view models.", 32)
        connect_one_to_many([r"Localization.*\.swift$"], [r"Localizable\.xcstrings$"], "resolves", "Localization manager resolves strings from the generated xcstrings resource.")

    if profile_id == "flutter" or any(path.lower().endswith("main.dart") for path in files):
        connect_one_to_many([r"main\.dart$"], [r"app\.dart$", r"env\.dart$"], "wires", "Flutter main entry wires app shell and environment setup.")
        connect_one_to_many([r"app\.dart$"], [r"router\.dart$", r"app_state\.dart$", r".*screen\.dart$", r".*controller\.dart$"], "composes", "Flutter app shell composes router, state and feature screens.", 36)
        connect_one_to_many([r"router\.dart$"], [r".*screen\.dart$", r".*page\.dart$"], "routes-to", "Router maps application routes to generated screens.")
        connect_one_to_many([r"localization.*\.dart$"], [r".*\.arb$"], "resolves", "Localization service resolves generated ARB resources.")

    if profile_id == "react-native" or any(path.lower().endswith("app.tsx") for path in files):
        connect_one_to_many([r"index\.js$"], [r"App\.tsx$"], "wires", "React Native index registers the root App component.")
        connect_one_to_many([r"App\.tsx$"], [r"AppNavigator\.tsx$", r"appState\.ts$", r"env\.ts$"], "composes", "Root App composes navigation, state and environment boundaries.")
        connect_one_to_many([r"AppNavigator\.tsx$"], [r".*Screen\.tsx$", r"routes\.ts$"], "routes-to", "Navigator routes to generated screens.")
        connect_one_to_many([r"localization\.ts$"], [r"en\.json$", r"uk\.json$"], "resolves", "Localization helper resolves generated translation resources.")

    for group_name, module_files in module_groups.items():
        group_sources = [path for path in module_files if classify_graph_node(path) == "source"]
        group_configs = [path for path in module_files if classify_graph_node(path) == "config"]
        group_resources = [path for path in module_files if classify_graph_node(path) in {"resource", "prefab", "scene"}]
        group_docs = [path for path in module_files if classify_graph_node(path) == "documentation"]
        group_owner = best_owner(group_sources, group_name) or (group_sources[0] if group_sources else (module_files[0] if module_files else None))
        if not group_owner:
            continue
        for config in group_configs[:12]:
            add_edge(config, group_owner, "configures", f"{Path(config).name} configures the {group_name} module owner.")
        for resource in group_resources[:12]:
            add_edge(group_owner, resource, "renders", f"{Path(group_owner).name} renders or instantiates {Path(resource).name}.")
        for doc in group_docs[:8]:
            add_edge(doc, group_owner, "documents", f"{Path(doc).name} documents the {group_name} module boundary.")
        for source in group_sources[:18]:
            if source == group_owner:
                continue
            source_role = role(source)
            if source_role == "view":
                add_edge(source, group_owner, "observes", f"{Path(source).name} observes state and services from {Path(group_owner).name}.")
            elif source_role == "repository":
                add_edge(group_owner, source, "persists-through", f"{Path(group_owner).name} persists data through {Path(source).name}.")
            elif source_role == "model":
                add_edge(group_owner, source, "uses-model", f"{Path(group_owner).name} exchanges typed data through {Path(source).name}.")
            elif source_role == "contract":
                add_edge(group_owner, source, "implements", f"{Path(group_owner).name} follows the {Path(source).name} contract.")

    app_composers = root_managers or managers[:4] or source_files[:4]
    for path in files:
        connected = any(edge["from"] == path or edge["to"] == path for edge in edges)
        if connected:
            continue
        owner = best_owner(app_composers + managers + services, path)
        if owner:
            if role(path) in {"configuration", "documentation", "style"}:
                add_edge(path, owner, relation_priority(role(path)), f"{Path(path).name} is part of the generated app contract.")
            else:
                add_edge(owner, path, "composes", f"{Path(owner).name} includes {Path(path).name} in the generated architecture.")

    target_edge_count = max(len(files) * 2, int(len(files) * 1.75))
    density_owners = app_composers + managers + services + repositories + states
    density_index = 0
    while len(edges) < target_edge_count and files and density_index < len(files) * 6:
        path = files[density_index % len(files)]
        owner = best_owner(density_owners, path)
        if owner and owner != path:
            relation = "belongs-to-module" if module(owner) == module(path) else "wires"
            add_edge(owner, path, relation, f"{Path(path).name} is connected to {Path(owner).name} as part of the generated architecture graph.")
        same_module = [candidate for candidate in files if candidate != path and module(candidate) == module(path)]
        peer = best_owner(same_module, path)
        if peer and peer != path:
            relation = relation_priority(role(path))
            add_edge(path if role(path) in {"configuration", "documentation", "style"} else peer, peer if role(path) in {"configuration", "documentation", "style"} else path, relation, f"{Path(path).name} is linked with {Path(peer).name} inside the {module(path)} module.")
        density_index += 1

    if blueprint:
        for relationship in blueprint.get("relationships", []) if isinstance(blueprint.get("relationships"), list) else []:
            if not isinstance(relationship, dict):
                continue
            source = str(relationship.get("from") or "")
            target = str(relationship.get("to") or "")
            relation = str(relationship.get("relation") or "uses")
            reason = str(relationship.get("reason") or "AI blueprint relationship.")
            add_edge(source, target, relation, reason)

    connected_files = {edge["from"] for edge in edges} | {edge["to"] for edge in edges}
    relation_counts: Dict[str, int] = {}
    for edge in edges:
        relation_counts[edge["relation"]] = relation_counts.get(edge["relation"], 0) + 1

    return {
        "schemaVersion": "1.0",
        "generatedBy": "App Architector",
        "summary": {
            "nodes": len(nodes),
            "edges": len(edges),
            "connectedFiles": len(connected_files),
            "isolatedFiles": len(files) - len(connected_files),
            "edgeCoveragePercent": round((len(connected_files) / max(1, len(files))) * 100),
            "relationshipDensity": round(len(edges) / max(1, len(files)), 2),
            "averageEdgesPerFile": round((len(edges) * 2) / max(1, len(files)), 2),
            "sourceFiles": sum(1 for node in nodes if node["kind"] == "source"),
            "resourceFiles": sum(1 for node in nodes if node["kind"] in {"resource", "scene", "prefab"}),
            "modules": sorted({node["module"] for node in nodes}),
            "relations": relation_counts,
        },
        "graph": {
            "nodes": nodes,
            "edges": edges,
        },
        "diagnostics": {
            "missingArtifacts": diagnostics.get("missingArtifacts", []),
            "skippedOutputs": diagnostics.get("skippedOutputs", []),
        },
    }



def blueprint_extension_for(profile: str, kind: str) -> str:
    if kind == "documentation":
        return "md"
    if kind == "config":
        return "json"
    if profile == "ios":
        return "swift"
    if profile == "flutter":
        return "dart"
    if profile == "react-native":
        return "ts"
    return "cs"


def blueprint_source_content(path: str, file_info: Dict[str, Any], module_info: Dict[str, Any], payload: Dict[str, Any]) -> str:
    profile = str(payload.get("profile", {}).get("profile") or "")
    name = Path(path).stem
    description = str(file_info.get("description") or "AI generated blueprint file.")
    role = str(file_info.get("role") or "source boundary")
    module_name = str(module_info.get("name") or file_info.get("module") or "AI Blueprint")
    header = [
        "Generated by App Architector AI blueprint.",
        f"Module: {module_name}",
        f"Role: {role}",
        f"Description: {description}",
    ]
    if path.lower().endswith(".md") or file_info.get("kind") == "documentation":
        return "\n".join([
            f"# {name}",
            "",
            *[f"- {line}" for line in header],
            "",
            str(module_info.get("purpose") or "Documents an AI-proposed architecture boundary."),
            "",
        ])
    if path.lower().endswith((".json", ".yaml", ".yml")) or file_info.get("kind") == "config":
        return json_dumps({
            "generatedBy": "App Architector",
            "module": module_name,
            "role": role,
            "description": description,
            "strategy": payload.get("spec", {}).get("aiBlueprint", {}).get("strategy"),
        })
    if profile == "ios" or path.lower().endswith(".swift"):
        return "\n".join([*(f"// {line}" for line in header), "", f"struct {re.sub(r'[^A-Za-z0-9_]', '', name) or 'AIBoundary'} {{", f"    let role = \"{role}\"", f"    let description = \"{description[:120].replace(chr(34), '\\\"')}\"", "}", ""])
    if profile == "flutter" or path.lower().endswith(".dart"):
        class_name = re.sub(r'[^A-Za-z0-9_]', '', name) or 'AIBoundary'
        return "\n".join([*(f"// {line}" for line in header), "", f"class {class_name} {{", f"  final String role = '{role}';", f"  final String description = '{description[:120].replace(chr(39), '')}';", "}", ""])
    if profile == "react-native" or path.lower().endswith((".ts", ".tsx")):
        const_name = re.sub(r'[^A-Za-z0-9_]', '', name) or 'aiBoundary'
        return "\n".join([*(f"// {line}" for line in header), "", f"export const {const_name} = {{", f"  role: {json.dumps(role)},", f"  description: {json.dumps(description[:160])}", "};", ""])
    class_name = re.sub(r'[^A-Za-z0-9_]', '', name) or 'AIBoundary'
    return "\n".join([*(f"// {line}" for line in header), "", f"public sealed class {class_name}", "{", f"    public string Role => {json.dumps(role)};", f"    public string Description => {json.dumps(description[:160])};", "}", ""])


def write_ai_blueprint_files(output_root: Path, payload: Dict[str, Any], context: Dict[str, Any]) -> List[str]:
    spec = payload.get("spec") if isinstance(payload.get("spec"), dict) else {}
    blueprint = spec.get("aiBlueprint") if isinstance(spec.get("aiBlueprint"), dict) else None
    if not blueprint:
        return []
    profile = str(payload.get("profile", {}).get("profile") or spec.get("profileId") or "")
    generated: List[str] = []
    seen: Set[str] = set()
    for module_info in blueprint.get("modules", []) if isinstance(blueprint.get("modules"), list) else []:
        if not isinstance(module_info, dict):
            continue
        for file_info in module_info.get("files", []) if isinstance(module_info.get("files"), list) else []:
            if not isinstance(file_info, dict):
                continue
            relative_path = str(file_info.get("path") or "").replace("\\", "/").lstrip("/")
            if not relative_path or ".." in relative_path:
                continue
            if not re.search(r"\.[A-Za-z0-9]+$", relative_path):
                relative_path = f"{relative_path}.{blueprint_extension_for(profile, str(file_info.get('kind') or 'source'))}"
            if relative_path in seen:
                continue
            seen.add(relative_path)
            destination = safe_destination(output_root, relative_path, context)
            ensure_parent(destination)
            destination.write_text(blueprint_source_content(relative_path, file_info, module_info, payload), encoding="utf-8")
            generated.append(str(destination.relative_to(output_root)))
    return sorted(generated)

def write_metadata_files(output_root: Path, payload: Dict[str, Any], diagnostics: Dict[str, Any]) -> None:
    architecture_root = output_root / "architecture"
    architecture_root.mkdir(parents=True, exist_ok=True)
    write_json(architecture_root / "file-relationships.graph.json", build_relationship_graph(output_root, payload, diagnostics))


def write_profile_specific_stub(output_root: Path, profile: str, context: Dict[str, Any]) -> List[str]:
    generated: List[str] = []
    project_pascal = context.get("projectPascal") or context.get("project_pascal") or "GeneratedApp"

    if profile == "ios":
        path = output_root / f"{project_pascal}.xcodeproj" / "project.pbxproj"
        if not path.exists():
            ensure_parent(path)
            path.write_text("// Placeholder Xcode project generated by baseline mode\n", encoding="utf-8")
            generated.append(str(path.relative_to(output_root)))
    elif profile == "unity":
        path = output_root / "Assets" / "Scenes" / "SampleScene.unity"
        if not path.exists():
            ensure_parent(path)
            path.write_text("%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n", encoding="utf-8")
            generated.append(str(path.relative_to(output_root)))

    return generated


def write_hybrid_refinements(output_root: Path, payload: Dict[str, Any], context: Dict[str, Any]) -> List[str]:
    refinement = payload.get("hybridRefinement")
    if not isinstance(refinement, dict):
        return []

    accepted_patches = refinement.get("acceptedPatches")
    if not isinstance(accepted_patches, list):
        return []

    generated: List[str] = []
    for patch in accepted_patches:
        if not isinstance(patch, dict):
            continue

        relative_path = patch.get("path")
        content = patch.get("content")
        operation = patch.get("operation")
        if not isinstance(relative_path, str) or not isinstance(content, str):
            continue

        destination = safe_destination(output_root, relative_path, context)
        ensure_parent(destination)
        rendered_content = content.rstrip() + "\n"

        if operation == "append-section" and destination.exists():
            current = destination.read_text(encoding="utf-8").rstrip()
            marker = "<!-- mag:hybrid-refinement -->"
            destination.write_text(f"{current}\n\n{marker}\n{rendered_content}", encoding="utf-8")
        else:
            destination.write_text(rendered_content, encoding="utf-8")

        generated.append(str(destination.relative_to(output_root)))

    return sorted(set(generated))


def zip_directory(source_dir: Path, zip_path: Path) -> None:
    ensure_parent(zip_path)
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted(source_dir.rglob("*")):
            archive.write(file_path, file_path.relative_to(source_dir.parent))


def failure_root_from_payload(payload: Dict[str, Any]) -> Path:
    output_dir = payload.get("outputDir")
    manifest = payload.get("manifest") if isinstance(payload.get("manifest"), dict) else {}
    root_name = manifest.get("rootFolderName") or "generation-failed"
    if output_dir:
        return Path(str(output_dir)) / str(root_name)
    return Path.cwd() / "generation-failed"


def write_failure_diagnostics(payload: Dict[str, Any], error: BaseException) -> None:
    root = failure_root_from_payload(payload)
    root.mkdir(parents=True, exist_ok=True)
    code = getattr(error, "code", "GENERATOR_RUNTIME_ERROR")
    details = getattr(error, "details", {})
    diagnostics = {
        "status": "failed",
        "code": code,
        "message": str(error),
        "details": details,
        "generationId": payload.get("generationId"),
        "profileId": payload.get("profile", {}).get("profile") if isinstance(payload.get("profile"), dict) else None,
        "traceback": traceback.format_exc(),
        "createdAt": now_iso(),
    }
    metadata_root = root / ".mag"
    metadata_root.mkdir(parents=True, exist_ok=True)
    write_json(metadata_root / "generation-diagnostics.json", diagnostics)
    write_json(metadata_root / "generation-input.json", {
        "generationId": payload.get("generationId"),
        "outputDir": payload.get("outputDir"),
        "zipPath": payload.get("zipPath"),
        "profile": payload.get("profile"),
        "manifestSummary": payload.get("manifest", {}).get("summary") if isinstance(payload.get("manifest"), dict) else None,
        "advisorStatus": payload.get("advisorReport", {}).get("status") if isinstance(payload.get("advisorReport"), dict) else None,
    })
    if payload.get("advisorReport") is not None:
        write_json(metadata_root / "architecture-advisor.json", payload.get("advisorReport", {}))


def parse_payload() -> Dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        raise GeneratorError("EMPTY_PAYLOAD", "Generator payload is empty")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise GeneratorError("PAYLOAD_JSON_INVALID", f"Generator payload is not valid JSON: {exc}") from exc


def main() -> int:
    payload: Dict[str, Any] = {}
    try:
        payload = parse_payload()
        profile = payload["profile"]
        manifest = payload["manifest"]
        context = payload["templateContext"]
        output_root = Path(payload["outputDir"]) / manifest["rootFolderName"]
        zip_path = Path(payload["zipPath"])

        if output_root.exists():
            shutil.rmtree(output_root)
        output_root.mkdir(parents=True, exist_ok=True)

        artifact_ids = [artifact["id"] for artifact in manifest.get("artifacts", [])]
        generated_files, missing_artifacts, skipped_outputs = write_registry_outputs(
            output_root,
            profile["profile"],
            artifact_ids,
            context,
        )
        generated_files.extend(write_profile_specific_stub(output_root, profile["profile"], context))
        blueprint_files = write_ai_blueprint_files(output_root, payload, context)
        generated_files.extend(blueprint_files)
        hybrid_files = write_hybrid_refinements(output_root, payload, context)
        generated_files.extend(hybrid_files)
        diagnostics = {
            "status": "passed" if not missing_artifacts else "warning",
            "generationId": payload.get("generationId"),
            "profileId": profile.get("profile"),
            "artifactIds": artifact_ids,
            "generatedFileCount": len(generated_files),
            "generatedFiles": sorted(generated_files),
            "aiBlueprintFiles": blueprint_files,
            "hybridRefinementFiles": hybrid_files,
            "missingRegistryArtifacts": missing_artifacts,
            "skippedOutputs": skipped_outputs,
            "outputRoot": str(output_root),
            "zipPath": str(zip_path),
            "createdAt": now_iso(),
        }
        write_metadata_files(output_root, payload, diagnostics)
        zip_directory(output_root, zip_path)
        print(json_dumps({"status": "ok", "zipPath": str(zip_path), "generatedFileCount": len(generated_files)}).strip())
        return 0
    except Exception as exc:
        write_failure_diagnostics(payload, exc)
        code = getattr(exc, "code", "GENERATOR_RUNTIME_ERROR")
        details = getattr(exc, "details", {})
        print(json_dumps({"status": "error", "code": code, "message": str(exc), "details": details}).strip(), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
