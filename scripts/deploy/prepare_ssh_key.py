#!/usr/bin/env python3
from __future__ import annotations

import base64
import os
import stat
import sys
from pathlib import Path


def main() -> int:
    raw = os.environ.get("DEPLOY_SSH_PRIVATE_KEY", "").strip()
    if not raw:
        print("DEPLOY_SSH_PRIVATE_KEY is empty", file=sys.stderr)
        return 1

    if "BEGIN " in raw and "PRIVATE KEY" in raw:
        key_text = raw
    else:
        try:
            key_text = base64.b64decode(raw, validate=True).decode("utf-8")
        except Exception as exc:
            print(f"Cannot decode DEPLOY_SSH_PRIVATE_KEY: {exc}", file=sys.stderr)
            return 1

    ssh_dir = Path.home() / ".ssh"
    ssh_dir.mkdir(parents=True, exist_ok=True)
    key_path = ssh_dir / "deploy_key"
    key_path.write_text(key_text, encoding="utf-8")
    os.chmod(key_path, stat.S_IRUSR | stat.S_IWUSR)
    print(str(key_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
