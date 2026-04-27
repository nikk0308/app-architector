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
from typing import Any, Dict, Iterable, List, Tuple

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
            destination = safe_destination(output_root, output["path"], context)
            ensure_parent(destination)
            if "literal" in output:
                destination.write_text(str(output["literal"]), encoding="utf-8")
            else:
                template_name = output.get("template")
                if not template_name:
                    skipped_outputs.append({"artifactId": artifact_id, "reason": "output has no literal or template"})
                    continue
                template_path = TEMPLATES_ROOT / template_name
                destination.write_text(render_template(template_path, context), encoding="utf-8")
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


def write_metadata_files(output_root: Path, payload: Dict[str, Any], diagnostics: Dict[str, Any]) -> None:
    metadata_root = output_root / ".mag"
    metadata_root.mkdir(parents=True, exist_ok=True)
    write_json(metadata_root / "normalized-profile.json", payload.get("profile", {}))
    write_json(metadata_root / "architecture-spec.json", payload.get("spec", {}))
    write_json(metadata_root / "artifact-manifest.json", payload.get("manifest", {}))
    write_json(metadata_root / "validation-report.json", payload.get("validation", {}))
    write_json(metadata_root / "generation-plan.json", payload.get("generationPlan", payload.get("generation_plan", payload.get("plan", {}))))
    write_json(metadata_root / "legacy-plan.json", payload.get("plan", {}))
    write_json(metadata_root / "template-context.json", payload.get("templateContext", {}))
    write_json(metadata_root / "generation-input.json", {
        "generationId": payload.get("generationId"),
        "outputDir": payload.get("outputDir"),
        "zipPath": payload.get("zipPath"),
        "profileId": payload.get("profile", {}).get("profile") if isinstance(payload.get("profile"), dict) else None,
        "artifactCount": len(payload.get("manifest", {}).get("artifacts", [])) if isinstance(payload.get("manifest"), dict) else 0,
    })
    write_json(metadata_root / "file-tree.json", collect_file_tree(output_root))
    write_json(metadata_root / "generation-diagnostics.json", diagnostics)


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
    })


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
        diagnostics = {
            "status": "passed" if not missing_artifacts else "warning",
            "generationId": payload.get("generationId"),
            "profileId": profile.get("profile"),
            "artifactIds": artifact_ids,
            "generatedFileCount": len(generated_files),
            "generatedFiles": sorted(generated_files),
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
