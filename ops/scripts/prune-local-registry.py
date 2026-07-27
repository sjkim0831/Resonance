#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request

registry = os.environ.get("REGISTRY_URL", "http://127.0.0.1:5000").rstrip("/")
repository = os.environ.get("REGISTRY_REPOSITORY", "carbonet-runtime")
keep_recent = max(2, int(os.environ.get("REGISTRY_KEEP_RECENT", "12")))
explicit_keep = {
    value.strip()
    for value in os.environ.get("REGISTRY_KEEP_TAGS", "").split(",")
    if value.strip()
}


def request(path: str, method: str = "GET", headers: dict | None = None):
    req = urllib.request.Request(
        f"{registry}{path}", method=method, headers=headers or {}
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return response, response.read()


_, body = request(f"/v2/{repository}/tags/list")
tags = json.loads(body).get("tags") or []
dated = sorted(tag for tag in tags if tag.endswith("-gradle"))
keep = set(dated[-keep_recent:]) | explicit_keep
delete = [tag for tag in dated if tag not in keep]

deleted = []
failed = []
accept = {"Accept": "application/vnd.docker.distribution.manifest.v2+json"}
for tag in delete:
    try:
        response, _ = request(f"/v2/{repository}/manifests/{tag}", headers=accept)
        digest = response.headers.get("Docker-Content-Digest")
        if not digest:
            raise RuntimeError("manifest digest missing")
        request(f"/v2/{repository}/manifests/{digest}", method="DELETE", headers=accept)
        deleted.append(tag)
    except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError) as exc:
        failed.append({"tag": tag, "error": str(exc)})

print(
    json.dumps(
        {
            "repository": repository,
            "tagCount": len(tags),
            "datedTagCount": len(dated),
            "keptDatedTags": sorted(keep & set(dated)),
            "deletedCount": len(deleted),
            "failed": failed,
        },
        ensure_ascii=False,
    )
)
if failed:
    raise SystemExit(1)
