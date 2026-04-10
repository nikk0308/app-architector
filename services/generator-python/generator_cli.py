#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import sys
import zipfile
from pathlib import Path
from string import Template
from typing import Any


def read_payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("Generator payload is empty")
    return json.loads(raw)


def render_template(template_path: Path, context: dict[str, str]) -> str:
    template_text = template_path.read_text(encoding="utf-8")
    return Template(template_text).safe_substitute(context)


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def build_tree(base_dir: Path) -> list[dict[str, str]]:
    nodes: list[dict[str, str]] = []
    for current_path in sorted(base_dir.rglob("*")):
      rel = current_path.relative_to(base_dir).as_posix()
      nodes.append({
          "path": rel,
          "type": "directory" if current_path.is_dir() else "file"
      })
    return nodes


def zip_directory(source_dir: Path, zip_path: Path) -> None:
    ensure_parent(zip_path)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for current_path in sorted(source_dir.rglob("*")):
            if current_path.is_file():
                archive.write(current_path, current_path.relative_to(source_dir))


def resolve_outputs(registry: list[dict[str, Any]], artifact_ids: list[str], profile_id: str) -> list[dict[str, str]]:
    resolved: list[dict[str, str]] = []
    for artifact_id in artifact_ids:
        entry = next((item for item in registry if item["id"] == artifact_id), None)
        if not entry:
            raise RuntimeError(f"Artifact not found in registry: {artifact_id}")
        outputs = entry.get("outputs", {}).get(profile_id, [])
        resolved.extend(outputs)
    return resolved


def apply_tokens(raw_path: str, context: dict[str, str]) -> str:
    return Template(raw_path).safe_substitute(context)


def generate(payload: dict[str, Any]) -> dict[str, Any]:
    generation_id = payload["generationId"]
    profile = payload["profile"]
    plan = payload["plan"]
    context: dict[str, str] = payload["templateContext"]
    output_root = Path(payload["outputRoot"]).resolve()
    registry_path = Path(payload["registryPath"]).resolve()
    template_root = Path(payload["templateRoot"]).resolve()

    output_dir = output_root / generation_id
    project_dir = output_dir / context["project_slug"]
    zip_path = output_root / f"{generation_id}.zip"

    if output_dir.exists():
        shutil.rmtree(output_dir)
    if zip_path.exists():
        zip_path.unlink()

    output_dir.mkdir(parents=True, exist_ok=True)
    project_dir.mkdir(parents=True, exist_ok=True)

    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    artifact_ids = [artifact["id"] for artifact in plan["artifacts"]]
    outputs = resolve_outputs(registry, artifact_ids, profile["profile"])

    for output in outputs:
        relative_output = apply_tokens(output["path"], context)
        template_path = template_root / output["template"]
        target_path = project_dir / relative_output
        ensure_parent(target_path)
        rendered = render_template(template_path, context)
        target_path.write_text(rendered, encoding="utf-8")

    tree = build_tree(project_dir)
    zip_directory(project_dir, zip_path)

    return {
        "outputDir": str(project_dir),
        "zipPath": str(zip_path),
        "fileTree": tree,
        "fileCount": len([node for node in tree if node["type"] == "file"])
    }


if __name__ == "__main__":
    try:
        payload = read_payload()
        result = generate(payload)
        print(json.dumps(result))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
