#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen


EXPECTED_SERVICES = {"api", "web"}


def run(command: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=check,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def parse_rows(raw: str) -> list[dict]:
    stripped = raw.strip()
    if not stripped:
        return []
    try:
        value = json.loads(stripped)
        return value if isinstance(value, list) else [value]
    except json.JSONDecodeError:
        return [json.loads(line) for line in stripped.splitlines()]


def wait_for_stack(base: list[str], deadline: float) -> None:
    last_rows: list[dict] = []
    while time.monotonic() < deadline:
        result = run(base + ["ps", "-a", "--format", "json"], check=False)
        if result.returncode == 0:
            try:
                rows = parse_rows(result.stdout)
            except (json.JSONDecodeError, TypeError):
                rows = []
            last_rows = rows
            by_service = {str(row.get("Service", "")): row for row in rows}
            if set(by_service) == EXPECTED_SERVICES and all(
                str(row.get("State", "")).lower() == "running"
                and str(row.get("Health", "")).lower() == "healthy"
                for row in rows
            ):
                return
        time.sleep(3)
    logs = run(base + ["logs", "--no-color", "--tail", "200"], check=False)
    raise RuntimeError(
        "Stack did not become healthy.\n"
        f"{json.dumps(last_rows, indent=2)}\n\n{logs.stdout}"
    )


def assert_http(url: str, contains: str, deadline: float) -> None:
    last_error = "not attempted"
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=5) as response:
                body = response.read().decode("utf-8", errors="replace")
                if response.status == 200 and contains in body:
                    print(f"PASS {url}")
                    return
                last_error = f"HTTP {response.status}: {body[:200]}"
        except (OSError, URLError) as error:
            last_error = str(error)
        time.sleep(2)
    raise RuntimeError(f"Smoke test failed for {url}: {last_error}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compose-file", required=True)
    parser.add_argument("--runtime-env", required=True)
    parser.add_argument("--deploy-env", required=True)
    parser.add_argument("--project", default="apparchitector")
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args()

    base = [
        "docker",
        "compose",
        "-p",
        args.project,
        "--env-file",
        args.runtime_env,
        "--env-file",
        args.deploy_env,
        "-f",
        args.compose_file,
    ]
    deadline = time.monotonic() + args.timeout

    try:
        wait_for_stack(base, deadline)
        assert_http(
            "http://127.0.0.1:3100/health",
            '"service":"app-architector-web"',
            deadline,
        )
        assert_http(
            "http://127.0.0.1:3100/api/health/ready",
            '"status":"ready"',
            deadline,
        )
        print("PASS App Architector stack")
        return 0
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
