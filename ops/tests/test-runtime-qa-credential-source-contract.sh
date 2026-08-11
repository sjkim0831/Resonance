#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
python3 - "$ROOT" <<'PY'
from pathlib import Path
import re
import subprocess
import sys
import os
import stat
import tempfile

root = Path(sys.argv[1])
runtime_paths = [
    "ops/scripts/validate-customer-work-journey.sh",
    "ops/scripts/validate-activity-data-runtime.sh",
    "ops/scripts/validate-emission-calculation-runtime.sh",
    "ops/scripts/validate-organizational-boundary-runtime.sh",
    "ops/scripts/validate-governance-change-runtime.sh",
    "ops/scripts/validate-report-certification-runtime.sh",
    "ops/scripts/run-process-runtime-smoke.sh",
    "ops/scripts/complete-member-registration-assurance.sh",
    "ops/scripts/validate-emission-project-remaining-scenarios.sh",
    "ops/scripts/verify-emission-project-screen-readiness.sh",
]
screen_save_path = "ops/scripts/validate-screen-contract-runtime-save.sh"
identity_sync_path = "ops/scripts/resonance-keycloak-carbonet-identity-sync.sh"
oidc_path = "ops/scripts/resonance-backstage-oidc-token.sh"
actor_role_path = "ops/scripts/resonance-actor-process-role-e2e.sh"
project_delivery_path = "ops/scripts/resonance-project-delivery-e2e.sh"
screen_space_path = "ops/scripts/resonance-screen-space-runtime-e2e.sh"

for relative in runtime_paths + [screen_save_path]:
    path = root / relative
    assert path.is_file(), f"missing credential consumer: {relative}"
    text = path.read_text(encoding="utf-8")
    assert "runtime-qa-auth-common.sh" in text, f"common loader source missing: {relative}"
    assert "carbonet_qa_load_credentials" in text, f"common loader call missing: {relative}"
    assert not re.search(r'(?:PASSWORD|PASSWD)[A-Za-z0-9_]*="\$\{[^}\n]+:-[^}\n]+\}"', text), f"tracked password default: {relative}"
    password_writes = [
        line for line in text.splitlines()
        if re.search(r'(?:echo|printf)[^\n]*(?:PASSWORD|PASSWD)', line, re.I)
        and "| jq " not in line
    ]
    assert not password_writes, f"password log risk: {relative}"

for relative in runtime_paths:
    text = (root / relative).read_text(encoding="utf-8")
    assert "umask 077" in text, f"0600 payload umask missing: {relative}"
    assert re.search(r'--data-binary\s+["\']?@', text), f"file-backed login payload missing: {relative}"
    assert not re.search(r'--data(?:-raw)?\s+[^\n]*(?:PASSWORD|PASSWD)', text, re.I), f"password argv risk: {relative}"

screen_save = (root / screen_save_path).read_text(encoding="utf-8")
assert "validate-customer-work-journey.sh" not in screen_save
assert "carbonet-screen-smoke" in screen_save

identity_sync = (root / identity_sync_path).read_text(encoding="utf-8")
assert "umask 077" in identity_sync and "chmod 700 \"$secret_tmp\"" in identity_sync
assert '--data-binary @"$secret_tmp/token-form"' in identity_sync
assert '--header @"$secret_tmp/keycloak-auth.header"' in identity_sync
assert 'chmod 0600 "$secret_tmp/token-form"' in identity_sync
assert 'chmod 0600 "$secret_tmp/keycloak-auth.header"' in identity_sync
assert 'password=$admin_password' not in identity_sync
assert 'Authorization: Bearer $admin_token' not in identity_sync
assert "rm -rf -- \"$secret_tmp\"" in identity_sync

def identity_argv_safe(source):
    return (
        '--data-binary @"$secret_tmp/token-form"' in source
        and '--header @"$secret_tmp/keycloak-auth.header"' in source
        and 'password=$admin_password' not in source
        and 'Authorization: Bearer $admin_token' not in source
    )

assert identity_argv_safe(identity_sync)
assert not identity_argv_safe(identity_sync.replace(
    '--data-binary @"$secret_tmp/token-form"', '--data-urlencode "password=$admin_password"', 1))
