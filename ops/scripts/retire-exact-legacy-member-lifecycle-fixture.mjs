#!/usr/bin/env node
import crypto from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  existsSync,
  fsyncSync,
  lstatSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const EXIT_BLOCKED = 79;
const RETIREMENT_ID = "legacy-member-lifecycle-20260806-22877354";
const FIXTURE = Object.freeze({
  tenantId: "TEST_COMPANY_001",
  projectId: "PRJ-ACTOR-TEST",
  processCode: "MEMBER_LIFECYCLE",
  executionId: "22877354-a7a7-48ce-b60b-b296e2a75321",
  initiatedBy: "qaowner26",
  executionStatus: "COMPLETED",
  currentState: "COMPLETED",
  startedAt: "2026-08-06T02:08:58.330654",
  completedAt: "2026-08-06T02:09:00.953069",
  snapshotRef: "qa:22877354-a7a7-48ce-b60b-b296e2a75321:MEMBER_LIFECYCLE_04_APPROVE",
  eventCount: 4,
  draftCount: 4,
});
const RESET_TARGET = Object.freeze({ stepCode: "MEMBER_LIFECYCLE_01_PLAN", fromState: "DRAFT" });
const ACTOR_ACCOUNTS = Object.freeze(["qaowner26", "qadata26", "qaverify26", "qaapprove26"]);

class BlockedError extends Error {}
function blocked(message) { throw new BlockedError(message); }
function safeError(error) {
  return String(error instanceof Error ? error.message : error)
    .replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").slice(0, 600);
}
function boundedInteger(raw, fallback, minimum, maximum, label) {
  const normalized = String(raw || fallback);
  if (!/^\d+$/.test(normalized)) blocked(`${label} must be an integer`);
  const parsed = Number(normalized);
  if (parsed < minimum || parsed > maximum) blocked(`${label} must be between ${minimum} and ${maximum}`);
  return parsed;
}

const lockFile = String(process.env.CARBONET_QA_AUTH_LOCK_FILE || "/tmp/carbonet-qa-auth-session.lock");
const lockTimeoutSeconds = String(process.env.CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS || "60");
if (process.env.CARBONET_MEMBER_RETIRE_LOCK_HELD !== "1") {
  if (!/^[1-9]\d{0,3}$/.test(lockTimeoutSeconds)) blocked("invalid QA authentication lock timeout");
  const child = spawnSync("flock", [
    "-F", "-E", "75", "-w", lockTimeoutSeconds, lockFile,
    process.execPath, ...process.argv.slice(1),
  ], {
    stdio: "inherit",
    env: { ...process.env, CARBONET_MEMBER_RETIRE_LOCK_HELD: "1" },
    timeout: (Number(lockTimeoutSeconds) + 180) * 1_000,
  });
  if (child.error) {
    console.error(`[legacy-member-retirement] BLOCKED ${safeError(child.error)}`);
    process.exit(EXIT_BLOCKED);
  }
  if (child.status === 75) {
    console.error(`[legacy-member-retirement] RETRY canonical QA authentication lock timed out after ${lockTimeoutSeconds}s`);
  }
  process.exit(child.status ?? EXIT_BLOCKED);
}
delete process.env.CARBONET_MEMBER_RETIRE_LOCK_HELD;

const startedAtMs = Date.now();
const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const namespace = String(process.env.K8S_NAMESPACE || "carbonet-prod");
const deployment = String(process.env.CARBONET_K8S_DEPLOYMENT || "carbonet-runtime");
const postgresDatabase = String(process.env.POSTGRES_DB || "carbonet");
const postgresUser = String(process.env.POSTGRES_ADMIN_USER || "postgres");
const postgresContainer = String(process.env.CARBONET_POSTGRES_CONTAINER || "patroni");
const credentialSecret = String(process.env.CARBONET_MEMBER_RETIRE_AUTH_SECRET || "carbonet-usage-ledger-system-admin");
const retiredRoot = path.resolve(process.env.CARBONET_MEMBER_RETIRE_EVIDENCE_DIR
  || "/opt/resonance-data/deploy/retired-attempts/member-lifecycle");
const commandTimeoutMs = boundedInteger(process.env.CARBONET_MEMBER_RETIRE_COMMAND_TIMEOUT_MS, 45_000, 5_000, 120_000, "command timeout");
const operationMode = String(process.env.CARBONET_MEMBER_RETIRE_MODE || "retire").toLowerCase();
if (!new Set(["retire", "inspect"]).has(operationMode)) blocked("retirement mode must be retire or inspect");
const archivePath = path.join(retiredRoot, `${RETIREMENT_ID}.snapshot.json`);
const receiptPath = path.join(retiredRoot, `${RETIREMENT_ID}.retired.json`);
let postgresPod = "";

