#!/usr/bin/env python3
"""Generate the live-smoke relay account-ID map from current DB authority scopes.

Passwords and tokens are readiness inputs only.  They are never included in the
database query, generated environment file, state file, stdout, or error text.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, Mapping


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT / "ops/runtime-metadata/composite-relay-account-map.json"
POLICY_SCHEMA = "carbonet.composite-relay-account-map-policy/v1"
SNAPSHOT_SCHEMA = "carbonet.composite-relay-account-candidates/v1"
STATE_SCHEMA = "carbonet.composite-relay-account-map-state/v1"
HASH = re.compile(r"^[0-9a-f]{64}$")
ACTOR = re.compile(r"^[A-Z][A-Z0-9_]{1,79}$")


DB_SNAPSHOT_SQL = r"""
with current_dispatch as (
  select distinct dispatch.job_id,dispatch.project_id,
         dispatch.authority_revision_set_hash
    from integrated_design_live_smoke_dispatch dispatch
   where dispatch.status in('QUEUED','RETRY_WAIT','RUNNING')
     and dispatch.attempt_count<3
     and dispatch.authority_revision_set_hash=
         framework_composite_authority_revision_set_hash(dispatch.job_id)
), scope as (
  select distinct dispatch.job_id,authority.authority_id,
         authority.authority_revision,dispatch.project_id,
         command->>'actorCode' actor_code
    from current_dispatch dispatch
    join integrated_design_authority authority on authority.job_id=dispatch.job_id
   cross join lateral jsonb_array_elements(
         authority.composite_json#>'{executableDesign,PROCESS,commands}') command
   where command->>'actorCode'~'^[A-Z][A-Z0-9_]{1,79}$'
), active_identity_row as (
  select lower(account.emplyr_id) account_key,account.emplyr_id account_id,
         'EMPLOYEE:'||account.esntl_id identity_key,
         security.author_code
    from comtnemplyrinfo account
    join comtnemplyrscrtyestbs security
      on security.scrty_dtrmn_trget_id=account.esntl_id
     and nullif(btrim(security.author_code),'') is not null
   where account.emplyr_sttus_code in('P','A')
  union all
  select lower(account.entrprs_mber_id),account.entrprs_mber_id,
         'ENTERPRISE:'||account.esntl_id,
         security.author_code
    from comtnentrprsmber account
    join comtnemplyrscrtyestbs security
      on security.scrty_dtrmn_trget_id=account.esntl_id
     and nullif(btrim(security.author_code),'') is not null
   where account.entrprs_mber_sttus in('P','A')
), active_identity as (
  select account_key,min(account_id collate "C") account_id,
         bool_or(upper(author_code) in(
           'ROLE_LIVE_SMOKE_DENIED','ROLE_COMPOSITE_LIVE_SMOKE_DENIED')) denied_role
   from active_identity_row
   group by account_key
  having count(distinct account_id)=1 and count(distinct identity_key)=1
), positive_raw as (
  select scope.job_id,scope.authority_id,scope.authority_revision,
         scope.project_id scope_project_id,scope.actor_code,
         identity.account_id,assignment.tenant_id,project_actor.project_id,
         assignment.assignment_id
    from scope
    join framework_actor_definition actor
      on actor.actor_code=scope.actor_code and actor.use_at='Y'
    join framework_account_actor_assignment assignment
      on assignment.actor_code=scope.actor_code
     and assignment.assignment_status='ACTIVE'
     and assignment.valid_from<=current_date
     and (assignment.valid_until is null or assignment.valid_until>=current_date)
    join active_identity identity
      on identity.account_key=lower(assignment.account_id)
     and not identity.denied_role
    join framework_project_actor_assignment project_actor
      on project_actor.actor_code=scope.actor_code
     and lower(project_actor.user_id)=identity.account_key
     and project_actor.active_yn='Y'
     and (assignment.project_id='*' or assignment.project_id=project_actor.project_id)
     and (scope.project_id='*' or scope.project_id=project_actor.project_id)
), positive_choice as (
  select job_id,authority_id,authority_revision,scope_project_id,actor_code,
         account_id,tenant_id,project_id,
         count(distinct assignment_id)::integer assignment_count
    from positive_raw
   group by job_id,authority_id,authority_revision,scope_project_id,actor_code,
            account_id,tenant_id,project_id
), forbidden_choice as (
  select positive.job_id,positive.authority_id,positive.authority_revision,
         positive.scope_project_id,positive.actor_code,denied.account_id,
         positive.tenant_id,positive.project_id,
         (select count(distinct assignment.assignment_id)::integer
            from framework_account_actor_assignment assignment
            join framework_project_actor_assignment project_actor
              on project_actor.project_id=positive.project_id
             and project_actor.actor_code=positive.actor_code
             and lower(project_actor.user_id)=lower(denied.account_id)
             and project_actor.active_yn='Y'
           where lower(assignment.account_id)=lower(denied.account_id)
             and assignment.tenant_id=positive.tenant_id
             and assignment.actor_code=positive.actor_code
             and (assignment.project_id='*' or assignment.project_id=positive.project_id)
             and assignment.assignment_status='ACTIVE'
             and assignment.valid_from<=current_date
             and (assignment.valid_until is null or assignment.valid_until>=current_date)
         ) assignment_count
    from positive_choice positive
   cross join active_identity denied
   where denied.denied_role
     and lower(denied.account_id)<>lower(positive.account_id)
), scope_document as (
  select scope.job_id,scope.authority_id,scope.authority_revision,
         scope.project_id,scope.actor_code,
         coalesce((select jsonb_agg(jsonb_build_object(
             'accountId',choice.account_id,'tenantId',choice.tenant_id,
             'projectId',choice.project_id,'assignmentCount',choice.assignment_count)
             order by lower(choice.account_id),choice.tenant_id,choice.project_id)
           from positive_choice choice
          where choice.job_id=scope.job_id and choice.authority_id=scope.authority_id
            and choice.authority_revision=scope.authority_revision
            and choice.scope_project_id=scope.project_id
            and choice.actor_code=scope.actor_code),'[]'::jsonb) positive,
         coalesce((select jsonb_agg(jsonb_build_object(
             'accountId',choice.account_id,'tenantId',choice.tenant_id,
             'projectId',choice.project_id,'assignmentCount',choice.assignment_count)
             order by lower(choice.account_id),choice.tenant_id,choice.project_id)
           from forbidden_choice choice
          where choice.job_id=scope.job_id and choice.authority_id=scope.authority_id
            and choice.authority_revision=scope.authority_revision
            and choice.scope_project_id=scope.project_id
            and choice.actor_code=scope.actor_code),'[]'::jsonb) forbidden
    from scope
), snapshot as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'jobId',job_id,'authorityId',authority_id,
           'authorityRevision',authority_revision,'projectId',project_id,
           'actorCode',actor_code,'positive',positive,'forbidden',forbidden)
           order by job_id,authority_id,authority_revision,project_id collate "C",
                    actor_code collate "C"),'[]'::jsonb) scopes
    from scope_document
), revision_contract as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'jobId',job_id,'projectId',project_id,
           'authorityRevisionSetHash',authority_revision_set_hash)
           order by job_id,project_id collate "C"),'[]'::jsonb) revisions
    from current_dispatch
)
select jsonb_build_object(
  'schema','carbonet.composite-relay-account-candidates/v1',
  'dispatchCount',(select count(*)::integer from current_dispatch),
  'revisionSetHash',framework_composite_live_smoke_hash(
      jsonb_build_object('revisions',revision_contract.revisions)),
  'assignmentSetHash',framework_composite_live_smoke_hash(
      jsonb_build_object('scopes',snapshot.scopes)),
  'scopes',snapshot.scopes)
  from snapshot cross join revision_contract
