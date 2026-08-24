#!/usr/bin/env bash
set -euo pipefail

PROCESS_CODE="${1:?process code is required}"
DIFF_LINES="${2:?diff line count is required}"
WORKTREE="${3:-}"
BASE_REF="${4:-HEAD}"
HARD_MAX_FILES="${DETERMINISTIC_FULLSTACK_MAX_FILES:-8000}"
HARD_MAX_LINES="${DETERMINISTIC_FULLSTACK_MAX_LINES:-20000000}"

[[ "$PROCESS_CODE" =~ ^[A-Z0-9_]+$ ]]
[[ "$DIFF_LINES" =~ ^[0-9]+$ && "$HARD_MAX_FILES" =~ ^[0-9]+$ && "$HARD_MAX_LINES" =~ ^[0-9]+$ ]]
[[ "$BASE_REF" =~ ^(HEAD\^?|[0-9a-f]{40})$ ]]
(( HARD_MAX_FILES > 0 && HARD_MAX_FILES <= 8000 ))
(( HARD_MAX_LINES > 0 && HARD_MAX_LINES <= 20000000 ))
if [[ -z "$WORKTREE" ]]; then
  WORKTREE="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
[[ -n "$WORKTREE" && -d "$WORKTREE" ]]

python3 - "$PROCESS_CODE" "$DIFF_LINES" "$WORKTREE" "$HARD_MAX_FILES" "$HARD_MAX_LINES" "$BASE_REF" 3<&0 <<'PY'
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath
from typing import Any

process, diff_lines_text, root_text, hard_files_text, hard_lines_text, base_ref = sys.argv[1:]
diff_lines, hard_files, hard_lines = map(int, (diff_lines_text, hard_files_text, hard_lines_text))
root = Path(root_text).absolute()
git_probe = subprocess.run(
    ["git", "-C", str(root), "rev-parse", "--is-inside-work-tree"],
    stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
)
if (any(path.is_symlink() for path in (root, *root.parents))
        or git_probe.returncode != 0 or git_probe.stdout.strip() != "true"):
    raise SystemExit("deterministic full-stack worktree is invalid")

HARD_PACKAGE_COUNT = 2000
HARD_ENDPOINT_ARTIFACT_COUNT = 5000
SAFE_PATH = re.compile(r"^[A-Za-z0-9_./-]+$")
CODE = re.compile(r"^[A-Z0-9_]+$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
OP_ID = re.compile(r"^[A-Za-z][A-Za-z0-9_]{1,79}$")
JAVA_ID = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
HTTP_PATH = re.compile(r"^/[A-Za-z0-9_{}./-]+$")
JAVA_PACKAGE = "egovframework.com.generated.canonical"
TEMP_NAME = re.compile(
    r"(?:^|/)[^/]*(?:\.(?:tmp|temp|bak|swp|stage|partial|new)(?:\.|$)|~$|\.previous\.)",
    re.I,
)

runtime_prefix = f"projects/carbonet-backend-metadata/process-runtime/generated/{process}"
preview_prefix = f"projects/carbonet-backend-metadata/process-runtime/design-preview/{process}"
endpoint_prefix = f"projects/carbonet-backend-metadata/process-runtime/generated-endpoints/{process}"
prefixes = (runtime_prefix, preview_prefix, endpoint_prefix)


def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value: str | bytes) -> str:
    if isinstance(value, str):
        value = value.encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def exact_keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        raise ValueError(f"{label} keys must be exactly {sorted(expected)}")
    return value


