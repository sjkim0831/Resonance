#!/usr/bin/env python3
"""Keep the GitHub deploy webhook aligned with the current quick-tunnel URL."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

REPOSITORY = "sjkim0831/Resonance"
HOOK_PATH = "/hooks/github/deploy"
URL_PATTERN = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
STATE_DIR = Path("/opt/resonance-data/deploy/github-webhook")
PUBLIC_URL_FILE = STATE_DIR / "public-url"
HOOK_ID_FILE = STATE_DIR / "github-hook-id"
CONTAINER = os.environ.get(
    "GITHUB_DEPLOY_WEBHOOK_TUNNEL_CONTAINER",
    "resonance-deploy-webhook-tunnel",
)
TUNNEL_IMAGE = os.environ.get(
    "GITHUB_DEPLOY_WEBHOOK_TUNNEL_IMAGE",
    "cloudflare/cloudflared:latest",
)


def run(*args: str, input_text: str | None = None) -> str:
    result = subprocess.run(
        args,
        input=input_text,
        text=True,
        capture_output=True,
        check=True,
        timeout=20,
    )
    return result.stdout


def current_tunnel_url() -> str:
    ensure_tunnel()
    deadline = time.monotonic() + 45
    last_logs = ""
    while time.monotonic() < deadline:
        result = subprocess.run(
            ("sudo", "-n", "docker", "logs", CONTAINER),
            text=True,
            capture_output=True,
            check=True,
            timeout=20,
        )
        last_logs = result.stdout + result.stderr
        matches = URL_PATTERN.findall(last_logs)
        if matches:
            return matches[-1]
        time.sleep(1)
    raise RuntimeError("quick tunnel URL unavailable after 45 seconds")


def tailscale_funnel_url() -> str | None:
    result = subprocess.run(
        ("tailscale", "funnel", "status", "--json"),
        text=True,
        capture_output=True,
        check=False,
        timeout=20,
    )
    if result.returncode != 0:
        return None
    try:
        status = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    allowed = status.get("AllowFunnel", {})
    for host, config in status.get("Web", {}).items():
        handlers = config.get("Handlers", {})
        if (
            allowed.get(host) is True
            and handlers.get("/", {}).get("Proxy") == "http://127.0.0.1:9088"
        ):
            return f"https://{host.removesuffix(':443')}"
    return None


def remove_quick_tunnel() -> None:
    subprocess.run(
        ("sudo", "-n", "docker", "rm", "-f", CONTAINER),
        text=True,
        capture_output=True,
        check=False,
        timeout=20,
    )


def ensure_tunnel() -> None:
    result = subprocess.run(
        (
            "sudo", "-n", "docker", "inspect", "-f",
            "{{.State.Running}}", CONTAINER,
        ),
        text=True,
        capture_output=True,
        check=False,
        timeout=20,
    )
    if result.returncode == 0 and result.stdout.strip() == "true":
        return
    subprocess.run(
        ("sudo", "-n", "docker", "rm", "-f", CONTAINER),
        text=True,
        capture_output=True,
        check=False,
        timeout=20,
    )
    run(
        "sudo", "-n", "docker", "run", "-d",
        "--name", CONTAINER,
        "--restart", "unless-stopped",
        "--network", "host",
        TUNNEL_IMAGE,
        "tunnel", "--no-autoupdate", "--protocol", "http2",
        "--url", "http://127.0.0.1:9088",
    )


def wait_public_health(tunnel_url: str) -> None:
    deadline = time.monotonic() + 45
    consecutive_successes = 0
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(
                f"{tunnel_url}/health", timeout=5
            ) as response:
                payload = json.loads(response.read())
                if response.status == 200 and payload.get("status") == "UP":
                    consecutive_successes += 1
                    if consecutive_successes >= 3:
                        return
                    time.sleep(1)
                    continue
        except (urllib.error.URLError, json.JSONDecodeError):
            pass
        consecutive_successes = 0
        time.sleep(1)
    raise RuntimeError("quick tunnel public health unavailable after 45 seconds")


def github_token() -> str:
    output = run(
        "git",
        "credential",
        "fill",
        input_text="protocol=https\nhost=github.com\n\n",
    )
    values = dict(
        line.split("=", 1) for line in output.splitlines() if "=" in line
    )
    token = values.get("password", "")
    if not token:
        raise RuntimeError("GitHub credential unavailable")
    return token


def api(token: str, method: str, path: str, payload: dict | None = None):
    body = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        f"https://api.github.com{path}",
        data=body,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "resonance-webhook-reconciler",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        data = response.read()
        return json.loads(data) if data else {}


def resolve_hook_id(token: str) -> int:
    if HOOK_ID_FILE.exists():
        value = HOOK_ID_FILE.read_text().strip()
        if value.isdigit():
            return int(value)
    hooks = api(token, "GET", f"/repos/{REPOSITORY}/hooks?per_page=100")
    matches = [
        hook for hook in hooks
        if str(hook.get("config", {}).get("url", "")).endswith(HOOK_PATH)
    ]
    if len(matches) != 1:
        raise RuntimeError(f"expected one deploy webhook, found {len(matches)}")
    hook_id = int(matches[0]["id"])
    atomic_write(HOOK_ID_FILE, f"{hook_id}\n")
    return hook_id


def atomic_write(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", dir=path.parent, delete=False, encoding="utf-8"
    ) as handle:
        handle.write(value)
        temporary = Path(handle.name)
    os.replace(temporary, path)


def main() -> int:
    stable_funnel = tailscale_funnel_url()
    tunnel_url = stable_funnel or current_tunnel_url()
    wait_public_health(tunnel_url)
    expected = f"{tunnel_url}{HOOK_PATH}"
    token = github_token()
    hook_id = resolve_hook_id(token)
    hook = api(token, "GET", f"/repos/{REPOSITORY}/hooks/{hook_id}")
    actual = hook.get("config", {}).get("url", "")
    if actual != expected:
        api(
            token,
            "PATCH",
            f"/repos/{REPOSITORY}/hooks/{hook_id}/config",
            {"url": expected, "content_type": "json", "insecure_ssl": "0"},
        )
        status = "updated"
    else:
        status = "unchanged"
    atomic_write(PUBLIC_URL_FILE, f"{tunnel_url}\n")
    if stable_funnel:
        remove_quick_tunnel()
        transport = "tailscale"
    else:
        transport = "cloudflare-fallback"
    print(
        f"GITHUB_WEBHOOK_URL_SYNC_PASS status={status} transport={transport}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.SubprocessError, urllib.error.URLError) as error:
        print(f"GITHUB_WEBHOOK_URL_SYNC_FAIL reason={error}", file=sys.stderr)
        raise SystemExit(1)
