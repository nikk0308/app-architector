#!/usr/bin/env python3
from __future__ import annotations

import base64
import os
import stat
import subprocess
import sys
from pathlib import Path


def normalize(value: str) -> str:
    value = value.strip()
    if value.startswith(('"', "'")) and value.endswith(('"', "'")) and len(value) >= 2:
        value = value[1:-1]
    if "\\n" in value and "BEGIN " in value and "PRIVATE KEY" in value:
        value = value.replace("\\r\\n", "\n").replace("\\n", "\n")
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    return value.strip() + "\n"


def main() -> int:
    raw = os.environ.get("DEPLOY_SSH_PRIVATE_KEY", "")
    if not raw.strip():
        print("DEPLOY_SSH_PRIVATE_KEY is empty", file=sys.stderr)
        return 1

    raw = raw.strip()
    if raw.startswith("PuTTY-User-Key-File-"):
        print("PuTTY .ppk keys are not supported. Use an OpenSSH private key.", file=sys.stderr)
        return 1

    if "BEGIN " in raw and "PRIVATE KEY" in raw:
        key_text = normalize(raw)
    else:
        try:
            decoded = base64.b64decode(raw, validate=True).decode("utf-8")
        except Exception as exc:
            print(f"Cannot decode DEPLOY_SSH_PRIVATE_KEY: {exc}", file=sys.stderr)
            return 1
        key_text = normalize(decoded)

    ssh_dir = Path.home() / ".ssh"
    ssh_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(ssh_dir, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)

    key_path = ssh_dir / "deploy_key"
    key_path.write_text(key_text, encoding="utf-8", newline="\n")
    os.chmod(key_path, stat.S_IRUSR | stat.S_IWUSR)

    try:
        subprocess.run(
            ["ssh-keygen", "-y", "-f", str(key_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        print(f"Invalid private key format: {stderr}", file=sys.stderr)
        return 1

    print(str(key_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
