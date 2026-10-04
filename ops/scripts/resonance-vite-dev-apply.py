#!/usr/bin/env python3
"""Apply an explicit frontend patch to a verified, running Linux Vite worktree.

No authentication bypass, database writes, dependency installation or restart.
Default is inspection; --apply enables writes. Never substitutes the legacy
Kubernetes overlay path for a running Vite source tree.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import tempfile
import urllib.request


PREFIX = "projects/carbonet-frontend/source/src/"


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], stderr=subprocess.PIPE)


def changed_paths(root, patch):
    text = patch.read_text(encoding="utf-8")
    if any(line.startswith(("deleted file mode", "rename from", "rename to", "copy from", "copy to", "GIT binary patch")) or
           (line.startswith(("new file mode", "old mode", "new mode")) and not line.endswith("100644"))
           for line in text.splitlines()):
        raise ValueError("Deletion, rename, symlink, executable and binary changes require separate review")
    entries = git(root, "apply", "--numstat", "-z", str(patch)).split(b"\0")
    paths = []
    for entry in entries:
        if not entry:
            continue
        fields = entry.decode("utf-8").split("\t", 2)
        if len(fields) != 3 or not fields[0].isdigit() or not fields[1].isdigit():
            raise ValueError("Only regular text-file changes are supported")
        name = fields[2]
        path = PurePosixPath(name)
        if not name.startswith(PREFIX) or ".." in path.parts or path.is_absolute():
            raise ValueError("Patch must contain frontend src files only: " + name)
        target = root / name
        if not target.resolve().is_relative_to(root):
            raise ValueError("Symlink escapes repository: " + name)
        paths.append(name)
    if not paths:
        raise ValueError("Empty patch")
    return sorted(set(paths))


def verify_vite(root, pid, port):
    proc = Path("/proc") / str(pid)
    cwd = (proc / "cwd").resolve(strict=True)
    source = (root / "projects/carbonet-frontend/source").resolve()
    args = (proc / "cmdline").read_bytes().split(b"\0")
    if cwd != source or not any(b"vite/bin/vite.js" in arg for arg in args):
        raise ValueError("PID does not run Vite from the selected repository")
    expected_port = str(port).encode()
    port_matches = any(arg == b"--port=" + expected_port for arg in args)
    port_matches |= any(arg == b"--port" and i + 1 < len(args) and args[i + 1] == expected_port for i, arg in enumerate(args))
    if not port_matches:
        raise ValueError("Explicit Vite process port does not match")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(f"http://127.0.0.1:{port}/@vite/client", timeout=5) as response:
        body = response.read()
        if response.status != 200 or "javascript" not in response.headers.get("Content-Type", "") or b"WebSocket" not in body:
            raise ValueError("Vite client verification failed (HTML fallback is not accepted)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("patch", type=Path, nargs="?")
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--apply", action="store_true")
    opts = parser.parse_args()
    root = opts.root.resolve(strict=True)
    if Path(git(root, "rev-parse", "--show-toplevel").decode().strip()).resolve() != root:
        raise ValueError("root must be the exact Git top level")
    verify_vite(root, opts.pid, opts.port)
    if opts.patch is None:
        if opts.apply:
            raise ValueError("--apply requires a patch")
        print(json.dumps({"status":"VITE_SOURCE_VERIFIED", "root":str(root), "port":opts.port, "writes":0}))
        return
    patch = opts.patch.resolve(strict=True)
    paths = changed_paths(root, patch)
    git(root, "apply", "--check", str(patch))
    result = {"mode": "VITE_SOURCE", "root": str(root), "port": opts.port,
              "paths": paths, "patchSha256": hashlib.sha256(patch.read_bytes()).hexdigest(),
              "status": "READY", "runtimeVerified": False}
    if opts.apply:
        # Preserve exact preexisting content, including unrelated dirty edits.
        backup = Path(tempfile.mkdtemp(prefix="resonance-vite-before-"))
        os.chmod(backup, 0o700)
        for name in paths:
            source = root / name
            if source.is_file():
                dest = backup / name
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(source.read_bytes())
        (backup / "manifest.json").write_text(json.dumps({name: (root / name).exists() for name in paths}))
        verify_vite(root, opts.pid, opts.port)
        git(root, "apply", str(patch))
        result.update(status="SOURCE_APPLIED_BROWSER_CHECK_REQUIRED", backup=str(backup))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
