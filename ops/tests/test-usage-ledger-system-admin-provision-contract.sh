#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROVISION="$ROOT/ops/scripts/provision-usage-ledger-system-admin.sh"
HARNESS="$ROOT/ops/scripts/validate-operational-usage-ledger-e2e.sh"
DB_POSTCONDITION="$ROOT/ops/tests/test-usage-ledger-system-admin-db-postcondition.sh"
AUTH_HELPER="$ROOT/ops/scripts/runtime-qa-auth-common.sh"

for file in "$PROVISION" "$HARNESS" "$DB_POSTCONDITION" "$AUTH_HELPER"; do
  [[ -f "$file" ]] || { echo "[usage-ledger-admin-provision-contract] missing ${file#$ROOT/}" >&2; exit 1; }
done
bash -n "$PROVISION"
bash -n "$HARNESS"
bash -n "$DB_POSTCONDITION"
bash "$PROVISION" --self-test >/dev/null

python3 - "$PROVISION" "$HARNESS" "$DB_POSTCONDITION" <<'PY'
from pathlib import Path
import re
import sys

provision = Path(sys.argv[1]).read_text(encoding="utf-8")
harness = Path(sys.argv[2]).read_text(encoding="utf-8")
db_test = Path(sys.argv[3]).read_text(encoding="utf-8")

def assert_contract(source, allowed_harness=harness, postcondition=db_test):
    assert 'ACCOUNT_ID="qausageadmin26"' in source
    assert len("qausageadmin26") == 14 and re.fullmatch(r"[A-Za-z0-9]{6,16}", "qausageadmin26")
    assert 'ACCOUNT_ROLE="ROLE_SYSTEM_ADMIN"' in source
    assert 'ACCOUNT_INSTT="TEST_COMPANY_001"' in source
    assert 'ACCOUNT_PROJECT="P003"' in source
    assert "where trim(instt_id)='$ACCOUNT_INSTT'" in source
    assert "project_id='$ACCOUNT_PROJECT' and instt_sttus='P'" in source
    assert '[[ "$institution_contract" == \'1|1\' ]]' in source
    assert 'SECRET_NAME="carbonet-usage-ledger-system-admin"' in source
    assert 'OPERATOR_SECRET="carbonet-screen-smoke"' in source
    assert 'carbonet_qa_auth_run_serialized usage-ledger-system-admin-provision provision_locked' in source
    assert 'CARBONET_WEBMASTER_MAINTENANCE_LOCK_FILE' in source
    assert 'MAINTENANCE_LOCK_TIMEOUT="${CARBONET_WEBMASTER_MAINTENANCE_LOCK_TIMEOUT_SECONDS:-300}"' in source
    assert 'CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS="${CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300}"' in source
    assert 'flock -w "$MAINTENANCE_LOCK_TIMEOUT" "$maintenance_fd"' in source
    assert '"$BASE_URL/admin/api/admin/member/admin-account"' in source
    assert '--data-binary @"$tmp_dir/admin-create.json"' in source
    assert '--from-file=password="$tmp_dir/target-password"' in source
    assert '--from-literal=password=' not in source
    assert 'umask 077' in source and 'chmod 700 "$tmp_dir"' in source
    assert 'openssl rand -base64 36' in source
    assert "update comtnemplyrinfo" not in source.lower()
    assert "insert into comtnemplyrinfo" not in source.lower()
    assert "delete from comtnemplyrinfo" not in source.lower()
    assert "kubectl apply" not in source
    assert "kubectl replace" not in source
    assert 'preconditions:{uid:$uid}' in source
    assert 'current_account_exists" == 0' in source
    assert 'secret_create_attempted=1' in source
    cleanup = source[source.index('  cleanup() {'):source.index('  trap cleanup EXIT')]
    assert 'delete_created_secret_if_account_absent || cleanup_status=1' in cleanup
    assert "trap 'exit 130' INT" in source and "trap 'exit 143' TERM" in source
    assert 'CARBONET_QA_PROVISION_FAULT_AFTER_SECRET_CREATE' in source
    assert 'app.kubernetes.io/managed-by' in source and 'resonance.ai/purpose' in source and 'resonance.ai/account-id' in source
    assert 'if [[ "$account_exists" == 0 && "$secret_exists" == 0 ]]' in source
    assert 'if [[ "$account_exists" == 1 && "$secret_exists" == 1 && "$account_exact" == 1 && "$secret_exact" == 1 ]]' in source
    assert 'printf \'BLOCKED\\n\'' in source
    assert '/signin/actionLogout' in source
    assert 'carbonet_qa_logout "$cookie" "$BASE_URL"' in source
    assert 'system-test-report?compact=true&page=0&size=1' in source
    assert 'CARBONET_USAGE_LEDGER_ALLOWED_AUTH_SECRET:-carbonet-usage-ledger-system-admin' in allowed_harness
    assert 'CARBONET_USAGE_LEDGER_DENIED_AUTH_SECRET:-carbonet-test-account-switch' in allowed_harness
    assert 'begin transaction read only;' in postcondition.lower()
    assert 'rollback;' in postcondition.lower()
    assert "length(e.password)=44" in postcondition
    assert "ROLE_SYSTEM_ADMIN" in postcondition and "emplyr_sttus_code='P'" in postcondition