function requireIdentifier(value, label, pattern) {
  const normalized = String(value || "");
  if (!pattern.test(normalized)) blocked(`${label} is invalid`);
  return normalized;
}
requireIdentifier(namespace, "Kubernetes namespace", /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);
requireIdentifier(deployment, "Kubernetes deployment", /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);
requireIdentifier(postgresDatabase, "PostgreSQL database", /^[A-Za-z_][A-Za-z0-9_]{0,62}$/);
requireIdentifier(postgresUser, "PostgreSQL user", /^[A-Za-z_][A-Za-z0-9_]{0,62}$/);
requireIdentifier(postgresContainer, "PostgreSQL container", /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);
requireIdentifier(credentialSecret, "credential Secret", /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/);

function run(file, args, { input, label, timeout = commandTimeoutMs } = {}) {
  try {
    return execFileSync(file, args, {
      input,
      encoding: "utf8",
      timeout,
      maxBuffer: 16 * 1024 * 1024,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    blocked(`${label || file} failed`);
  }
}
function kubectl(args, options = {}) {
  return run("kubectl", ["-n", namespace, ...args], { ...options, label: options.label || "kubectl operation" });
}
function git(args, label) { return run("git", args, { label, timeout: 15_000 }); }
function sqlLiteral(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function sha256Buffer(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}
function stableJson(value) { return JSON.stringify(stableValue(value)); }

function ensurePrivateDirectory(directory) {
  const parent = path.dirname(directory);
  const parentStat = lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()
      || parentStat.uid !== process.getuid() || parentStat.gid !== process.getgid()
      || (parentStat.mode & 0o777) !== 0o700) {
    blocked("retirement evidence parent is not a trusted owned directory");
  }
  if (!existsSync(directory)) mkdirSync(directory, { mode: 0o700 });
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()
      || stat.gid !== process.getgid() || (stat.mode & 0o777) !== 0o700) {
    blocked("retirement evidence directory must be an owned non-symlink mode-0700 directory");
  }
}
function syncDirectory(directory) {
  const descriptor = openSync(directory, fsConstants.O_RDONLY);
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}
function immutableFile(pathname) {
  const stat = lstatSync(pathname);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid()
      || stat.gid !== process.getgid() || (stat.mode & 0o777) !== 0o400 || stat.nlink !== 1) {
    blocked(`immutable evidence metadata is invalid: ${path.basename(pathname)}`);
  }
  const bytes = readFileSync(pathname);
  let value;
  try { value = JSON.parse(bytes.toString("utf8")); }
  catch { blocked(`immutable evidence JSON is malformed: ${path.basename(pathname)}`); }
  return { bytes, sha256: sha256Buffer(bytes), value };
}
function writeImmutable(pathname, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (existsSync(pathname)) {
    const existing = immutableFile(pathname);
    if (!existing.bytes.equals(bytes)) blocked(`existing immutable evidence differs: ${path.basename(pathname)}`);
    return existing;
  }
  const temporary = path.join(path.dirname(pathname), `.${path.basename(pathname)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  let linked = false;
  try {
    const descriptor = openSync(temporary, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
    try {
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
    } finally { closeSync(descriptor); }
    chmodSync(temporary, 0o400);
    const staged = lstatSync(temporary);
    if (!staged.isFile() || staged.isSymbolicLink() || staged.uid !== process.getuid()
        || staged.gid !== process.getgid() || (staged.mode & 0o777) !== 0o400 || staged.nlink !== 1
        || sha256Buffer(readFileSync(temporary)) !== sha256Buffer(bytes)) {
      blocked("immutable evidence staging verification failed");
    }
    linkSync(temporary, pathname);
    linked = true;
    syncDirectory(path.dirname(pathname));
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
    if (linked) syncDirectory(path.dirname(pathname));
  }
  return immutableFile(pathname);
}

function loadDedicatedSecret() {
  const raw = kubectl(["get", "secret", credentialSecret, "-o", "json"], { label: "dedicated retirement Secret read" });
  let secret;
  try { secret = JSON.parse(raw); } catch { blocked("dedicated retirement Secret JSON is malformed"); }
  const keys = Object.keys(secret.data || {}).sort();
  if (secret?.metadata?.name !== credentialSecret || secret?.type !== "Opaque"
      || stableJson(keys) !== stableJson(["password", "username"])
      || secret?.metadata?.labels?.["resonance.ai/purpose"] !== "usage-ledger-system-admin") {
    blocked("dedicated retirement Secret contract is invalid");
  }
  let username = "";
  let password = "";
  try {
    username = Buffer.from(String(secret.data.username), "base64").toString("utf8");
    password = Buffer.from(String(secret.data.password), "base64").toString("utf8");
  } catch { blocked("dedicated retirement Secret encoding is invalid"); }
  if (!/^qa[a-z0-9_.@-]{2,63}$/i.test(username) || username.toLowerCase() === "webmaster"
      || ACTOR_ACCOUNTS.includes(username.toLowerCase()) || !password || /[\r\n]/.test(password)) {
    password = "";
    blocked("dedicated retirement credential contract is invalid");
  }
  password = "";
  return username.toLowerCase();
}

function bindLiveTarget(requireSourceMatch = true) {
  const sourceCommit = git(["-C", root, "rev-parse", "HEAD"], "source commit resolution");
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) blocked("source commit is invalid");
  const status = git(["-C", root, "status", "--porcelain"], "source worktree status");
  if (requireSourceMatch && status) blocked("source worktree is not clean");
  const raw = kubectl(["get", `deployment/${deployment}`, "-o", "json"], { label: "runtime deployment identity read" });
  let live;
  try { live = JSON.parse(raw); } catch { blocked("runtime deployment identity JSON is malformed"); }
  const replicas = Number(live?.spec?.replicas || 0);
  const liveTargetCommit = String(live?.metadata?.annotations?.["resonance.ai/target-commit"] || "");
  if (!/^[0-9a-f]{40}$/.test(liveTargetCommit) || (requireSourceMatch && liveTargetCommit !== sourceCommit)
      || replicas < 1 || Number(live?.status?.observedGeneration) !== Number(live?.metadata?.generation)
      || Number(live?.status?.updatedReplicas) !== replicas || Number(live?.status?.readyReplicas) !== replicas
      || Number(live?.status?.availableReplicas) !== replicas || Number(live?.status?.unavailableReplicas || 0) !== 0) {
    blocked("runtime deployment is not stably bound to the source commit");
  }
  return { sourceCommit, liveTargetCommit };
}

function resolvePrimaryPod() {
  const names = kubectl(["get", "pods", "-l", "app=postgres-patroni", "-o", "jsonpath={range .items[*]}{.metadata.name}{'\\n'}{end}"],
    { label: "Patroni pod discovery" }).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const leaders = names.filter((name) => {
    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) return false;
    try {
      return kubectl(["exec", name, "-c", postgresContainer, "--", "psql", "-h", "127.0.0.1", "-U", postgresUser,
        "-d", postgresDatabase, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", "select pg_is_in_recovery()"],
      { label: "Patroni role probe", timeout: 15_000 }) === "f";
    } catch { return false; }
  });
  if (leaders.length !== 1) blocked(`expected one writable Patroni primary, observed ${leaders.length}`);
  return leaders[0];
}
function psql(sql, label) {
  return kubectl(["exec", "-i", postgresPod, "-c", postgresContainer, "--", "psql", "-h", "127.0.0.1", "-U", postgresUser,
    "-d", postgresDatabase, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: sql, label, timeout: commandTimeoutMs });
}

function otherFingerprintSql() {
  return `jsonb_build_object(
    'execution',jsonb_build_object('count',(select count(*) from framework_process_execution other_execution where other_execution.execution_id<>${sqlLiteral(FIXTURE.executionId)}::uuid),'fingerprint',(select md5(coalesce(string_agg(md5(to_jsonb(other_execution)::text),'' order by other_execution.execution_id::text),'')) from framework_process_execution other_execution where other_execution.execution_id<>${sqlLiteral(FIXTURE.executionId)}::uuid)),
    'event',jsonb_build_object('count',(select count(*) from framework_process_execution_event other_event where other_event.execution_id<>${sqlLiteral(FIXTURE.executionId)}::uuid),'fingerprint',(select md5(coalesce(string_agg(md5(to_jsonb(other_event)::text),'' order by other_event.event_id::text),'')) from framework_process_execution_event other_event where other_event.execution_id<>${sqlLiteral(FIXTURE.executionId)}::uuid)),
    'draft',jsonb_build_object('count',(select count(*) from framework_process_work_draft other_draft where not(other_draft.tenant_id=${sqlLiteral(FIXTURE.tenantId)} and other_draft.project_id=${sqlLiteral(FIXTURE.projectId)} and other_draft.process_code=${sqlLiteral(FIXTURE.processCode)})),'fingerprint',(select md5(coalesce(string_agg(md5(to_jsonb(other_draft)::text),'' order by other_draft.draft_id::text),'')) from framework_process_work_draft other_draft where not(other_draft.tenant_id=${sqlLiteral(FIXTURE.tenantId)} and other_draft.project_id=${sqlLiteral(FIXTURE.projectId)} and other_draft.process_code=${sqlLiteral(FIXTURE.processCode)}))))`;
}

function snapshotSql(adminUser) {
  const tokenUsers = [adminUser, ...ACTOR_ACCOUNTS].map(sqlLiteral).join(",");
  return `/* LEGACY_MEMBER_RETIRE_SNAPSHOT_V1 */
with scoped_execution as materialized (
  select * from framework_process_execution
   where tenant_id=${sqlLiteral(FIXTURE.tenantId)} and project_id=${sqlLiteral(FIXTURE.projectId)} and process_code=${sqlLiteral(FIXTURE.processCode)}
), scoped_event as materialized (
  select event.* from framework_process_execution_event event join scoped_execution execution on execution.execution_id=event.execution_id
), scoped_draft as materialized (
  select * from framework_process_work_draft
   where tenant_id=${sqlLiteral(FIXTURE.tenantId)} and project_id=${sqlLiteral(FIXTURE.projectId)} and process_code=${sqlLiteral(FIXTURE.processCode)}
), measured as (
  select (select count(*) from scoped_execution) execution_count,
         (select count(*) from scoped_event) event_count,
         (select count(*) from scoped_draft) draft_count,
         (select count(*) from COMTNAUTHTOKENSTORE where lower(user_id) in (${tokenUsers}) and (expiration_at is null or expiration_at>current_timestamp)) active_token_count
), target_rows as (
  select jsonb_build_object(
    'execution',coalesce((select to_jsonb(execution) from scoped_execution execution),'null'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(event) order by event.event_id) from scoped_event event),'[]'::jsonb),
    'drafts',coalesce((select jsonb_agg(to_jsonb(draft) order by draft.draft_id) from scoped_draft draft),'[]'::jsonb)
  ) value
)
select jsonb_build_object(
  'schemaVersion',1,'retirementId',${sqlLiteral(RETIREMENT_ID)},
  'state',case
    when measured.execution_count=0 and measured.event_count=0 and measured.draft_count=0 and measured.active_token_count=0 then 'ABSENT'
    when measured.execution_count=1 and measured.event_count=${FIXTURE.eventCount} and measured.draft_count=${FIXTURE.draftCount} and measured.active_token_count=0
      and exists(select 1 from scoped_execution execution where execution.execution_id=${sqlLiteral(FIXTURE.executionId)}::uuid
        and execution.initiated_by=${sqlLiteral(FIXTURE.initiatedBy)} and execution.execution_status=${sqlLiteral(FIXTURE.executionStatus)}
        and execution.current_state=${sqlLiteral(FIXTURE.currentState)} and to_char(execution.started_at,'YYYY-MM-DD"T"HH24:MI:SS.US')=${sqlLiteral(FIXTURE.startedAt)}
        and to_char(execution.completed_at,'YYYY-MM-DD"T"HH24:MI:SS.US')=${sqlLiteral(FIXTURE.completedAt)}
        and execution.snapshot_ref=${sqlLiteral(FIXTURE.snapshotRef)} and execution.site_scope#>'{qaProvenance}' is null)
      and not exists(select 1 from scoped_event event where framework_try_jsonb(event.request_json,'{}'::jsonb)#>'{qaProvenance}' is not null or framework_try_jsonb(event.result_json,'{}'::jsonb)#>'{qaProvenance}' is not null)
      and not exists(select 1 from scoped_draft draft where draft.evidence_json#>'{qaProvenance}' is not null)
      then 'EXACT'
    else 'MISMATCH' end,
  'counts',jsonb_build_object('execution',measured.execution_count,'event',measured.event_count,'draft',measured.draft_count,'activeToken',measured.active_token_count),
  'contract',jsonb_build_object('tenantId',${sqlLiteral(FIXTURE.tenantId)},'projectId',${sqlLiteral(FIXTURE.projectId)},'processCode',${sqlLiteral(FIXTURE.processCode)},
    'executionId',${sqlLiteral(FIXTURE.executionId)},'initiatedBy',${sqlLiteral(FIXTURE.initiatedBy)},'executionStatus',${sqlLiteral(FIXTURE.executionStatus)},
    'currentState',${sqlLiteral(FIXTURE.currentState)},'startedAt',${sqlLiteral(FIXTURE.startedAt)},'completedAt',${sqlLiteral(FIXTURE.completedAt)},
    'snapshotRef',${sqlLiteral(FIXTURE.snapshotRef)},'eventCount',${FIXTURE.eventCount},'draftCount',${FIXTURE.draftCount},'qaProvenance','ABSENT'),
  'targetRows',target_rows.value,'otherRowsFingerprint',${otherFingerprintSql()}
)::text from measured cross join target_rows;
`;
}

function querySnapshot(adminUser) {
  const output = psql(snapshotSql(adminUser), "legacy fixture snapshot query");
  let snapshot;
  try { snapshot = JSON.parse(output); } catch { blocked("legacy fixture snapshot JSON is malformed"); }
  if (snapshot?.schemaVersion !== 1 || snapshot?.retirementId !== RETIREMENT_ID
      || !["EXACT", "ABSENT", "MISMATCH"].includes(snapshot?.state)) {
    blocked("legacy fixture snapshot envelope is invalid");
  }
  return snapshot;
}

function mutationSql(adminUser, archivedSnapshot, archiveSha256) {
  const tokenUsers = [adminUser, ...ACTOR_ACCOUNTS].map(sqlLiteral).join(",");
  const expectedRows = sqlLiteral(JSON.stringify(archivedSnapshot.targetRows));
  return `/* LEGACY_MEMBER_RETIRE_RESET_DELETE_V1 */
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table framework_process_execution,framework_process_execution_event,framework_process_work_draft,COMTNAUTHTOKENSTORE in share row exclusive mode;
create temp table legacy_member_retire_result(payload jsonb) on commit drop;
do $retire$
declare
  actual_rows jsonb; other_before jsonb; other_after jsonb;
  execution_count integer; event_count integer; draft_count integer; token_count integer;
  reset_events integer; reset_drafts integer; reset_executions integer; deleted_executions integer;
begin
  select count(*) into execution_count from framework_process_execution where tenant_id=${sqlLiteral(FIXTURE.tenantId)} and project_id=${sqlLiteral(FIXTURE.projectId)} and process_code=${sqlLiteral(FIXTURE.processCode)};
  select count(*) into event_count from framework_process_execution_event event join framework_process_execution execution on execution.execution_id=event.execution_id where execution.tenant_id=${sqlLiteral(FIXTURE.tenantId)} and execution.project_id=${sqlLiteral(FIXTURE.projectId)} and execution.process_code=${sqlLiteral(FIXTURE.processCode)};
  select count(*) into draft_count from framework_process_work_draft where tenant_id=${sqlLiteral(FIXTURE.tenantId)} and project_id=${sqlLiteral(FIXTURE.projectId)} and process_code=${sqlLiteral(FIXTURE.processCode)};
  select count(*) into token_count from COMTNAUTHTOKENSTORE where lower(user_id) in (${tokenUsers}) and (expiration_at is null or expiration_at>current_timestamp);
  if execution_count<>1 or event_count<>${FIXTURE.eventCount} or draft_count<>${FIXTURE.draftCount} or token_count<>0 then raise exception 'LEGACY_MEMBER_RETIRE_CAS_COUNTS'; end if;
  select jsonb_build_object(
    'execution',coalesce((select to_jsonb(execution) from framework_process_execution execution where execution.execution_id=${sqlLiteral(FIXTURE.executionId)}::uuid),'null'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(event) order by event.event_id) from framework_process_execution_event event where event.execution_id=${sqlLiteral(FIXTURE.executionId)}::uuid),'[]'::jsonb),
    'drafts',coalesce((select jsonb_agg(to_jsonb(draft) order by draft.draft_id) from framework_process_work_draft draft where draft.tenant_id=${sqlLiteral(FIXTURE.tenantId)} and draft.project_id=${sqlLiteral(FIXTURE.projectId)} and draft.process_code=${sqlLiteral(FIXTURE.processCode)}),'[]'::jsonb)
  ) into actual_rows;
  if actual_rows is distinct from ${expectedRows}::jsonb then raise exception 'LEGACY_MEMBER_RETIRE_CAS_ARCHIVE_MISMATCH'; end if;
  select ${otherFingerprintSql()} into other_before;

  delete from framework_process_execution_event where execution_id=${sqlLiteral(FIXTURE.executionId)}::uuid;
  get diagnostics reset_events=row_count;
  delete from framework_process_work_draft where tenant_id=${sqlLiteral(FIXTURE.tenantId)} and project_id=${sqlLiteral(FIXTURE.projectId)} and process_code=${sqlLiteral(FIXTURE.processCode)};
  get diagnostics reset_drafts=row_count;
  update framework_process_execution set
    current_step_code=${sqlLiteral(RESET_TARGET.stepCode)},current_state=${sqlLiteral(RESET_TARGET.fromState)},
    execution_status='RUNNING',handoff_status='NOT_READY',snapshot_ref=null,completed_at=null,started_at=current_timestamp,updated_at=current_timestamp
   where execution_id=${sqlLiteral(FIXTURE.executionId)}::uuid;
  get diagnostics reset_executions=row_count;
  if reset_events<>${FIXTURE.eventCount} or reset_drafts<>${FIXTURE.draftCount} or reset_executions<>1 then raise exception 'LEGACY_MEMBER_RETIRE_RESET_CARDINALITY'; end if;
  if not exists(select 1 from framework_process_execution execution where execution.execution_id=${sqlLiteral(FIXTURE.executionId)}::uuid
       and execution.current_step_code=${sqlLiteral(RESET_TARGET.stepCode)} and execution.current_state=${sqlLiteral(RESET_TARGET.fromState)}
       and execution.execution_status='RUNNING' and execution.handoff_status='NOT_READY' and execution.snapshot_ref is null and execution.completed_at is null)
     or exists(select 1 from framework_process_execution_event where execution_id=${sqlLiteral(FIXTURE.executionId)}::uuid)
     or exists(select 1 from framework_process_work_draft where tenant_id=${sqlLiteral(FIXTURE.tenantId)} and project_id=${sqlLiteral(FIXTURE.projectId)} and process_code=${sqlLiteral(FIXTURE.processCode)})
  then raise exception 'LEGACY_MEMBER_RETIRE_RESET_POSTCONDITION'; end if;

  delete from framework_process_execution where execution_id=${sqlLiteral(FIXTURE.executionId)}::uuid;
  get diagnostics deleted_executions=row_count;
  if deleted_executions<>1
     or exists(select 1 from framework_process_execution where tenant_id=${sqlLiteral(FIXTURE.tenantId)} and project_id=${sqlLiteral(FIXTURE.projectId)} and process_code=${sqlLiteral(FIXTURE.processCode)})
  then raise exception 'LEGACY_MEMBER_RETIRE_DELETE_POSTCONDITION'; end if;
  select count(*) into token_count from COMTNAUTHTOKENSTORE where lower(user_id) in (${tokenUsers}) and (expiration_at is null or expiration_at>current_timestamp);
  if token_count<>0 then raise exception 'LEGACY_MEMBER_RETIRE_ACTIVE_TOKEN_DRIFT'; end if;
  select ${otherFingerprintSql()} into other_after;
  if other_after is distinct from other_before then raise exception 'LEGACY_MEMBER_RETIRE_FOREIGN_ROW_DRIFT'; end if;
  insert into legacy_member_retire_result(payload) values(jsonb_build_object(
    'status','RETIRED','retirementId',${sqlLiteral(RETIREMENT_ID)},'executionId',${sqlLiteral(FIXTURE.executionId)},
    'archiveSha256',${sqlLiteral(archiveSha256)},'reset',jsonb_build_object('executions',reset_executions,'events',reset_events,'drafts',reset_drafts,
      'currentStepCode',${sqlLiteral(RESET_TARGET.stepCode)},'fromState',${sqlLiteral(RESET_TARGET.fromState)}),
    'delete',jsonb_build_object('executions',deleted_executions),'activeTokenBefore',0,'activeTokenAfter',0,
    'otherRowsWriteCount',0,'otherRowsFingerprintBefore',other_before,'otherRowsFingerprintAfter',other_after));
end
$retire$;
select payload::text from legacy_member_retire_result;
commit;
`;
}

function mutateExactFixture(adminUser, archivedSnapshot, archiveSha256) {
  const output = psql(mutationSql(adminUser, archivedSnapshot, archiveSha256), "exact legacy fixture RESET and DELETE transaction");
  let result;
  try { result = JSON.parse(output); } catch { blocked("legacy retirement transaction result is malformed"); }
  if (result?.status !== "RETIRED" || result?.retirementId !== RETIREMENT_ID || result?.executionId !== FIXTURE.executionId
      || result?.archiveSha256 !== archiveSha256 || result?.reset?.executions !== 1
      || result?.reset?.events !== FIXTURE.eventCount || result?.reset?.drafts !== FIXTURE.draftCount
      || result?.reset?.currentStepCode !== RESET_TARGET.stepCode || result?.reset?.fromState !== RESET_TARGET.fromState
      || result?.delete?.executions !== 1 || result?.activeTokenBefore !== 0 || result?.activeTokenAfter !== 0
      || result?.otherRowsWriteCount !== 0
      || stableJson(result?.otherRowsFingerprintBefore) !== stableJson(result?.otherRowsFingerprintAfter)) {
    blocked("legacy retirement transaction postcondition is invalid");
  }
  return result;
}

function validateArchiveEnvelope(archive, sourceCommit) {
  const value = archive.value;
  if (value?.schemaVersion !== "carbonet.legacy-member-lifecycle-retirement-archive/v1"
      || value?.retirementId !== RETIREMENT_ID || stableJson(value?.fixture) !== stableJson(FIXTURE)
      || !/^[0-9a-f]{40}$/.test(String(value?.sourceCommit || ""))
      || value?.liveTargetCommit !== value?.sourceCommit || value?.databaseSnapshot?.state !== "EXACT"
      || value?.databaseSnapshot?.retirementId !== RETIREMENT_ID
      || stableJson(value?.databaseSnapshot?.contract) !== stableJson({ ...FIXTURE, qaProvenance: "ABSENT" })
      || value?.databaseSnapshot?.counts?.execution !== 1 || value?.databaseSnapshot?.counts?.event !== FIXTURE.eventCount
      || value?.databaseSnapshot?.counts?.draft !== FIXTURE.draftCount || value?.databaseSnapshot?.counts?.activeToken !== 0) {
    blocked("immutable legacy fixture archive contract is invalid");
  }
  if (sourceCommit && value.sourceCommit !== sourceCommit) blocked("legacy fixture archive belongs to a different deployed source commit");
}
function validateReceiptEnvelope(receipt, archive) {
  const value = receipt.value;
  if (value?.schemaVersion !== "carbonet.legacy-member-lifecycle-retirement-receipt/v1"
      || value?.retirementId !== RETIREMENT_ID || value?.executionId !== FIXTURE.executionId
      || value?.archiveSha256 !== archive.sha256 || value?.archivePath !== archivePath
      || value?.sourceCommit !== archive.value.sourceCommit || value?.status !== "RETIRED"
      || value?.postcondition?.execution !== 0 || value?.postcondition?.event !== 0
      || value?.postcondition?.draft !== 0 || value?.postcondition?.activeToken !== 0
      || value?.otherRowsWriteCount !== 0 || !/^[0-9a-f]{40}$/.test(String(value?.sourceCommit || ""))) {
    blocked("immutable legacy fixture retirement receipt contract is invalid");
  }
}

async function main() {
  const { sourceCommit, liveTargetCommit } = bindLiveTarget(operationMode === "retire");
  const adminUser = loadDedicatedSecret();
  postgresPod = resolvePrimaryPod();
  const initial = querySnapshot(adminUser);

  if (operationMode === "inspect") {
    return { outcome: "INSPECT_ONLY", sourceCommit, liveTargetCommit, snapshot: initial };
  }
  ensurePrivateDirectory(retiredRoot);

  if (initial.state === "MISMATCH") {
    blocked(`legacy fixture is not the exact retireable contract counts=${JSON.stringify(initial.counts)}`);
  }

  const existingArchive = existsSync(archivePath) ? immutableFile(archivePath) : null;
  const existingReceipt = existsSync(receiptPath) ? immutableFile(receiptPath) : null;
  if (existingArchive) validateArchiveEnvelope(existingArchive, "");
  if (existingReceipt) {
    if (!existingArchive) blocked("retirement receipt exists without its immutable archive");
    validateReceiptEnvelope(existingReceipt, existingArchive);
  }

  if (initial.state === "ABSENT") {
    if (!existingArchive) blocked("legacy fixture is absent without an immutable retirement archive");
    const receipt = existingReceipt || writeImmutable(receiptPath, {
      schemaVersion: "carbonet.legacy-member-lifecycle-retirement-receipt/v1",
      retirementId: RETIREMENT_ID,
      status: "RETIRED",
      outcome: "RECOVERED_AFTER_COMMIT",
      executionId: FIXTURE.executionId,
      sourceCommit: existingArchive.value.sourceCommit,
      archivePath,
      archiveSha256: existingArchive.sha256,
      retiredAt: new Date().toISOString(),
      postcondition: { execution: 0, event: 0, draft: 0, activeToken: 0 },
      otherRowsWriteCount: 0,
    });
    validateReceiptEnvelope(receipt, existingArchive);
    return { outcome: existingReceipt ? "ALREADY_RETIRED" : "RECOVERED_AFTER_COMMIT", sourceCommit, archive: existingArchive, receipt };
  }

  if (existingReceipt) blocked("retired fixture was recreated after its immutable receipt");
  const archiveEnvelope = {
    schemaVersion: "carbonet.legacy-member-lifecycle-retirement-archive/v1",
    retirementId: RETIREMENT_ID,
    capturedAt: new Date().toISOString(),
    sourceCommit,
    liveTargetCommit: sourceCommit,
    fixture: FIXTURE,
    databaseSnapshot: initial,
  };
  const archive = existingArchive || writeImmutable(archivePath, archiveEnvelope);
  validateArchiveEnvelope(archive, sourceCommit);
  if (stableJson(archive.value.databaseSnapshot) !== stableJson(initial)) {
    blocked("existing immutable archive differs from the current exact fixture");
  }

  const casSnapshot = querySnapshot(adminUser);
  if (casSnapshot.state !== "EXACT" || stableJson(casSnapshot) !== stableJson(archive.value.databaseSnapshot)) {
    blocked("legacy fixture changed after archival; RESET and DELETE refused");
  }
  const mutation = mutateExactFixture(adminUser, archive.value.databaseSnapshot, archive.sha256);
  const postcondition = querySnapshot(adminUser);
  if (postcondition.state !== "ABSENT" || postcondition.counts?.execution !== 0 || postcondition.counts?.event !== 0
      || postcondition.counts?.draft !== 0 || postcondition.counts?.activeToken !== 0) {
    blocked("legacy fixture post-retirement absence proof failed");
  }
  const archiveReadback = immutableFile(archivePath);
  if (archiveReadback.sha256 !== archive.sha256
      || stableJson(archiveReadback.value) !== stableJson(archive.value)) {
    blocked("immutable legacy fixture archive changed during RESET and DELETE");
  }
  const receipt = writeImmutable(receiptPath, {
    schemaVersion: "carbonet.legacy-member-lifecycle-retirement-receipt/v1",
    retirementId: RETIREMENT_ID,
    status: "RETIRED",
    outcome: "RESET_DELETE_COMMITTED",
    executionId: FIXTURE.executionId,
    sourceCommit,
    archivePath,
    archiveSha256: archiveReadback.sha256,
    retiredAt: new Date().toISOString(),
    mutation,
    postcondition: { execution: 0, event: 0, draft: 0, activeToken: 0 },
    otherRowsWriteCount: 0,
  });
  validateReceiptEnvelope(receipt, archiveReadback);
  return { outcome: "RESET_DELETE_COMMITTED", sourceCommit, liveTargetCommit, archive: archiveReadback, receipt, mutation };
}

try {
  const result = await main();
  console.log(JSON.stringify({
    status: "PASS",
    outcome: result.outcome,
    retirementId: RETIREMENT_ID,
    executionId: FIXTURE.executionId,
    sourceCommit: result.sourceCommit,
    reset: result.mutation?.reset || { executions: 0, events: 0, drafts: 0 },
    deletedExecutions: result.mutation?.delete?.executions || 0,
    otherRowsWriteCount: 0,
    activeTokens: 0,
    liveTargetCommit: result.liveTargetCommit || result.sourceCommit,
    counts: result.snapshot?.counts,
    archivePath: result.archive ? archivePath : null,
    archiveSha256: result.archive?.sha256 || null,
    receiptPath: result.receipt ? receiptPath : null,
    receiptSha256: result.receipt?.sha256 || null,
    durationMs: Date.now() - startedAtMs,
  }));
} catch (error) {
  const reason = safeError(error);
  console.error(`[legacy-member-retirement] BLOCKED ${reason}`);
  process.exit(error instanceof BlockedError ? EXIT_BLOCKED : 1);
}