""".strip()


class ContractError(ValueError):
    """Fail-closed contract error whose message is safe to log."""


class NoCurrentScope(ContractError):
    """There is no current dispatch, so the launcher can skip all slots."""


def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def exact_object(value: Any, keys: set[str], code: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        raise ContractError(code)
    return value


def load_policy(path: Path) -> dict[str, Any]:
    try:
        policy = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError("RELAY_ACCOUNT_POLICY_UNAVAILABLE") from exc
    exact_object(policy, {
        "schema", "environmentVariable", "defaultEnvironmentFile", "defaultStateFile",
        "fileMode", "refreshPolicy", "selectionPolicy", "secretPolicy",
    }, "RELAY_ACCOUNT_POLICY_INVALID")
    selection = exact_object(policy["selectionPolicy"], {
        "dispatchStatuses", "identity", "positive", "positiveDeniedRole",
        "forbidden", "accountIdPattern",
    }, "RELAY_ACCOUNT_POLICY_INVALID")
    secrets = exact_object(policy["secretPolicy"], {
        "requiredExternalEnvironment", "persistSecrets", "logSecrets",
    }, "RELAY_ACCOUNT_POLICY_INVALID")
    if (policy["schema"] != POLICY_SCHEMA
            or policy["environmentVariable"] != "CARBONET_COMPOSITE_RELAY_ACCOUNTS_JSON"
            or not isinstance(policy["defaultEnvironmentFile"], str)
            or not PurePosixPath(policy["defaultEnvironmentFile"]).is_absolute()
            or not isinstance(policy["defaultStateFile"], str)
            or not PurePosixPath(policy["defaultStateFile"]).is_absolute()
            or policy["defaultEnvironmentFile"] == policy["defaultStateFile"]
            or policy["fileMode"] != "0600"
            or policy["refreshPolicy"] != "EVERY_LAUNCH_AND_AUTHORITY_REVISION"
            or selection["dispatchStatuses"] != ["QUEUED", "RETRY_WAIT", "RUNNING"]
            or selection["identity"] != "EXACT_ONE_ACTIVE_AUTHENTICATED_IDENTITY"
            or selection["positive"] != "EXACT_ONE_ACTIVE_ACCOUNT_ACTOR_PROJECT_ASSIGNMENT"
            or selection["positiveDeniedRole"] != "EXCLUDED"
            or selection["forbidden"] != "EXACT_ONE_ACTIVE_AUTHENTICATED_UNASSIGNED_ACCOUNT"
            or selection["accountIdPattern"] != "^[A-Za-z0-9_-]{2,100}$"
            or secrets["requiredExternalEnvironment"]
                != ["CARBONET_ACTOR_TEST_PASSWORD", "RESONANCE_OPS_TOKEN"]
            or secrets["persistSecrets"] is not False or secrets["logSecrets"] is not False):
        raise ContractError("RELAY_ACCOUNT_POLICY_INVALID")
    try:
        re.compile(selection["accountIdPattern"])
    except (TypeError, re.error) as exc:
        raise ContractError("RELAY_ACCOUNT_POLICY_INVALID") from exc
    return policy


def require_external_secrets(policy: dict[str, Any], environment: Mapping[str, str]) -> None:
    required = policy["secretPolicy"]["requiredExternalEnvironment"]
    if any(not isinstance(environment.get(name), str) or not environment[name].strip()
           for name in required):
        raise ContractError("EXTERNAL_LIVE_SMOKE_SECRETS_REQUIRED")


def load_snapshot_from_database(root: Path) -> dict[str, Any]:
    helper = root / "ops/scripts/lib/carbonet-postgres-query.sh"
    if not helper.is_file() or helper.is_symlink():
        raise ContractError("DATABASE_QUERY_ADAPTER_UNAVAILABLE")
    shell = r'''set -Eeuo pipefail
source "$1"
carbonet_postgres_query_init
sql="$(command cat)"
carbonet_postgres_query "$sql"
'''
    query_environment = os.environ.copy()
    for secret_name in ("CARBONET_ACTOR_TEST_PASSWORD", "RESONANCE_OPS_TOKEN",
                        "CARBONET_COMPOSITE_RELAY_ACCOUNTS_JSON"):
        query_environment.pop(secret_name, None)
    try:
        result = subprocess.run(
            ["bash", "-c", shell, "composite-relay-account-map", str(helper)],
            input=DB_SNAPSHOT_SQL, text=True, capture_output=True, timeout=30,
            check=False, env=query_environment,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ContractError("DATABASE_RELAY_ACCOUNT_QUERY_FAILED") from exc
    if result.returncode != 0:
        raise ContractError("DATABASE_RELAY_ACCOUNT_QUERY_FAILED")
    candidates = [line.strip() for line in result.stdout.splitlines()
                  if line.strip().startswith("{")]
    if not candidates:
        raise ContractError("DATABASE_RELAY_ACCOUNT_SNAPSHOT_INVALID")
    try:
        return json.loads(candidates[-1])
    except json.JSONDecodeError as exc:
        raise ContractError("DATABASE_RELAY_ACCOUNT_SNAPSHOT_INVALID") from exc


def load_snapshot(root: Path, environment: Mapping[str, str]) -> dict[str, Any]:
    fixture = environment.get("CARBONET_COMPOSITE_RELAY_MAP_TEST_FIXTURE", "")
    if not fixture:
        return load_snapshot_from_database(root)
    if environment.get("CARBONET_COMPOSITE_RELAY_MAP_TEST_MODE") != "true":
        raise ContractError("TEST_FIXTURE_MODE_FORBIDDEN")
    path = Path(fixture)
    if not path.is_file() or path.is_symlink():
        raise ContractError("TEST_FIXTURE_INVALID")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError("TEST_FIXTURE_INVALID") from exc


def validate_candidate(raw: Any, account_pattern: re.Pattern[str]) -> dict[str, Any]:
    row = exact_object(raw, {"accountId", "tenantId", "projectId", "assignmentCount"},
                       "RELAY_ASSIGNMENT_CANDIDATE_INVALID")
    if (not isinstance(row["accountId"], str)
            or not account_pattern.fullmatch(row["accountId"])
            or not isinstance(row["tenantId"], str) or not row["tenantId"]
            or not isinstance(row["projectId"], str) or not row["projectId"]
            or isinstance(row["assignmentCount"], bool)
            or not isinstance(row["assignmentCount"], int)
            or row["assignmentCount"] < 0):
        raise ContractError("RELAY_ASSIGNMENT_CANDIDATE_INVALID")
    return row


def build_artifacts(snapshot: Any, policy: dict[str, Any]) -> tuple[str, str, dict[str, str]]:
    snapshot = exact_object(snapshot, {
        "schema", "dispatchCount", "revisionSetHash", "assignmentSetHash", "scopes",
    },
                            "RELAY_ACCOUNT_SNAPSHOT_INVALID")
    if (snapshot["schema"] != SNAPSHOT_SCHEMA
            or isinstance(snapshot["dispatchCount"], bool)
            or not isinstance(snapshot["dispatchCount"], int)
            or snapshot["dispatchCount"] < 0
            or not isinstance(snapshot["revisionSetHash"], str)
            or not HASH.fullmatch(snapshot["revisionSetHash"])
            or not isinstance(snapshot["assignmentSetHash"], str)
            or not HASH.fullmatch(snapshot["assignmentSetHash"])
            or not isinstance(snapshot["scopes"], list)):
        raise ContractError("RELAY_ACCOUNT_SNAPSHOT_INVALID")
    if not snapshot["scopes"]:
        if snapshot["dispatchCount"] == 0:
            raise NoCurrentScope("NO_CURRENT_LIVE_SMOKE_SCOPE")
        raise ContractError("CURRENT_RELAY_ASSIGNMENT_SCOPE_REQUIRED")
    if snapshot["dispatchCount"] == 0:
        raise ContractError("RELAY_ACCOUNT_SNAPSHOT_INVALID")
    account_pattern = re.compile(policy["selectionPolicy"]["accountIdPattern"])
    positive_by_actor: dict[str, str] = {}
    forbidden_by_actor: dict[str, str] = {}
    positive_owner_by_id: dict[str, str] = {}
    scope_identities: list[tuple[int, int, int, str, str]] = []
    for raw_scope in snapshot["scopes"]:
        scope = exact_object(raw_scope, {
            "jobId", "authorityId", "authorityRevision", "projectId", "actorCode",
            "positive", "forbidden",
        }, "RELAY_ASSIGNMENT_SCOPE_INVALID")
        if (any(isinstance(scope[key], bool) or not isinstance(scope[key], int) or scope[key] < 1
                for key in ("jobId", "authorityId", "authorityRevision"))
                or not isinstance(scope["projectId"], str) or not scope["projectId"]
                or not isinstance(scope["actorCode"], str) or not ACTOR.fullmatch(scope["actorCode"])
                or not isinstance(scope["positive"], list)
                or not isinstance(scope["forbidden"], list)):
            raise ContractError("RELAY_ASSIGNMENT_SCOPE_INVALID")
        scope_identities.append((scope["jobId"], scope["authorityId"],
                                 scope["authorityRevision"], scope["projectId"],
                                 scope["actorCode"]))
        if not scope["positive"]:
            raise ContractError("ACTIVE_RELAY_ASSIGNMENT_MISSING")
        if len(scope["positive"]) != 1:
            raise ContractError("ACTIVE_RELAY_ASSIGNMENT_AMBIGUOUS")
        if not scope["forbidden"]:
            raise ContractError("FORBIDDEN_RELAY_ACCOUNT_MISSING")
        if len(scope["forbidden"]) != 1:
            raise ContractError("FORBIDDEN_RELAY_ACCOUNT_AMBIGUOUS")
        positive = validate_candidate(scope["positive"][0], account_pattern)
        forbidden = validate_candidate(scope["forbidden"][0], account_pattern)
        if positive["assignmentCount"] != 1:
            raise ContractError("ACTIVE_RELAY_ASSIGNMENT_NOT_EXACT")
        if forbidden["assignmentCount"] != 0:
            raise ContractError("FORBIDDEN_RELAY_ASSIGNMENT_NOT_ZERO")
        if (scope["projectId"] != "*" and positive["projectId"] != scope["projectId"]
                or forbidden["tenantId"] != positive["tenantId"]
                or forbidden["projectId"] != positive["projectId"]):
            raise ContractError("RELAY_ASSIGNMENT_SCOPE_MISMATCH")
        actor = scope["actorCode"]
        prior_positive = positive_by_actor.setdefault(actor, positive["accountId"])
        prior_forbidden = forbidden_by_actor.setdefault(actor, forbidden["accountId"])
        if prior_positive != positive["accountId"]:
            raise ContractError("ACTIVE_RELAY_ACCOUNT_AMBIGUOUS_ACROSS_SCOPES")
        if prior_forbidden != forbidden["accountId"]:
            raise ContractError("FORBIDDEN_RELAY_ACCOUNT_AMBIGUOUS_ACROSS_SCOPES")
        account_key = positive["accountId"].casefold()
        prior_actor = positive_owner_by_id.setdefault(account_key, actor)
        if prior_actor != actor:
            raise ContractError("RELAY_ACCOUNT_ACTOR_ISOLATION_REQUIRED")
    if len(scope_identities) != len(set(scope_identities)):
        raise ContractError("RELAY_ASSIGNMENT_SCOPE_DUPLICATED")
    if scope_identities != sorted(scope_identities):
        raise ContractError("RELAY_ASSIGNMENT_SCOPE_ORDER_INVALID")
    positive_ids = {value.casefold() for value in positive_by_actor.values()}
    if any(value.casefold() in positive_ids for value in forbidden_by_actor.values()):
        raise ContractError("FORBIDDEN_RELAY_ACCOUNT_MUST_BE_UNASSIGNED")
    account_map: dict[str, str] = {}
    for actor in sorted(positive_by_actor):
        account_map[actor] = positive_by_actor[actor]
        account_map[f"FORBIDDEN:{actor}"] = forbidden_by_actor[actor]
    map_json = stable(account_map)
    map_hash = hashlib.sha256(map_json.encode("utf-8")).hexdigest()
    state = {
        "schema": STATE_SCHEMA,
        "authorityRevisionSetHash": snapshot["revisionSetHash"],
        "assignmentSetHash": snapshot["assignmentSetHash"],
        "accountMapHash": map_hash,
        "scopeCount": len(snapshot["scopes"]),
        "dispatchCount": snapshot["dispatchCount"],
        "actorCount": len(positive_by_actor),
        "source": "DATABASE_ACTIVE_ASSIGNMENTS_PROJECT_ROLES",
    }
    environment_line = f"{policy['environmentVariable']}='{map_json}'\n"
    return environment_line, stable(state) + "\n", account_map


def prepare_destination(path: Path) -> None:
    parent = path.parent
    parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    existing_ancestors = (parent, *(ancestor for ancestor in parent.parents if ancestor.exists()))
    if (any(ancestor.is_symlink() for ancestor in existing_ancestors)
            or path.is_symlink() or (path.exists() and not path.is_file())):
        raise ContractError("RELAY_ACCOUNT_OUTPUT_PATH_UNSAFE")


def atomic_write(path: Path, content: str) -> None:
    prepare_destination(path)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, stat.S_IRUSR | stat.S_IWUSR)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
            descriptor = -1
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        temporary.unlink(missing_ok=True)


def exact_file(path: Path, expected: str) -> bool:
    if not path.is_file() or path.is_symlink():
        return False
    try:
        mode_is_exact = (os.name != "posix"
                         or stat.S_IMODE(path.stat().st_mode)
                            == (stat.S_IRUSR | stat.S_IWUSR))
        return mode_is_exact and path.read_text(encoding="utf-8") == expected
    except OSError:
        return False


def parse_args(arguments: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output-env", type=Path)
    parser.add_argument("--state", type=Path)
    parser.add_argument("--check", action="store_true")
    return parser.parse_args(arguments)


def run(arguments: list[str], environment: Mapping[str, str]) -> int:
    options = parse_args(arguments)
    policy = load_policy(options.manifest)
    require_external_secrets(policy, environment)
    root = Path(environment.get("RESONANCE_ROOT", str(ROOT))).resolve()
    snapshot = load_snapshot(root, environment)
    environment_content, state_content, _ = build_artifacts(snapshot, policy)
    environment_path = options.output_env or Path(policy["defaultEnvironmentFile"])
    state_path = options.state or Path(policy["defaultStateFile"])
    if environment_path.resolve() == state_path.resolve():
        raise ContractError("RELAY_ACCOUNT_OUTPUT_PATHS_MUST_DIFFER")
    if options.check:
        if (not exact_file(environment_path, environment_content)
                or not exact_file(state_path, state_content)):
            raise ContractError("RELAY_ACCOUNT_MAP_STALE")
        return 0
    atomic_write(environment_path, environment_content)
    atomic_write(state_path, state_content)
    if (not exact_file(environment_path, environment_content)
            or not exact_file(state_path, state_content)):
        raise ContractError("RELAY_ACCOUNT_MAP_PUBLICATION_FAILED")
    return 0


def main() -> int:
    try:
        return run(sys.argv[1:], os.environ)
    except NoCurrentScope:
        return 10
    except ContractError as exc:
        sys.stderr.write(f"[composite-relay-account-map] {exc}\n")
        return 2
    except Exception:
        sys.stderr.write("[composite-relay-account-map] INTERNAL_FAILURE\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
