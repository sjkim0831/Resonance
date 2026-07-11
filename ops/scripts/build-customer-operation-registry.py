#!/usr/bin/env python3
"""Capture non-secret Ubuntu, Kubernetes, and Patroni evidence for Customer Trace."""
from __future__ import annotations

import argparse, hashlib, json, platform, re, subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

SAFE_NAME = re.compile(r"[^A-Z0-9]+")

def run(command: list[str], timeout: int = 30) -> tuple[int, str]:
    try:
        result = subprocess.run(command, text=True, capture_output=True, timeout=timeout, check=False)
        return result.returncode, result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return 127, ""

def asset_id(kind: str, namespace: str, name: str) -> str:
    value = "-".join(filter(None, (kind, namespace, name))).upper()
    return "OPS-" + SAFE_NAME.sub("-", value).strip("-")

def add(assets: list[dict], kind: str, name: str, status: str, namespace: str = "host", **extra) -> None:
    health_status = extra.pop("healthStatus", None)
    payload = {"assetId": asset_id(kind, namespace, name), "assetType": kind, "assetName": name,
        "namespace": namespace, "status": status, "healthStatus": health_status or ("HEALTHY" if status in {"active", "Running", "Ready", "Available", "Bound", "True"} else "REVIEW")}
    payload.update(extra); assets.append(payload)

def collect_systemd(assets: list[dict]) -> None:
    code, output = run(["systemctl", "list-units", "--type=service", "--all", "--no-legend", "--no-pager"])
    if code: return
    keywords = ("resonance", "carbonet", "kube", "docker", "containerd", "patroni", "postgres")
    for line in output.splitlines():
        columns = line.split(None, 4)
        if len(columns) < 4 or not any(x in columns[0].lower() for x in keywords): continue
        health = "REVIEW" if columns[1] != "loaded" or columns[2] == "failed" else "HEALTHY"
        add(assets, "SYSTEMD_SERVICE", columns[0], columns[2], loadState=columns[1], subState=columns[3], healthStatus=health)

def collect_kubernetes(assets: list[dict], namespace: str) -> None:
    for resource, kind in (("deployments", "K8S_DEPLOYMENT"), ("statefulsets", "K8S_STATEFULSET"),
                           ("services", "K8S_SERVICE"), ("persistentvolumeclaims", "K8S_PVC"),
                           ("poddisruptionbudgets", "K8S_PDB"), ("pods", "K8S_POD")):
        code, output = run(["kubectl", "get", resource, "-n", namespace, "-o", "json"], 60)
        if code or not output: continue
        for item in json.loads(output).get("items", []):
            meta, spec, status = item.get("metadata", {}), item.get("spec", {}), item.get("status", {})
            name = meta.get("name", "unknown")
            if resource == "deployments":
                desired, ready = spec.get("replicas", 1), status.get("readyReplicas", 0)
                state = "Available" if desired == ready else "Degraded"
                add(assets, kind, name, state, namespace, desiredReplicas=desired, readyReplicas=ready,
                    images=[c.get("image") for c in spec.get("template", {}).get("spec", {}).get("containers", [])])
            elif resource == "statefulsets":
                desired, ready = spec.get("replicas", 1), status.get("readyReplicas", 0)
                add(assets, kind, name, "Available" if desired == ready else "Degraded", namespace,
                    desiredReplicas=desired, readyReplicas=ready)
            elif resource == "services":
                add(assets, kind, name, "Available", namespace, serviceType=spec.get("type"), ports=spec.get("ports", []))
            elif resource == "persistentvolumeclaims":
                add(assets, kind, name, status.get("phase", "Unknown"), namespace,
                    storageClass=spec.get("storageClassName"), capacity=status.get("capacity", {}).get("storage"))
            elif resource == "poddisruptionbudgets":
                healthy = status.get("currentHealthy", 0); desired = status.get("desiredHealthy", 0)
                add(assets, kind, name, "Available" if healthy >= desired else "Degraded", namespace,
                    currentHealthy=healthy, desiredHealthy=desired, disruptionsAllowed=status.get("disruptionsAllowed", 0))
            else:
                ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in status.get("conditions", []))
                add(assets, kind, name, "Ready" if ready else status.get("phase", "Unknown"), namespace,
                    phase=status.get("phase"), restartCount=sum(c.get("restartCount", 0) for c in status.get("containerStatuses", [])),
                    nodeName=spec.get("nodeName"))

def collect_patroni(assets: list[dict], namespace: str) -> None:
    code, output = run(["kubectl", "get", "pods", "-n", namespace, "-l", "app=postgres-patroni", "-o", "json"], 60)
    if code or not output: return
    items = json.loads(output).get("items", [])
    for item in items:
        meta, status = item.get("metadata", {}), item.get("status", {})
        labels = meta.get("labels", {})
        ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in status.get("conditions", []))
        add(assets, "PATRONI_MEMBER", meta.get("name", "unknown"), "Ready" if ready else status.get("phase", "Unknown"), namespace,
            role=labels.get("role", "unknown"), cluster=labels.get("cluster-name", labels.get("cluster", "postgres-patroni")), phase=status.get("phase"))

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--namespace", default="carbonet-prod")
    parser.add_argument("--output", default="var/customer-trace/operation-registry.json")
    parser.add_argument("--summary-output", default="projects/carbonet-backend-metadata/customer-trace/operation-registry-summary.json")
    args = parser.parse_args(); assets: list[dict] = []
    add(assets, "UBUNTU_HOST", platform.node(), "active", os=platform.platform(), kernel=platform.release(), architecture=platform.machine())
    collect_systemd(assets); collect_kubernetes(assets, args.namespace); collect_patroni(assets, args.namespace)
    unhealthy = [x["assetId"] for x in assets if x["healthStatus"] != "HEALTHY"]
    summary = {"assetCount": len(assets), "healthyCount": len(assets) - len(unhealthy), "reviewCount": len(unhealthy),
        "byType": dict(sorted(Counter(x["assetType"] for x in assets).items())), "reviewAssetIds": unhealthy}
    generated = datetime.now(timezone.utc).isoformat()
    registry = {"schemaVersion": 1, "generatedAt": generated, "namespace": args.namespace, "summary": summary, "assets": assets}
    registry["evidenceHash"] = hashlib.sha256(json.dumps(assets, sort_keys=True).encode()).hexdigest()
    for name, payload in ((args.output, registry), (args.summary_output, registry)):
        path = Path(name); path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2)); return 0

if __name__ == "__main__": raise SystemExit(main())