assert not identity_argv_safe(identity_sync.replace(
    '--header @"$secret_tmp/keycloak-auth.header"', '-H "Authorization: Bearer $admin_token"', 1))

oidc = (root / oidc_path).read_text(encoding="utf-8")
assert "umask 077" in oidc and 'BACKSTAGE_E2E_PASSWORD_FILE' in oidc
assert '--data-binary @"$form_path"' in oidc and 'chmod 0600 "$form_path"' in oidc
assert not re.search(r'--data-urlencode[^\n]*(?:password|username)=\$', oidc, re.I)

file_backed_bearer_consumers = {
    actor_role_path: ('--header @"$run_dir/reviewer.header"', 'rm -f -- "$token_path"'),
    project_delivery_path: ('--header @"$auth_header"', '--data-binary @"$payload_file"'),
    screen_space_path: ('--header @"$auth_header"', '--data-binary @"$runtime_payload_file"'),
}
for relative, required in file_backed_bearer_consumers.items():
    source = (root / relative).read_text(encoding="utf-8")
    assert "umask 077" in source, f"0600 umask missing: {relative}"
    assert all(token in source for token in required), f"file-backed credential contract missing: {relative}"
    assert not re.search(r'(?:-H|--header)\s+["\']?(?:authorization|Authorization):\s*Bearer\s*\$', source), \
        f"bearer argv risk: {relative}"
    mutated = source.replace(required[0], '-H "authorization: Bearer $token"', 1)
    assert re.search(r'(?:-H|--header)\s+["\']?(?:authorization|Authorization):\s*Bearer\s*\$', mutated)

screen_space = (root / screen_space_path).read_text(encoding="utf-8")
assert 'SCREEN_SPACE_VERIFY_ONLY' in screen_space and 'candidate-read-only-index' in screen_space
assert not re.search(r'--data\s+["\']?\$(?:payload|runtime_payload)', screen_space)

# Exercise the exact file-backed curl primitive with sentinels. Neither secret
# may appear in argv or the fake curl log; the referenced files remain 0600.
with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    fake = td / "curl"
    argv_log = td / "argv.log"
    header = td / "auth.header"
    payload = td / "payload.form"
    bearer = "BEARER_SENTINEL_DO_NOT_LOG"
    password = "PASSWORD_SENTINEL_DO_NOT_LOG"
    fake.write_text('#!/bin/sh\nprintf "%s\\n" "$@" >"$FAKE_CURL_ARGV_LOG"\n', encoding="utf-8")
    fake.chmod(0o700)
    header.write_text(f"authorization: Bearer {bearer}\n", encoding="utf-8")
    payload.write_text(f"password={password}\n", encoding="utf-8")
    header.chmod(0o600); payload.chmod(0o600)
    env = dict(os.environ, FAKE_CURL_ARGV_LOG=str(argv_log))
    subprocess.run([str(fake), "--header", f"@{header}", "--data-binary", f"@{payload}"],
                   env=env, check=True)
    logged = argv_log.read_text(encoding="utf-8")
    assert bearer not in logged and password not in logged
    assert stat.S_IMODE(header.stat().st_mode) == 0o600
    assert stat.S_IMODE(payload.stat().st_mode) == 0o600

# Keep the former tracked credential at zero repo-wide without reproducing it
# in this contract source or test output.
forbidden = bytes([114, 104, 100, 120, 104, 100, 49, 50]).decode("ascii")
tracked = subprocess.check_output(["git", "-C", str(root), "ls-files", "-z"]).split(b"\0")
hits = []
for raw in tracked:
    if not raw:
        continue
    path = root / raw.decode("utf-8")
    try:
        if forbidden in path.read_text(encoding="utf-8"):
            hits.append(str(path.relative_to(root)))
    except (UnicodeDecodeError, OSError):
        pass
assert not hits, f"forbidden tracked credential remains in {len(hits)} file(s)"

print("RUNTIME_QA_CREDENTIAL_SOURCE_PASS consumers=16 source=secret-or-0600-file trackedLiteral=0 passwordArgv=0 bearerArgv=0 passwordLogs=0 screenSaveSourceParsing=0 verifyOnlyScreenSpace=1 mutations=5 fakeCurl=PASS")
PY