assert_contract(provision)
mutations = [
    (provision.replace('ACCOUNT_ID="qausageadmin26"', 'ACCOUNT_ID="webmaster"', 1), harness, db_test),
    (provision.replace('SECRET_NAME="carbonet-usage-ledger-system-admin"', 'SECRET_NAME="carbonet-screen-smoke"', 1), harness, db_test),
    (provision.replace('carbonet_qa_auth_run_serialized usage-ledger-system-admin-provision provision_locked', 'provision_locked', 1), harness, db_test),
    (provision.replace('"$BASE_URL/admin/api/admin/member/admin-account"', '"$BASE_URL/unsafe/account-create"', 1), harness, db_test),
    (provision.replace('printf \'BLOCKED\\n\'', 'printf \'CREATE\\n\'', 1), harness, db_test),
    (provision.replace('preconditions:{uid:$uid}', 'preconditions:{}', 1), harness, db_test),
    (provision.replace('--from-file=password="$tmp_dir/target-password"', '--from-literal=password=unsafe', 1), harness, db_test),
    (provision.replace('/signin/actionLogout', '/signin/logout-removed', 1), harness, db_test),
    (provision.replace('ACCOUNT_INSTT="TEST_COMPANY_001"', 'ACCOUNT_INSTT="DEFAULT"', 1), harness, db_test),
    (provision.replace("project_id='$ACCOUNT_PROJECT' and instt_sttus='P'", "project_id='$ACCOUNT_PROJECT'", 1), harness, db_test),
    (provision, harness.replace('CARBONET_USAGE_LEDGER_ALLOWED_AUTH_SECRET:-carbonet-usage-ledger-system-admin', 'CARBONET_USAGE_LEDGER_ALLOWED_AUTH_SECRET:-carbonet-screen-smoke', 1), db_test),
    (provision, harness, db_test.replace('rollback;', 'commit;', 1)),
    (provision.replace('delete_created_secret_if_account_absent || cleanup_status=1', ': # orphan cleanup removed', 1), harness, db_test),
    (provision.replace("trap 'exit 143' TERM", "trap cleanup TERM", 1), harness, db_test),
    (provision.replace('secret_create_attempted=1', 'secret_create_attempted=0', 1), harness, db_test),
    (provision.replace('CARBONET_WEBMASTER_MAINTENANCE_LOCK_TIMEOUT_SECONDS:-300', 'CARBONET_WEBMASTER_MAINTENANCE_LOCK_TIMEOUT_SECONDS:-120', 1), harness, db_test),
    (provision.replace('CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300', 'CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-120', 1), harness, db_test),
]
for index, args in enumerate(mutations, 1):
    try:
        assert_contract(*args)
    except AssertionError:
        continue
    raise AssertionError(f"provisioning mutation survived index={index}")

print("USAGE_LEDGER_ADMIN_PROVISION_STATIC_PASS mutations=17 account=qausageadmin26 length=14 role=ROLE_SYSTEM_ADMIN tenant=TEST_COMPANY_001 institution=P003/P secret=dedicated locks=canonical300+maintenance300 plaintext=file-only partial=fail-closed rollback=uid+db-absent+exit-signal dbPostcondition=read-only-rollback")
PY
