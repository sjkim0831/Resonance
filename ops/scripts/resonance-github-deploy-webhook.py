#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")


def valid_signature(secret: bytes, body: bytes, supplied: str) -> bool:
    expected = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, supplied)


class DeployWebhookHandler(BaseHTTPRequestHandler):
    server_version = "ResonanceDeployWebhook/1"

    def log_message(self, fmt: str, *args: object) -> None:
        print("[deploy-webhook] " + (fmt % args), flush=True)

    def respond(self, status: int, payload: dict[str, object]) -> None:
        encoded = json.dumps(payload, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:
        if self.path == "/health":
            self.respond(200, {"status": "UP"})
        else:
            self.respond(404, {"error": "not_found"})

    def do_POST(self) -> None:
        if self.path != "/hooks/github/deploy":
            self.respond(404, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.respond(400, {"error": "invalid_content_length"})
            return
        if length <= 0 or length > self.server.max_body_bytes:  # type: ignore[attr-defined]
            self.respond(413, {"error": "invalid_body_size"})
            return

        body = self.rfile.read(length)
        signature = self.headers.get("X-Hub-Signature-256", "")
        if not valid_signature(self.server.secret, body, signature):  # type: ignore[attr-defined]
            self.respond(401, {"error": "invalid_signature"})
            return
        if self.headers.get("X-GitHub-Event") != "push":
            self.respond(202, {"status": "ignored", "reason": "event"})
            return

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.respond(400, {"error": "invalid_json"})
            return
        repository = payload.get("repository", {}).get("full_name")
        ref = payload.get("ref")
        revision = payload.get("after", "")
        if (
            repository != self.server.repository  # type: ignore[attr-defined]
            or ref != "refs/heads/main"
            or not SHA_PATTERN.fullmatch(revision)
        ):
            self.respond(202, {"status": "ignored", "reason": "scope"})
            return

        delivery = self.headers.get("X-GitHub-Delivery", "")
        if not re.fullmatch(r"[A-Za-z0-9-]{8,80}", delivery):
            self.respond(400, {"error": "invalid_delivery"})
            return
        delivery_file = self.server.delivery_dir / delivery  # type: ignore[attr-defined]
        try:
            delivery_file.touch(exist_ok=False)
        except FileExistsError:
            self.respond(202, {"status": "duplicate", "delivery": delivery})
            return

        desired_file = self.server.desired_revision_file  # type: ignore[attr-defined]
        temporary = desired_file.with_name(f".{delivery}.tmp")
        temporary.write_text(revision + "\n", encoding="ascii")
        os.replace(temporary, desired_file)
        result = subprocess.run(
            ["sudo", "-n", "systemctl", "start", "--no-block",
             "carbonet-auto-deploy.service"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            delivery_file.unlink(missing_ok=True)
            self.respond(503, {"error": "dispatch_failed"})
            return
        self.respond(202, {
            "status": "accepted",
            "delivery": delivery,
            "revision": revision,
        })


def self_test() -> None:
    secret = b"test-secret"
    body = b'{"ref":"refs/heads/main"}'
    signature = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()
    assert valid_signature(secret, body, signature)
    assert not valid_signature(secret, body + b"x", signature)
    assert SHA_PATTERN.fullmatch("a" * 40)
    assert not SHA_PATTERN.fullmatch("a" * 39)
    with tempfile.TemporaryDirectory() as directory:
        target = Path(directory) / "desired"
        target.write_text("a" * 40 + "\n", encoding="ascii")
        assert target.read_text(encoding="ascii").strip() == "a" * 40
    print("GITHUB_DEPLOY_WEBHOOK_SELF_TEST_PASS")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9088)
    parser.add_argument("--secret-file",
                        default="/etc/resonance/github-deploy-webhook.secret")
    parser.add_argument("--repository", default="sjkim0831/Resonance")
    parser.add_argument("--state-dir",
                        default="/opt/resonance-data/deploy/github-webhook")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return

    secret = Path(args.secret_file).read_bytes().strip()
    if len(secret) < 32:
        raise SystemExit("webhook secret must contain at least 32 bytes")
    state_dir = Path(args.state_dir)
    delivery_dir = state_dir / "deliveries"
    delivery_dir.mkdir(parents=True, exist_ok=True)
    desired_revision_file = state_dir / "desired-revision"

    server = ThreadingHTTPServer((args.host, args.port), DeployWebhookHandler)
    server.secret = secret  # type: ignore[attr-defined]
    server.repository = args.repository  # type: ignore[attr-defined]
    server.delivery_dir = delivery_dir  # type: ignore[attr-defined]
    server.desired_revision_file = desired_revision_file  # type: ignore[attr-defined]
    server.max_body_bytes = 2 * 1024 * 1024  # type: ignore[attr-defined]
    print(f"[deploy-webhook] listening on {args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