def exact_int(value: Any, label: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{label} is invalid")
    return value


def exact_text(value: Any, label: str, pattern: re.Pattern[str] | None = None) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValueError(f"{label} is invalid")
    if pattern is not None and not pattern.fullmatch(value):
        raise ValueError(f"{label} is invalid")
    return value


def exact_hash(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SHA256.fullmatch(value):
        raise ValueError(f"{label} is invalid")
    return value


def safe_relative(path: str, *, endpoint_artifact: bool = False) -> str:
    if not isinstance(path, str) or not path or not SAFE_PATH.fullmatch(path):
        raise ValueError(f"unsafe generated path: {path!r}")
    pure = PurePosixPath(path)
    if pure.is_absolute() or any(part in ("", ".", "..") or part.startswith(".") for part in pure.parts):
        raise ValueError(f"hidden or traversing generated path: {path}")
    if TEMP_NAME.search(path):
        raise ValueError(f"temporary generated path: {path}")
    if endpoint_artifact and (not path.startswith("src/main/java/") or not path.endswith(".java")):
        raise ValueError(f"endpoint artifact is not Java source: {path}")
    return path


def collect_current_paths(prefix: str) -> set[str]:
    base = root / prefix
    if not base.exists() and not base.is_symlink():
        return set()
    if base.is_symlink() or not base.is_dir():
        raise ValueError(f"generated root is not a real directory: {prefix}")
    paths: set[str] = set()
    for directory, names, files in os.walk(base, followlinks=False):
        directory_path = Path(directory)
        for name in names:
            candidate = directory_path / name
            if candidate.is_symlink():
                raise ValueError(f"generated path traverses symbolic link: {candidate.relative_to(root).as_posix()}")
        for name in files:
            candidate = directory_path / name
            relative = candidate.relative_to(root).as_posix()
            safe_relative(relative)
            if candidate.is_symlink() or not candidate.is_file():
                raise ValueError(f"generated artifact is not a real file: {relative}")
            paths.add(relative)
    return paths


class CurrentReader:
    def __init__(self) -> None:
        self.paths = set().union(*(collect_current_paths(prefix) for prefix in prefixes))

    def read_many(self, paths: list[str] | set[str]) -> dict[str, bytes]:
        result: dict[str, bytes] = {}
        for relative in paths:
            safe_relative(relative)
            if relative not in self.paths:
                raise ValueError(f"current generated artifact is missing: {relative}")
            current = root
            for part in PurePosixPath(relative).parts:
                current = current / part
                if current.is_symlink():
                    raise ValueError(f"generated path traverses symbolic link: {relative}")
            if not current.is_file():
                raise ValueError(f"current generated artifact is missing: {relative}")
            result[relative] = current.read_bytes()
        return result


class GitReader:
    def __init__(self) -> None:
        tree = subprocess.run(
            ["git", "-C", str(root), "ls-tree", "-r", "-z", base_ref, "--", *prefixes],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        if tree.returncode:
            raise ValueError(f"cannot inspect previous generated tree: {tree.stderr.decode('utf-8', 'replace').strip()}")
        self.paths = set()
        for raw in tree.stdout.split(b"\0"):
            if not raw:
                continue
            try:
                metadata, raw_path = raw.split(b"\t", 1)
                mode, object_type, _object_id = metadata.split(b" ", 2)
                relative = raw_path.decode("utf-8")
            except (ValueError, UnicodeError) as exc:
                raise ValueError("invalid previous generated tree record") from exc
            if object_type != b"blob" or mode not in {b"100644", b"100755"}:
                raise ValueError(f"previous generated artifact is not a regular file: {relative}")
            safe_relative(relative)
            self.paths.add(relative)
        self.cache: dict[str, bytes] = {}

    def read_many(self, paths: list[str] | set[str]) -> dict[str, bytes]:
        requested = list(dict.fromkeys(paths))
        missing = [path for path in requested if path not in self.paths]
        if missing:
            raise ValueError(f"previous generated artifact is missing: {missing[0]}")
        pending = [path for path in requested if path not in self.cache]
        if pending:
            query = b"".join(f"{base_ref}:{path}\n".encode("utf-8") for path in pending)
            result = subprocess.run(
                ["git", "-C", str(root), "cat-file", "--batch"],
                input=query, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )
            if result.returncode:
                raise ValueError(f"cannot read previous generated artifacts: {result.stderr.decode('utf-8', 'replace').strip()}")
            output = result.stdout
            offset = 0
            for relative in pending:
                newline = output.find(b"\n", offset)
                if newline < 0:
                    raise ValueError("truncated git cat-file response")
                header = output[offset:newline].split()
                offset = newline + 1
                if len(header) != 3 or header[1] != b"blob" or not header[2].isdigit():
                    raise ValueError(f"invalid previous generated artifact: {relative}")
                size = int(header[2])
                content = output[offset:offset + size]
                offset += size
                if len(content) != size or output[offset:offset + 1] != b"\n":
                    raise ValueError("truncated git cat-file blob")
                offset += 1
                self.cache[relative] = content
            if offset != len(output):
                raise ValueError("unexpected git cat-file response residue")
        return {path: self.cache[path] for path in requested}


def read_json(reader: CurrentReader | GitReader, relative: str, label: str) -> Any:
    raw = reader.read_many([relative])[relative]
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid {label} JSON {relative}: {exc}") from exc


def paths_under(reader: CurrentReader | GitReader, prefix: str) -> set[str]:
    marker = prefix + "/"
    return {path for path in reader.paths if path.startswith(marker)}


def validate_screen(value: Any, label: str) -> dict[str, str]:
    row = exact_keys(value, {"screenKey", "designHash"}, label)
    return {
        "screenKey": exact_text(row["screenKey"], f"{label}.screenKey"),
        "designHash": exact_hash(row["designHash"], f"{label}.designHash"),
    }


def validate_composite_manifest(reader: CurrentReader | GitReader, prefix: str,
                                index: dict[str, Any], state: str) -> set[str]:
    if index.get("compositeAuthoritySchema") != "carbonet.composite-executable-design-authority/v1":
        raise ValueError(f"{state} composite authority schema mismatch")
    set_hash = exact_hash(index.get("compositeAuthoritySetHash"), "compositeAuthoritySetHash")
    binding = exact_keys(index.get("compositeArtifactManifest"),
                         {"path", "sha256", "artifactCount"}, "compositeArtifactManifest")
    if binding["path"] != "composite/manifest.json":
        raise ValueError("composite artifact manifest path mismatch")
    relative = f"{prefix}/{binding['path']}"
    raw = reader.read_many([relative])[relative]
    if digest(raw) != exact_hash(binding["sha256"], "compositeArtifactManifest.sha256"):
        raise ValueError("composite artifact manifest byte hash mismatch")
    try:
        manifest = json.loads(raw.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("composite artifact manifest is invalid JSON") from exc
    keys = {"schema", "authoritySchema", "outputMode", "compositeAuthoritySetHash",
            "authorityCount", "authorities", "artifactCount", "artifactSetHash", "manifestHash"}
    exact_keys(manifest, keys, "composite artifact manifest")
    if (manifest["schema"] != "carbonet.generated-composite-executable-design/v1"
            or manifest["authoritySchema"] != index["compositeAuthoritySchema"]
            or manifest["outputMode"] != "SDUI_API_DB_TEST_SUPPORT_SURFACES_V1"
            or manifest["compositeAuthoritySetHash"] != set_hash):
        raise ValueError("composite artifact manifest provenance mismatch")
    unsigned = dict(manifest); unsigned.pop("manifestHash")
    if digest(stable(unsigned)) != exact_hash(manifest["manifestHash"], "composite.manifestHash"):
        raise ValueError("composite artifact manifestHash mismatch")
    authorities = manifest["authorities"]
    if (not isinstance(authorities, list)
            or exact_int(manifest["authorityCount"], "authorityCount", minimum=1) != len(authorities)):
        raise ValueError("composite authority count mismatch")
    paths = {relative}; artifact_rows = []
    for authority in authorities:
        authority = exact_keys(authority, {"identity", "authorityHash", "documentSetHash",
            "executableDesignHash", "packageBindingHash", "artifacts"}, "composite authority")
        for key in ("authorityHash", "documentSetHash", "executableDesignHash", "packageBindingHash"):
            exact_hash(authority[key], f"composite.{key}")
        if not isinstance(authority["identity"], dict) or not isinstance(authority["artifacts"], list):
            raise ValueError("composite authority identity/artifacts invalid")
        for artifact in authority["artifacts"]:
            artifact = exact_keys(artifact, {"lane", "path", "sha256"}, "composite artifact")
            path = safe_relative(artifact["path"])
            if not path.startswith("composite/") or path == "composite/manifest.json":
                raise ValueError("composite artifact path escaped lane")
            full = f"{prefix}/{path}"
            if full in paths:
                raise ValueError("duplicate composite artifact path")
            content = reader.read_many([full])[full]
            sha = exact_hash(artifact["sha256"], "composite artifact sha256")
            if digest(content) != sha:
                raise ValueError("composite artifact byte hash mismatch")
            paths.add(full); artifact_rows.append({"path": path, "sha256": sha})
    if (exact_int(manifest["artifactCount"], "artifactCount") != len(artifact_rows)
            or exact_int(binding["artifactCount"], "compositeArtifactManifest.artifactCount", minimum=2) != len(paths)
            or digest(stable(sorted(artifact_rows, key=lambda row: row["path"])))
                != exact_hash(manifest["artifactSetHash"], "artifactSetHash")):
        raise ValueError("composite artifact exact set/hash mismatch")
    return paths


def validate_package_manifest(reader: CurrentReader | GitReader, prefix: str, state: str):
    actual = paths_under(reader, prefix)
    if not actual:
        return None
    relative = f"{prefix}/index.json"
    if relative not in actual:
        raise ValueError(f"{state} package index is missing: {relative}")
    value = read_json(reader, relative, f"{state} package index")
    if not isinstance(value, dict):
        raise ValueError(f"invalid package manifest: {relative}")
    canonical = "canonicalCatalogHash" in value or "canonicalScreens" in value
    composite = any(key in value for key in (
        "compositeAuthoritySchema", "compositeAuthoritySetHash", "compositeArtifactManifest"))
    keys = {"schemaVersion", "packageCount", "skippedReviewRequired", "packages", "manifestHash"}
    if canonical:
        keys |= {"canonicalCatalogHash", "canonicalScreens"}
    if composite:
        keys |= {"compositeAuthoritySchema", "compositeAuthoritySetHash", "compositeArtifactManifest"}
    exact_keys(value, keys, f"{state} package manifest")
    if value["schemaVersion"] != "2.0.0":
        raise ValueError(f"invalid package manifest schema: {relative}")
    packages = value["packages"]
    count = exact_int(value["packageCount"], f"{relative}.packageCount", minimum=1)
    exact_int(value["skippedReviewRequired"], f"{relative}.skippedReviewRequired")
    if not isinstance(packages, list) or count != len(packages) or count > HARD_PACKAGE_COUNT:
        raise ValueError(f"packageCount mismatch or hard cap exceeded: {relative}")
    manifest_hash = exact_hash(value["manifestHash"], f"{relative}.manifestHash")
    without_hash = dict(value)
    del without_hash["manifestHash"]
    if digest(stable(without_hash)) != manifest_hash:
        raise ValueError(f"package manifestHash mismatch: {relative}")
    canonical_hash = None
    manifest_screens: list[dict[str, str]] = []
    if canonical:
        canonical_hash = exact_hash(value["canonicalCatalogHash"], f"{relative}.canonicalCatalogHash")
        if not isinstance(value["canonicalScreens"], list):
            raise ValueError(f"canonicalScreens is invalid: {relative}")
        manifest_screens = [validate_screen(item, f"{relative}.canonicalScreens") for item in value["canonicalScreens"]]
        if manifest_screens != sorted(manifest_screens, key=lambda item: item["screenKey"]):
            raise ValueError(f"canonicalScreens order mismatch: {relative}")

    expected = {relative}
    if composite:
        expected |= validate_composite_manifest(reader, prefix, value, state)
    entries: list[dict[str, Any]] = []
    identities: set[tuple[str, str]] = set()
    for raw in packages:
        item = exact_keys(raw, {"processCode", "stepCode", "package", "packageHash", "pages"}, f"{relative} package")
        process_code = exact_text(item["processCode"], f"{relative}.processCode", CODE)
        step_code = exact_text(item["stepCode"], f"{relative}.stepCode", CODE)
        if process_code != process:
            raise ValueError(f"package process identity mismatch: {relative}")
        identity = (process_code, step_code)
        if identity in identities:
            raise ValueError(f"duplicate package identity: {relative}")
        identities.add(identity)
        filename = safe_relative(item["package"])
        if filename != f"{process}__{step_code}.json" or "/" in filename:
            raise ValueError(f"package path mismatch: {filename}")
        package_hash = exact_hash(item["packageHash"], f"{relative}.packageHash")
        exact_int(item["pages"], f"{relative}.pages")
        path = f"{prefix}/{filename}"
        if path in expected:
            raise ValueError(f"duplicate package path: {path}")
        expected.add(path)
        entries.append({"path": path, "hash": package_hash, "identity": identity})
    if [(item["processCode"], item["stepCode"]) for item in packages] != sorted(identities):
        raise ValueError(f"package index order mismatch: {relative}")
    if actual != expected:
        residue = sorted(actual ^ expected)
        raise ValueError(f"package artifact set mismatch: {relative} path={residue[0] if residue else 'unknown'}")

    package_bytes = reader.read_many([entry["path"] for entry in entries])
    aggregate_screens: list[dict[str, str]] = []
    for entry in entries:
        try:
            package = json.loads(package_bytes[entry["path"]].decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError) as exc:
            raise ValueError(f"invalid package JSON: {entry['path']}: {exc}") from exc
        if not isinstance(package, dict):
            raise ValueError(f"invalid package object: {entry['path']}")
        package_hash = exact_hash(package.get("packageHash"), f"{entry['path']}.packageHash")
        body = dict(package)
        del body["packageHash"]
        if digest(stable(body)) != package_hash or package_hash != entry["hash"]:
            raise ValueError(f"package hash mismatch: {entry['path']}")
        try:
            package_identity = (package["process"]["code"], package["step"]["code"])
        except (KeyError, TypeError) as exc:
            raise ValueError(f"package identity is invalid: {entry['path']}") from exc
        if package_identity != entry["identity"]:
            raise ValueError(f"package identity mismatch: {entry['path']}")
        has_canonical = "canonicalCatalogHash" in package or "canonicalScreens" in package
        if has_canonical != canonical:
            raise ValueError(f"package canonical provenance mismatch: {entry['path']}")
        if canonical:
            if set(package) < {"canonicalCatalogHash", "canonicalScreens"}:
                raise ValueError(f"package canonical provenance is incomplete: {entry['path']}")
            if package["canonicalCatalogHash"] != canonical_hash or not isinstance(package["canonicalScreens"], list):
                raise ValueError(f"package canonical catalog mismatch: {entry['path']}")
            screens = [validate_screen(item, f"{entry['path']}.canonicalScreens") for item in package["canonicalScreens"]]
            if screens != sorted(screens, key=lambda item: item["screenKey"]):
                raise ValueError(f"package canonicalScreens order mismatch: {entry['path']}")
            aggregate_screens.extend(screens)
    if canonical and aggregate_screens != manifest_screens:
        raise ValueError(f"package canonicalScreens aggregation mismatch: {relative}")
    return {
        "paths": expected,
        "count": count,
        "manifestHash": manifest_hash,
        "canonicalCatalogHash": canonical_hash,
        "canonicalScreens": manifest_screens,
        "compositeAuthoritySetHash": value.get("compositeAuthoritySetHash"),
        "compositeArtifactManifestHash": (
            value.get("compositeArtifactManifest", {}).get("sha256") if composite else None),
    }


def validate_http_path(value: Any, label: str) -> str:
    path = exact_text(value, label, HTTP_PATH)
    if (path.startswith("//") or "//" in path or "?" in path or "#" in path or "\\" in path
            or any(part in {"", ".", ".."} for part in path.split("/")[1:])):
        raise ValueError(f"{label} contains an unsafe segment")
    variables = re.findall(r"\{[^{}]*\}", path)
    if variables != ["{executionId}"] or path.count("{") != 1 or path.count("}") != 1:
        raise ValueError(f"{label} must contain exactly one executionId variable")
    return path


def validate_endpoint_manifest(reader: CurrentReader | GitReader, state: str):
    actual = paths_under(reader, endpoint_prefix)
    if not actual:
        return None
    relative = f"{endpoint_prefix}/manifest.json"
    release_path = f"{endpoint_prefix}/full-stack-release.json"
    if relative not in actual or release_path not in actual:
        raise ValueError(f"{state} endpoint release evidence is incomplete")
    value = read_json(reader, relative, f"{state} endpoint manifest")
    keys = {"schema", "adapter", "catalogHash", "generatorHash", "artifactCount", "artifacts",
            "operations", "artifactHash", "bundleHash"}
    exact_keys(value, keys, f"{state} endpoint manifest")
    if value["schema"] != "carbonet.generated-endpoints/v1" or value["adapter"] != "EXISTING_PROCESS_COMMAND_RUNTIME":
        raise ValueError(f"invalid endpoint manifest schema or adapter: {relative}")
    catalog_hash = exact_hash(value["catalogHash"], f"{relative}.catalogHash")
    exact_hash(value["generatorHash"], f"{relative}.generatorHash")
    artifacts = value["artifacts"]
    count = exact_int(value["artifactCount"], f"{relative}.artifactCount", minimum=1)
    if not isinstance(artifacts, list) or count != len(artifacts) or count > HARD_ENDPOINT_ARTIFACT_COUNT:
        raise ValueError(f"artifactCount mismatch or hard cap exceeded: {relative}")
    artifact_hash = exact_hash(value["artifactHash"], f"{relative}.artifactHash")
    if digest(stable(artifacts)) != artifact_hash:
        raise ValueError(f"endpoint artifactHash mismatch: {relative}")
    bundle_hash = exact_hash(value["bundleHash"], f"{relative}.bundleHash")
    without_bundle = dict(value)
    del without_bundle["bundleHash"]
    if digest(stable(without_bundle)) != bundle_hash:
        raise ValueError(f"endpoint bundleHash mismatch: {relative}")

    expected = {relative, release_path}
    normalized_artifacts: list[dict[str, str]] = []
    artifact_by_path: dict[str, dict[str, str]] = {}
    for raw in artifacts:
        item = exact_keys(raw, {"path", "sha256", "designHash", "endpointHash"}, f"{relative} artifact")
        artifact = safe_relative(item["path"], endpoint_artifact=True)
        normalized = {
            "path": artifact,
            "sha256": exact_hash(item["sha256"], f"{artifact}.sha256"),
            "designHash": exact_hash(item["designHash"], f"{artifact}.designHash"),
            "endpointHash": exact_hash(item["endpointHash"], f"{artifact}.endpointHash"),
        }
        path = f"{endpoint_prefix}/{artifact}"
        if path in expected:
            raise ValueError(f"duplicate endpoint artifact path: {path}")
        expected.add(path)
        normalized_artifacts.append(normalized)
        artifact_by_path[artifact] = normalized
    if normalized_artifacts != sorted(normalized_artifacts, key=lambda item: item["path"]):
        raise ValueError(f"endpoint artifact order mismatch: {relative}")
    if actual != expected:
        residue = sorted(actual ^ expected)
        raise ValueError(f"endpoint artifact set mismatch: {relative} path={residue[0] if residue else 'unknown'}")
    artifact_bytes = reader.read_many([f"{endpoint_prefix}/{item['path']}" for item in normalized_artifacts])
    for item in normalized_artifacts:
        path = f"{endpoint_prefix}/{item['path']}"
        if digest(artifact_bytes[path]) != item["sha256"]:
            raise ValueError(f"endpoint artifact byte hash mismatch: {path}")

    operations = value["operations"]
    if not isinstance(operations, list) or not operations:
        raise ValueError(f"endpoint manifest operations are required: {relative}")
    operation_keys: set[str] = set()
    routes: set[str] = set()
    handlers: set[str] = set()
    normalized_operations: list[dict[str, str]] = []
    operation_artifacts: set[str] = set()
    for raw in operations:
        keys = {"operationKey", "method", "path", "handlerClass", "handlerMethod", "designHash", "endpointHash"}
        item = exact_keys(raw, keys, f"{relative} operation")
        operation_key = exact_text(item["operationKey"], "operationKey", OP_ID)
        method = exact_text(item["method"], "method")
        path = validate_http_path(item["path"], "operation.path")
        handler_class = exact_text(item["handlerClass"], "handlerClass")
        handler_method = exact_text(item["handlerMethod"], "handlerMethod", JAVA_ID)
        design_hash = exact_hash(item["designHash"], "operation.designHash")
        endpoint_hash = exact_hash(item["endpointHash"], "operation.endpointHash")
        expected_class = f"{JAVA_PACKAGE}.{operation_key[:1].upper() + operation_key[1:]}Controller"
        if method != "POST" or handler_method != "execute" or handler_class != expected_class:
            raise ValueError(f"endpoint operation handler mismatch: {operation_key}")
        signatures = (operation_key.casefold(), f"{method} {path}".casefold(), f"{handler_class}#{handler_method}".casefold())
        if signatures[0] in operation_keys or signatures[1] in routes or signatures[2] in handlers:
            raise ValueError(f"duplicate endpoint operation binding: {operation_key}")
        operation_keys.add(signatures[0]); routes.add(signatures[1]); handlers.add(signatures[2])
        base = f"src/main/java/{handler_class.replace('.', '/')[:-len('Controller')]}"
        expected_operation_artifacts = {
            f"{base}{suffix}.java"
            for suffix in ("Controller", "Request", "SuccessResponse", "RecoveryResponse", "ErrorResponse")
        }
        for artifact in expected_operation_artifacts:
            provenance = artifact_by_path.get(artifact)
            if provenance is None or provenance["designHash"] != design_hash or provenance["endpointHash"] != endpoint_hash:
                raise ValueError(f"endpoint operation artifact provenance mismatch: {operation_key}")
        operation_artifacts |= expected_operation_artifacts
        normalized_operations.append({key: item[key] for key in keys})
    expected_order = sorted(normalized_operations, key=lambda item: (
        item["operationKey"].casefold(), item["method"], item["path"], item["handlerClass"]
    ))
    if normalized_operations != expected_order:
        raise ValueError(f"endpoint operation order mismatch: {relative}")
    if operation_artifacts != set(artifact_by_path):
        raise ValueError(f"endpoint operation/artifact exact set mismatch: {relative}")
    return {
        "paths": expected,
        "count": count,
        "catalogHash": catalog_hash,
        "bundleHash": bundle_hash,
        "designHashes": sorted({item["designHash"] for item in normalized_artifacts}),
        "release": read_json(reader, release_path, f"{state} full-stack release"),
    }


def validate_release(value: Any, runtime: dict[str, Any] | None, preview: dict[str, Any] | None,
                     endpoint: dict[str, Any], state: str) -> None:
    keys = {"schema", "lanes", "designCatalogHash", "endpointCatalogHash", "designHashes",
            "packageManifestHash", "endpointBundleHash", "releaseHash"}
    composite = any(key in value for key in (
        "compositeAuthoritySetHash", "compositeArtifactManifestHash")) if isinstance(value, dict) else False
    if composite:
        keys |= {"compositeAuthoritySetHash", "compositeArtifactManifestHash"}
    release = exact_keys(value, keys, f"{state} full-stack release")
    if release["schema"] != "carbonet.canonical-full-stack-release/v1":
        raise ValueError(f"invalid {state} full-stack release schema")
    expected_lanes = ["FRONTEND", "API", "DATABASE", "HELP", "CARDS"]
    if composite:
        expected_lanes.append("COMPOSITE_EXECUTABLE_DESIGN")
    if release["lanes"] != expected_lanes:
        raise ValueError(f"invalid {state} full-stack release lanes")
    design_catalog = exact_hash(release["designCatalogHash"], "release.designCatalogHash")
    endpoint_catalog = exact_hash(release["endpointCatalogHash"], "release.endpointCatalogHash")
    package_manifest = exact_hash(release["packageManifestHash"], "release.packageManifestHash")
    endpoint_bundle = exact_hash(release["endpointBundleHash"], "release.endpointBundleHash")
    release_hash = exact_hash(release["releaseHash"], "release.releaseHash")
    design_hashes = release["designHashes"]
    if (not isinstance(design_hashes, list)
            or any(not isinstance(item, str) or not SHA256.fullmatch(item) for item in design_hashes)
            or design_hashes != sorted(set(design_hashes)) or not design_hashes):
        raise ValueError(f"invalid {state} release designHashes")
    unsigned = dict(release)
    del unsigned["releaseHash"]
    if digest(stable(unsigned)) != release_hash:
        raise ValueError(f"{state} releaseHash mismatch")
    if runtime is None or runtime["canonicalCatalogHash"] is None:
        raise ValueError(f"{state} endpoint release lacks canonical runtime package evidence")
    if (package_manifest != runtime["manifestHash"]
            or endpoint_bundle != endpoint["bundleHash"]
            or endpoint_catalog != endpoint["catalogHash"]
            or design_catalog != runtime["canonicalCatalogHash"]
            or design_hashes != endpoint["designHashes"]):
        raise ValueError(f"{state} full-stack release cross-hash mismatch")
    if composite:
        set_hash = exact_hash(release["compositeAuthoritySetHash"], "release.compositeAuthoritySetHash")
        manifest_hash = exact_hash(release["compositeArtifactManifestHash"], "release.compositeArtifactManifestHash")
        if (runtime["compositeAuthoritySetHash"] != set_hash
                or runtime["compositeArtifactManifestHash"] != manifest_hash
                or preview is None or preview["compositeAuthoritySetHash"] != set_hash
                or preview["compositeArtifactManifestHash"] != manifest_hash):
            raise ValueError(f"{state} composite release cross-hash mismatch")
    runtime_design_hashes = sorted({screen["designHash"] for screen in runtime["canonicalScreens"]})
    if runtime_design_hashes != design_hashes:
        raise ValueError(f"{state} runtime/release design hash set mismatch")
    if preview is not None:
        if preview["canonicalCatalogHash"] != design_catalog:
            raise ValueError(f"{state} preview/release design catalog mismatch")
        preview_design_hashes = sorted({screen["designHash"] for screen in preview["canonicalScreens"]})
        if preview_design_hashes != design_hashes:
            raise ValueError(f"{state} preview/release design hash set mismatch")


def validate_state(reader: CurrentReader | GitReader, state: str):
    runtime = validate_package_manifest(reader, runtime_prefix, state)
    preview = validate_package_manifest(reader, preview_prefix, state)
    endpoint = validate_endpoint_manifest(reader, state)
    if endpoint is not None:
        validate_release(endpoint["release"], runtime, preview, endpoint, state)
    expected = set()
    package_count = 0
    for package in (runtime, preview):
        if package is not None:
            expected |= package["paths"]
            package_count += package["count"]
    endpoint_count = 0
    if endpoint is not None:
        expected |= endpoint["paths"]
        endpoint_count = endpoint["count"]
    return expected, package_count, endpoint_count


try:
    current_reader = CurrentReader()
    previous_reader = GitReader()
    current, package_count, endpoint_count = validate_state(current_reader, "current")
    previous, previous_package_count, previous_endpoint_count = validate_state(previous_reader, "previous")
    allowed_union = current | previous
    if len(allowed_union) > hard_files:
        raise ValueError(f"manifest-derived file hard cap exceeded: {len(allowed_union)}/{hard_files}")

    changed = []
    for raw in os.fdopen(3, encoding="utf-8"):
        line = raw.rstrip("\n")
        if not line:
            continue
        if len(line) < 4 or line[2] != " " or " -> " in line:
            raise ValueError(f"unsupported git status record: {line}")
        status, path = line[:2], safe_relative(line[3:])
        if status not in {"??", " M", "M ", "MM", "A ", "AM", " D", "D "}:
            raise ValueError(f"unsupported git status: {status}")
        expected_prefixes = tuple(prefix + "/" for prefix in prefixes)
        if not path.startswith(expected_prefixes):
            raise ValueError(f"deterministic full-stack diff escaped process scope: {path}")
        deleted = "D" in status
        if deleted:
            if path not in previous:
                raise ValueError(f"deleted path is absent from the previous manifests: {path}")
        elif path not in current:
            raise ValueError(f"changed path is absent from the current manifests: {path}")
        changed.append(path)

    if not changed or len(changed) > len(allowed_union):
        raise ValueError(f"manifest-derived changed file limit exceeded: {len(changed)}/{len(allowed_union)}")
    if len(changed) != len(set(changed)):
        raise ValueError("duplicate git status path")

    declared_packages = max(package_count, previous_package_count)
    declared_endpoints = max(endpoint_count, previous_endpoint_count)
    manifest_line_limit = 12_000 + declared_packages * 6_000 + declared_endpoints * 800
    line_limit = min(hard_lines, manifest_line_limit)
    if diff_lines > line_limit:
        raise ValueError(f"manifest-derived diff line limit exceeded: {diff_lines}/{line_limit}")
except ValueError as exc:
    print(str(exc), file=sys.stderr)
    raise SystemExit(1)

print(
    "deterministic full-stack diff accepted: "
    f"process={process} files={len(changed)} lines={diff_lines} "
    f"manifests=packages:{package_count},endpointArtifacts:{endpoint_count} "
    f"limits={len(allowed_union)}/{line_limit} hard={hard_files}/{hard_lines}"
)
PY
