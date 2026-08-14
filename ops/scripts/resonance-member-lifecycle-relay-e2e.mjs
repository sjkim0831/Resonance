#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";

const authLockFile = String(process.env.CARBONET_QA_AUTH_LOCK_FILE || "/tmp/carbonet-qa-auth-session.lock");
const authLockTimeoutSeconds = String(process.env.CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS || "60");
if (process.env.CARBONET_MEMBER_RELAY_LOCK_HELD !== "1") {
  if (!/^[1-9]\d{0,3}$/.test(authLockTimeoutSeconds)) throw new Error("invalid QA authentication lock timeout");
  const wrapperStartedAtMs = Date.now();
  const wrapperDeadlineMs = boundedMilliseconds(process.env.CARBONET_MEMBER_RELAY_TOTAL_DEADLINE_MS, 240_000, 30_000, 900_000, "total deadline");
  const lockWaitSeconds = String(Math.min(Number(authLockTimeoutSeconds), wrapperDeadlineMs / 1_000));
  const locked = spawn("flock", [
    "-F", "-w", lockWaitSeconds, authLockFile,
    process.execPath, ...process.argv.slice(1),
  ], {
    stdio: "inherit",
    env: {
      ...process.env,
      CARBONET_MEMBER_RELAY_LOCK_HELD: "1",
      CARBONET_MEMBER_RELAY_STARTED_AT_MS: String(wrapperStartedAtMs),
    },
  });
  const forwardSignal = (signal) => locked.kill(signal);
  const forwardSigterm = () => forwardSignal("SIGTERM");
  const forwardSigint = () => forwardSignal("SIGINT");
  process.once("SIGTERM", forwardSigterm);
  process.once("SIGINT", forwardSigint);
  const lockedResult = await new Promise((resolve) => {
    locked.once("error", () => resolve({ code: 1, error: true }));
    locked.once("exit", (code, signal) => resolve({ code, signal, error: false }));
  });
  process.removeListener("SIGTERM", forwardSigterm);
  process.removeListener("SIGINT", forwardSigint);
  if (lockedResult.error) throw new Error("unable to acquire the canonical QA authentication lock");
  process.exit(lockedResult.code ?? 1);
}
delete process.env.CARBONET_MEMBER_RELAY_LOCK_HELD;
const startedAtRaw = String(process.env.CARBONET_MEMBER_RELAY_STARTED_AT_MS || Date.now());
delete process.env.CARBONET_MEMBER_RELAY_STARTED_AT_MS;
if (!/^\d{13}$/.test(startedAtRaw) || Number(startedAtRaw) > Date.now() + 1_000) {
  throw new Error("invalid member relay start timestamp");
}
const startedAtMs = Number(startedAtRaw);

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium, request } = require("@playwright/test");
const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const namespace = String(process.env.K8S_NAMESPACE || "carbonet-prod");
const postgresDatabase = String(process.env.POSTGRES_DB || "carbonet");
const postgresUser = String(process.env.POSTGRES_ADMIN_USER || "postgres");
const postgresContainer = String(process.env.CARBONET_POSTGRES_CONTAINER || "patroni");
const credentialSecret = String(process.env.CARBONET_MEMBER_RELAY_AUTH_SECRET
  || "carbonet-usage-ledger-system-admin");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const executablePath = ["/snap/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(existsSync);

function boundedMilliseconds(value, fallback, minimum, maximum, label) {
  const normalized = String(value || fallback);
  if (!/^\d+$/.test(normalized)) throw new Error(`${label} must be an integer number of milliseconds`);
  const parsed = Number(normalized);
  if (parsed < minimum || parsed > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum} milliseconds`);
  return parsed;
}

const requestTimeoutMs = boundedMilliseconds(process.env.CARBONET_MEMBER_RELAY_REQUEST_TIMEOUT_MS, 15_000, 1_000, 60_000, "request timeout");
const totalDeadlineMs = boundedMilliseconds(process.env.CARBONET_MEMBER_RELAY_TOTAL_DEADLINE_MS, 240_000, 30_000, 900_000, "total deadline");
const cleanupBudgetMs = boundedMilliseconds(process.env.CARBONET_MEMBER_RELAY_CLEANUP_BUDGET_MS, 90_000, 15_000, 300_000, "cleanup budget");

const tenantId = "TEST_COMPANY_001";
const projectId = "PRJ-ACTOR-TEST";
const processCode = "MEMBER_LIFECYCLE";
const provenanceHarness = "resonance-member-lifecycle-relay-e2e";
const steps = [
  { stepCode: "MEMBER_LIFECYCLE_01_PLAN", actorCode: "COMPANY_MANAGER", accountId: "qaowner26", commandCode: "PLAN" },
  { stepCode: "MEMBER_LIFECYCLE_02_WORK", actorCode: "SITE_DATA_OWNER", accountId: "qadata26", commandCode: "WORK" },
  { stepCode: "MEMBER_LIFECYCLE_03_VERIFY", actorCode: "VERIFIER", accountId: "qaverify26", commandCode: "VERIFY" },
  { stepCode: "MEMBER_LIFECYCLE_04_APPROVE", actorCode: "APPROVER", accountId: "qaapprove26", commandCode: "APPROVE" },
];
const switchedAccounts = [...new Set(steps.map((step) => step.accountId))];
const startedAt = new Date(startedAtMs);
const generatedRunId = `${startedAt.toISOString().replace(/[-:.TZ]/g, "")}-${sourceCommit.slice(0, 12)}-${crypto.randomUUID()}`;
const explicitRunId = String(process.env.CARBONET_MEMBER_RELAY_RUN_ID || "");
const runId = requiredSafeIdentifier(explicitRunId || generatedRunId, "member relay run ID", /^[A-Za-z0-9][A-Za-z0-9_.:@-]{7,190}$/);
delete process.env.CARBONET_MEMBER_RELAY_RUN_ID;
const artifactId = `${runId}-${crypto.randomUUID()}`;
const evidenceDirectory = path.join(root, "var/test-evidence/member-lifecycle-relay", artifactId);
const evidencePath = path.join(evidenceDirectory, "evidence.json");
const evidence = {
  schemaVersion: 1,
  runId,
  artifactId,
  explicitRunId: Boolean(explicitRunId),
  status: "RUNNING",
  startedAt: startedAt.toISOString(),
  sourceCommit,
  baseUrl,
  tenantId,
  projectId,
  processCode,
  credentialSource: "",
  authenticatedAdmin: "",
  switchedAccounts,
  executionId: "",
  checks: {
    authorityDenial: false,
    actorRelay: false,
    databaseCompletion: false,
    idempotency: false,
    responsive: false,
    supportContract: false,
  },
  supportContracts: [],
  uiRoutes: [],
  screenshotPaths: [],
  screenshots: [],
  cleanup: {
    resetAttempted: false,
    resetSucceeded: false,
    deleteAttempted: false,
    deleteSucceeded: false,
    ownershipBasis: "NONE",
    ownershipVerified: false,
    executionCount: null,
    eventCount: null,
    draftCount: null,
    activeTokenBaseline: null,
    activeTokenCount: null,
    actorLogoutAttempts: [],
    adminLogout: null,
    contextDisposals: 0,
    errors: [],
  },
  lifecycle: {
    totalDeadlineMs,
    cleanupBudgetMs,
    terminationReason: "",
    baseline: null,
  },
};

let adminUser = "";
let credentialPassword = "";
let adminApi = null;
let adminStorageState = null;
let actorApi = null;
let actorUser = "";
let browser = null;
let executionId = "";
let mainError = null;
let ownershipBasis = "NONE";
let recoveryOnly = false;
let terminationReason = "";
const requestContexts = new Set();
const browserContexts = new Set();
const deadlineAt = startedAt.getTime() + totalDeadlineMs;
let interruptReject = null;
const interruptPromise = new Promise((_, reject) => { interruptReject = reject; });

function requestTermination(reason) {
  if (terminationReason) return;
  terminationReason = reason;
  evidence.lifecycle.terminationReason = reason;
  interruptReject?.(new Error(reason));
}

function assertRelayActive(label) {
  if (!terminationReason && Date.now() >= deadlineAt) requestTermination(`total deadline exceeded before ${label}`);
  if (terminationReason) throw new Error(terminationReason);
}

const onSigterm = () => requestTermination("SIGTERM received; stopping writes and entering bounded cleanup");
const onSigint = () => requestTermination("SIGINT received; stopping writes and entering bounded cleanup");
process.once("SIGTERM", onSigterm);
process.once("SIGINT", onSigint);
const deadlineTimer = setTimeout(
  () => requestTermination("total deadline exceeded; stopping writes and entering bounded cleanup"),
  Math.max(0, deadlineAt - Date.now()),
);

function safeError(error) {
  return String(error?.message || error || "unknown error").replace(/[\r\n\t]+/g, " ").slice(0, 600);
}

function requiredSafeIdentifier(value, label, pattern) {
  const normalized = String(value || "");
  if (!pattern.test(normalized)) throw new Error(`${label} is unavailable or malformed`);
  return normalized;
}

function kubectl(args, label) {
  try {
    return execFileSync("kubectl", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
      maxBuffer: 2 * 1024 * 1024,
    }).trim();
  } catch {
    throw new Error(`${label} failed`);
  }
}

function loadSecretField(field) {
  const encoded = kubectl([
    "-n", namespace, "get", "secret", credentialSecret,
    "-o", `jsonpath={.data.${field}}`,
  ], `dedicated QA credential Secret ${field} read`);
  if (!encoded) throw new Error(`dedicated QA credential Secret ${field} is unavailable`);
  try {
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    throw new Error(`dedicated QA credential Secret ${field} is malformed`);
  }
}

function loadDedicatedCredentials() {
  const explicitPairs = [
    ["CARBONET_MEMBER_RELAY_ADMIN_USER", "CARBONET_MEMBER_RELAY_ADMIN_PASSWORD"],
  ];
  let selected = null;
  for (const [userKey, passwordKey] of explicitPairs) {
    const user = String(process.env[userKey] || "");
    const password = String(process.env[passwordKey] || "");
    if (!user && !password) continue;
    if (!user || !password) throw new Error(`explicit credential pair is incomplete: ${userKey}/${passwordKey}`);
    selected = { user, password, source: `explicit:${userKey}` };
    break;
  }
  if (!selected) {
    selected = {
      user: loadSecretField("username"),
      password: loadSecretField("password"),
      source: `kubernetes-secret:${credentialSecret}`,
    };
  }
  for (const key of explicitPairs.flat()) delete process.env[key];
  const user = requiredSafeIdentifier(selected.user, "dedicated QA administrator", /^qa[a-z0-9_.@-]{2,63}$/i);
  if (user.toLowerCase() === "webmaster") throw new Error("primary webmaster is forbidden for member relay QA");
  if (switchedAccounts.includes(user.toLowerCase())) throw new Error("relay administrator must be distinct from switched actor accounts");
  if (!selected.password || /[\r\n]/.test(selected.password)) throw new Error("dedicated QA administrator password is unavailable or malformed");
  return { user, password: selected.password, source: selected.source };
}

function sqlLiteral(value, label, pattern = /^[A-Za-z0-9_.:@-]{1,128}$/) {
  const safe = requiredSafeIdentifier(value, label, pattern);
  return `'${safe.replaceAll("'", "''")}'`;
}

function patroniLeader() {
  const output = kubectl([
    "-n", namespace, "get", "pods", "-l", "app=postgres-patroni",
    "-o", "jsonpath={range .items[*]}{.metadata.name}{'\\n'}{end}",
  ], "Patroni pod discovery");
  const pods = output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const leaders = pods.filter((pod) => {
    try {
      return kubectl([
        "-n", namespace, "exec", pod, "-c", postgresContainer, "--",
        "psql", "-h", "127.0.0.1", "-U", postgresUser, "-d", postgresDatabase,
        "-X", "-qAt", "-c", "select pg_is_in_recovery()",
      ], `Patroni role probe ${pod}`) === "f";
    } catch {
      return false;
    }
  });
  if (leaders.length !== 1) throw new Error(`expected exactly one writable Patroni leader, found ${leaders.length}`);
  return leaders[0];
}

function databaseQuery(sql, label) {
  const leader = patroniLeader();
  return kubectl([
    "-n", namespace, "exec", leader, "-c", postgresContainer, "--",
    "psql", "-h", "127.0.0.1", "-U", postgresUser, "-d", postgresDatabase,
    "-X", "-qAt", "-c", sql,
  ], label);
}

function activeTokenCount() {
  const accounts = [...new Set([adminUser, ...switchedAccounts].map((value) => value.toLowerCase()))];
  const literals = accounts.map((account) => sqlLiteral(account, "token account", /^[a-z0-9_.@-]{3,64}$/)).join(",");
  const value = databaseQuery(`select count(*) from COMTNAUTHTOKENSTORE
    where lower(user_id) in (${literals})
      and (expiration_at is null or expiration_at > current_timestamp)`, "active QA token query");
  if (!/^\d+$/.test(value)) throw new Error("active QA token query returned an invalid count");
  return Number(value);
}

function scopedRelayState(expectedRunId = runId, expectedExecutionId = executionId) {
  const expectedExecution = expectedExecutionId
    ? sqlLiteral(expectedExecutionId, "execution ID", /^[0-9a-f-]{36}$/i)
    : null;
  const expectedRun = sqlLiteral(expectedRunId, "run ID", /^[A-Za-z0-9][A-Za-z0-9_.:@-]{7,190}$/);
  const harness = sqlLiteral(provenanceHarness, "provenance harness");
  const owner = sqlLiteral(steps[0].accountId, "owner account", /^[a-z0-9_.@-]{3,64}$/);
  const tenant = sqlLiteral(tenantId, "tenant ID");
  const project = sqlLiteral(projectId, "project ID");
  const process = sqlLiteral(processCode, "process code");
  const firstActor = sqlLiteral(steps[0].actorCode, "initial actor code");
  const value = databaseQuery(`with scoped_execution as (
      select * from framework_process_execution
       where tenant_id=${tenant} and project_id=${project} and process_code=${process}
    ), scoped_event as (
      select event.* from framework_process_execution_event event
      join scoped_execution execution on execution.execution_id=event.execution_id
    ), scoped_draft as (
      select * from framework_process_work_draft
       where tenant_id=${tenant} and project_id=${project} and process_code=${process}
    ), owned_draft as (
      select draft.* from scoped_draft draft
       where draft.evidence_json#>>'{qaProvenance,harness}'=${harness}
         and draft.evidence_json#>>'{qaProvenance,runId}'=${expectedRun}
         and draft.evidence_json#>>'{qaProvenance,executionId}' in
             (select execution_id::text from scoped_execution)
         and draft.evidence_json#>>'{qaProvenance,processCode}'=draft.process_code
         and draft.evidence_json#>>'{qaProvenance,stepCode}'=draft.step_code
         and draft.evidence_json#>>'{qaProvenance,actorCode}'=draft.actor_code
         and lower(draft.evidence_json#>>'{qaProvenance,accountId}')=lower(draft.account_id)
         and draft.evidence_json#>>'{qaProvenance,sourceCommit}'=(
             select execution.site_scope#>>'{qaProvenance,sourceCommit}' from scoped_execution execution
              where execution.execution_id::text=draft.evidence_json#>>'{qaProvenance,executionId}')
    ), owned_event as (
      select event.* from scoped_event event
       where framework_try_jsonb(event.request_json,'{}'::jsonb)#>>'{qaProvenance,harness}'=${harness}
         and framework_try_jsonb(event.request_json,'{}'::jsonb)#>>'{qaProvenance,runId}'=${expectedRun}
         and framework_try_jsonb(event.request_json,'{}'::jsonb)#>>'{qaProvenance,executionId}'=event.execution_id::text
         and framework_try_jsonb(event.request_json,'{}'::jsonb)#>>'{qaProvenance,processCode}'=${process}
         and framework_try_jsonb(event.request_json,'{}'::jsonb)#>>'{qaProvenance,stepCode}'=event.step_code
         and framework_try_jsonb(event.request_json,'{}'::jsonb)#>>'{qaProvenance,actorCode}'=event.actor_code
         and lower(framework_try_jsonb(event.request_json,'{}'::jsonb)#>>'{qaProvenance,accountId}')=lower(event.executed_by)
         and framework_try_jsonb(event.request_json,'{}'::jsonb)#>>'{qaProvenance,sourceCommit}'=(
             select execution.site_scope#>>'{qaProvenance,sourceCommit}' from scoped_execution execution
              where execution.execution_id=event.execution_id)
         and framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,harness}'=${harness}
         and framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,runId}'=${expectedRun}
         and framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,executionId}'=event.execution_id::text
         and framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,processCode}'=${process}
         and framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,stepCode}'=event.step_code
         and framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,actorCode}'=event.actor_code
         and lower(framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,accountId}')=lower(event.executed_by)
         and framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,sourceCommit}'=(
             select execution.site_scope#>>'{qaProvenance,sourceCommit}' from scoped_execution execution
              where execution.execution_id=event.execution_id)
    ) select
      (select count(*) from scoped_execution)::text||'|'||
      (select count(*) from scoped_event)::text||'|'||
      (select count(*) from scoped_draft)::text||'|'||
      (select count(*) from scoped_execution execution
        where lower(execution.initiated_by)=lower(${owner})
          and execution.site_scope#>>'{qaProvenance,harness}'=${harness}
          and execution.site_scope#>>'{qaProvenance,runId}'=${expectedRun}
          and execution.site_scope#>>'{qaProvenance,processCode}'=${process}
          and execution.site_scope#>>'{qaProvenance,actorCode}'=${firstActor}
          and lower(execution.site_scope#>>'{qaProvenance,accountId}')=lower(${owner})
          and execution.site_scope#>>'{qaProvenance,sourceCommit}'~'^[0-9a-fA-F]{40}$'
          and (${expectedExecution ? `execution.execution_id=${expectedExecution}::uuid` : "true"}))::text||'|'||
      (select count(*) from owned_event)::text||'|'||
      (select count(*) from owned_draft)::text||'|'||
      (select count(*) from scoped_execution execution
        where execution.site_scope#>>'{qaProvenance,harness}'=${harness}
          and execution.site_scope#>>'{qaProvenance,runId}'=${expectedRun}
          and execution.site_scope#>>'{qaProvenance,processCode}'=${process}
          and execution.site_scope#>>'{qaProvenance,actorCode}'=${firstActor}
          and lower(execution.site_scope#>>'{qaProvenance,accountId}')=lower(${owner})
          and execution.site_scope#>>'{qaProvenance,sourceCommit}'~'^[0-9a-fA-F]{40}$'
          and (${expectedExecution ? `execution.execution_id=${expectedExecution}::uuid` : "true"})
          and ((not exists(select 1 from scoped_event event where event.execution_id=execution.execution_id)
                and execution.snapshot_ref is null)
            or execution.snapshot_ref=(
                select 'qa-member-relay:'||${expectedRun}||':'||execution.execution_id::text||':'||event.step_code
                  from scoped_event event where event.execution_id=execution.execution_id
                 order by event.event_id desc limit 1)))::text||'|'||
      coalesce((select string_agg(execution_id::text,',' order by started_at) from scoped_execution),'')`,
    "scoped member relay state query");
  const match = /^(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|([0-9a-f,-]*)$/i.exec(value);
  if (!match) throw new Error("scoped member relay state query returned an invalid result");
  return {
    executionCount: Number(match[1]), eventCount: Number(match[2]), draftCount: Number(match[3]),
    ownedExecutionCount: Number(match[4]), ownedEventCount: Number(match[5]), ownedDraftCount: Number(match[6]),
    snapshotOwnedCount: Number(match[7]), executionIds: match[8] ? match[8].split(",") : [],
  };
}

function isExactTestOwnedState(state, allowEmptyProvenance = false) {
  return state.executionCount === 1
    && state.executionIds.length === 1
    && state.ownedExecutionCount === 1
    && state.eventCount === state.ownedEventCount
    && state.draftCount === state.ownedDraftCount
    && state.snapshotOwnedCount === 1
    && (allowEmptyProvenance || state.draftCount > 0);
}

async function disposeRequestContext(context) {
  if (!context || !requestContexts.has(context)) return;
  try {
    await context.dispose();
  } finally {
    requestContexts.delete(context);
    evidence.cleanup.contextDisposals += 1;
  }
}

async function logoutContext(context, label, cleanup = false) {
  if (!context) return;
  const response = await context.post("/signin/actionLogout", { failOnStatusCode: false });
  const body = await response.json().catch(() => ({}));
  const success = response.status() === 200 && body.status === "success";
  const alreadyRevoked = response.status() === 401 && body.status === "logoutFailure";
  const result = { label, status: response.status(), success, alreadyRevoked };
  if (label === "admin") evidence.cleanup.adminLogout = result;
  else evidence.cleanup.actorLogoutAttempts.push(result);
  if (!success && !(cleanup && alreadyRevoked)) throw new Error(`${label} logout failed HTTP ${response.status()}`);
}

async function createSwitchedContext(userId, cleanup = false) {
  if (!cleanup) assertRelayActive(`switch account ${userId}`);
  if (!adminStorageState) throw new Error("administrator storage state is unavailable");
  const context = await request.newContext({
    baseURL: baseUrl,
    ignoreHTTPSErrors: true,
    storageState: adminStorageState,
    timeout: requestTimeoutMs,
  });
  requestContexts.add(context);
  const response = await context.post("/signin/testAccountSwitch", {
    data: { userId },
    headers: { "X-Carbonet-Test-Mode": "1" },
    failOnStatusCode: false,
  });
  const body = await response.json().catch(() => ({}));
  if (!cleanup) assertRelayActive(`switch account ${userId} response`);
  if (response.status() !== 200 || body.status !== "loginSuccess"
      || String(body.userId || "").toLowerCase() !== userId.toLowerCase()) {
    if (response.status() === 200 && body.status === "loginSuccess") {
      try {
        await logoutContext(context, `rejected-switch:${userId}`, true);
      } catch {
        // The final token-store assertion remains fail closed if revocation fails.
      }
    }
    await disposeRequestContext(context);
    throw new Error(`test account switch failed user=${userId} HTTP ${response.status()}`);
  }
  return context;
}

async function logoutAndDisposeActor(label, cleanup = false) {
  const context = actorApi;
  const user = actorUser;
  actorApi = null;
  actorUser = "";
  if (!context) return;
  let logoutError = null;
  try {
    await logoutContext(context, `${label}:${user}`, cleanup);
  } catch (error) {
    try {
      await logoutContext(context, `${label}-retry:${user}`, true);
    } catch (retryError) {
      logoutError = new Error(`${safeError(error)}; retry: ${safeError(retryError)}`);
    }
  } finally {
    await disposeRequestContext(context);
  }
  if (logoutError) throw logoutError;
}

async function switchAccount(userId) {
  assertRelayActive(`relay to ${userId}`);
  await logoutAndDisposeActor("switch");
  actorApi = await createSwitchedContext(userId);
  actorUser = userId;
  return actorApi;
}

async function json(context, method, url, data, expected = [200], cleanup = false) {
  if (!cleanup) assertRelayActive(`${method} ${url}`);
  const options = {
    method,
    headers: { "X-Carbonet-Test-Mode": "1" },
    failOnStatusCode: false,
  };
  if (data !== undefined) options.data = data;
  const response = await context.fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!cleanup) assertRelayActive(`${method} ${url} response`);
  if (!expected.includes(response.status())) throw new Error(`${method} ${url} HTTP ${response.status()} ${body.message || ""}`);
  return { response, body };
}

async function resetProcessState(context) {
  const ownedState = scopedRelayState(runId, executionId);
  const allowEmptyProvenance = ownershipBasis === "ZERO_BASELINE_ATOMIC_MARKER";
  if (!isExactTestOwnedState(ownedState, allowEmptyProvenance)) {
    throw new Error(`cleanup ownership rejected basis=${ownershipBasis} state=${JSON.stringify(ownedState)}`);
  }
  evidence.cleanup.ownershipBasis = ownershipBasis;
  evidence.cleanup.ownershipVerified = true;
  evidence.cleanup.resetAttempted = true;
  const reset = await json(context, "POST", "/home/api/process-executions/qa-instance", {
    action: "RESET", projectId, processCode,
  }, [200], true);
  evidence.cleanup.resetSucceeded = reset.body.success === true
    && String(reset.body.executionId || "") === executionId;
  if (!evidence.cleanup.resetSucceeded) throw new Error("cleanup RESET did not target the owned execution");

  evidence.cleanup.deleteAttempted = true;
  const removed = await json(context, "POST", "/home/api/process-executions/qa-instance", {
    action: "DELETE", projectId, processCode,
  }, [200], true);
  evidence.cleanup.deleteSucceeded = removed.body.success === true
    && Number(removed.body.deletedExecutions) === 1;
  if (!evidence.cleanup.deleteSucceeded) throw new Error("cleanup DELETE did not remove exactly one owned execution");
}

function executionProvenance() {
  return {
    harness: provenanceHarness,
    runId,
    processCode,
    actorCode: steps[0].actorCode,
    accountId: steps[0].accountId,
    sourceCommit,
  };
}

function qaProvenance(step) {
  return {
    harness: provenanceHarness,
    runId,
    executionId,
    processCode,
    stepCode: step.stepCode,
    actorCode: step.actorCode,
    accountId: step.accountId,
    sourceCommit,
  };
}

function requireSupportContract(envelope, step) {
  const contract = envelope?.contract || {};
  const process = contract.process || {};
  const permission = contract.permission || {};
  const support = contract.support || {};
  const help = support.help || {};
  const workGuide = support.workGuide || {};
  const qa = support.qa || {};
  const designCard = support.designCard || {};
  const testContract = contract.test || {};
  const requiredScenarios = ["HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY"];
  const exactCoordinate = process.processCode === processCode
    && process.stepCode === step.stepCode
    && permission.actorCode === step.actorCode;
  const completeLanes = Array.isArray(help.items) && help.items.length > 0
    && Array.isArray(workGuide.steps) && workGuide.steps.length > 0
    && workGuide.processCode === processCode && workGuide.stepCode === step.stepCode
    && workGuide.actorCode === step.actorCode
    && workGuide.nextAction && typeof workGuide.nextAction === "object"
    && String(workGuide.nextAction.routePath || "") === "/work/execution"
    && Array.isArray(qa.requiredScenarioTypes)
    && requiredScenarios.every((scenario) => qa.requiredScenarioTypes.includes(scenario))
    && Array.isArray(qa.checks) && qa.checks.length > 0 && qa.checks.every((check) => check.passed === true)
    && ["apiVerified", "databaseVerified", "authorityVerified", "responsiveVerified", "accessibilityVerified", "exceptionStatesVerified"]
      .every((key) => testContract[key] === true)
    && designCard.designSystem === "KRDS"
    && typeof designCard.specification === "object" && designCard.specification !== null
    && typeof designCard.traceability === "object" && designCard.traceability !== null
    && Array.isArray(designCard.assetBindings) && designCard.assetBindings.length > 0;
  if (!exactCoordinate || !completeLanes || !envelope.contractHash || !envelope.versionId) {
    throw new Error(`versioned support contract incomplete actor=${step.actorCode} step=${step.stepCode}`);
  }
  return {
    actorCode: permission.actorCode,
    stepCode: process.stepCode,
    contractHash: String(envelope.contractHash),
    versionId: Number(envelope.versionId),
    lanes: ["help", "workGuide", "fullWorkflow", "qa", "designCard", "nextHandoff"],
  };
}

async function requireVisible(locator, label) {
  assertRelayActive(`support surface ${label}`);
  await locator.first().waitFor({ state: "visible", timeout: 12_000 });
  assertRelayActive(`support surface ${label} response`);
  if (await locator.count() < 1) throw new Error(`support surface missing: ${label}`);
}

async function assertSupportDom(page, step) {
  const cards = page.locator('article[data-common-component="COMMON_CONTENT_CARD"]');
  const helpButton = page.locator("button.help-fab").filter({ hasText: /^도움말$/ });
  const workGuideCard = cards.filter({ has: page.getByRole("heading", { name: "업무 길잡이", exact: true }) });
  const qaCard = cards.filter({ has: page.getByRole("heading", { name: "QA 검증", exact: true }) });
  const designCard = cards.filter({ has: page.getByRole("heading", { name: "화면 설계 요약", exact: true }) });
  const taskPanel = page.locator('[data-task-quest-panel]');
  const processQaCard = page.locator('[data-process-qa-card]');

  await requireVisible(helpButton, "도움말");
  await requireVisible(workGuideCard, "업무 길잡이");
  await requireVisible(workGuideCard.locator('[data-common-component="COMMON_STEP_FLOW"]'), "업무 길잡이 step flow");
  await requireVisible(qaCard, "QA 검증");
  await requireVisible(designCard, "화면 설계 요약");
  await requireVisible(designCard.locator('[data-common-component="COMMON_STATUS_BADGE"]').filter({ hasText: /^KRDS$/ }), "KRDS design badge");
  await requireVisible(taskPanel, "다음 업무 panel");
  await requireVisible(processQaCard, "QA 업무 panel");
  await requireVisible(processQaCard.getByRole("button", { name: "QA 업무", exact: true }), "QA 업무 trigger");

  if (await taskPanel.getAttribute("data-utility-panel-state") !== "closed") {
    await taskPanel.getByRole("button", { name: "접기", exact: true }).click();
  }
  await requireVisible(taskPanel.getByRole("button", { name: "다음 업무", exact: true }), "다음 업무 trigger");
  await taskPanel.getByRole("button", { name: "다음 업무", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-task-quest-panel]')?.getAttribute("data-utility-panel-state") === "open", null, { timeout: 8_000 });
  await requireVisible(taskPanel.getByText("업무 길잡이", { exact: true }), "global 업무 길잡이");
  const fullWorkflowButton = taskPanel.getByRole("button", { name: "전체 업무 보기", exact: true });
  await requireVisible(fullWorkflowButton, "전체 업무 보기");
  await fullWorkflowButton.click();
  const fullWorkflowDialog = page.getByRole("dialog", { name: "전체 업무 프로세스", exact: true });
  await requireVisible(fullWorkflowDialog, "전체 업무 프로세스");
  await fullWorkflowDialog.getByRole("button", { name: "전체 업무 닫기", exact: true }).click();
  await fullWorkflowDialog.waitFor({ state: "hidden", timeout: 8_000 });
  await taskPanel.getByRole("button", { name: "접기", exact: true }).click();
  await requireVisible(taskPanel.getByRole("button", { name: "다음 업무", exact: true }), "다음 업무 인계");

  return {
    stepCode: step.stepCode,
    actorCode: step.actorCode,
    lanes: {
      help: true, workGuide: true, fullWorkflow: true,
      qaVerification: true, designCard: true, nextHandoff: true,
    },
  };
}

async function verifyCompletedDatabaseState() {
  const execution = sqlLiteral(executionId, "execution ID", /^[0-9a-f-]{36}$/i);
  const tenant = sqlLiteral(tenantId, "tenant ID");
  const project = sqlLiteral(projectId, "project ID");
  const process = sqlLiteral(processCode, "process code");
  const dbState = databaseQuery(`select execution_status||'|'||current_state||'|'
    ||(select count(*) from framework_process_execution_event where execution_id=${execution}::uuid)||'|'
    ||(select count(*) from framework_process_work_draft where tenant_id=${tenant} and project_id=${project} and process_code=${process} and draft_status='SUBMITTED')
    from framework_process_execution where execution_id=${execution}::uuid`, "completed member relay state query");
  if (dbState !== "COMPLETED|COMPLETED|4|4") throw new Error(`database relay state mismatch ${dbState}`);
  evidence.checks.databaseCompletion = true;
}

async function executeRelay() {
  assertRelayActive("baseline state read");
  const baseline = scopedRelayState(runId, "");
  evidence.lifecycle.baseline = baseline;
  const baselineEmpty = baseline.executionCount === 0 && baseline.eventCount === 0 && baseline.draftCount === 0;
  if (!baselineEmpty) {
    if (!explicitRunId || baseline.executionIds.length !== 1) {
      throw new Error(`foreign MEMBER_LIFECYCLE state blocks relay before login/write state=${JSON.stringify(baseline)}`);
    }
    executionId = baseline.executionIds[0];
    evidence.executionId = executionId;
    const recoverable = scopedRelayState(runId, executionId);
    if (!isExactTestOwnedState(recoverable, false)) {
      executionId = "";
      evidence.executionId = "";
      throw new Error(`foreign MEMBER_LIFECYCLE state lacks exact QA provenance; login/write refused state=${JSON.stringify(recoverable)}`);
    }
    ownershipBasis = "EXACT_RUN_PROVENANCE";
    recoveryOnly = true;
  }

  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  await chmod(evidenceDirectory, 0o700);
  const credentials = loadDedicatedCredentials();
  adminUser = credentials.user;
  credentialPassword = credentials.password;
  evidence.credentialSource = credentials.source;
  evidence.authenticatedAdmin = adminUser;

  evidence.cleanup.activeTokenBaseline = activeTokenCount();
  if (evidence.cleanup.activeTokenBaseline !== 0) {
    throw new Error(`dedicated relay accounts already have active tokens count=${evidence.cleanup.activeTokenBaseline}`);
  }

  adminApi = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true, timeout: requestTimeoutMs });
  requestContexts.add(adminApi);
  const login = await adminApi.post("/signin/actionLogin", {
    data: { userId: adminUser, userPw: credentialPassword, userSe: "USR" },
    failOnStatusCode: false,
  });
  const loginBody = await login.json().catch(() => ({}));
  if (login.status() !== 200 || loginBody.status !== "loginSuccess"
      || String(loginBody.userId || "").toLowerCase() !== adminUser.toLowerCase()) {
    throw new Error(`dedicated relay administrator login failed HTTP ${login.status()}`);
  }
  adminStorageState = await adminApi.storageState();
  credentials.password = "";
  credentialPassword = "";

  if (recoveryOnly) {
    throw new Error(`exact test-owned residue scheduled for cleanup runId=${runId}; rerun after cleanup`);
  }

  await switchAccount("qaapprove26");
  const wrongStart = await json(actorApi, "POST", "/home/api/process-executions/start", {
    tenantId, projectId, processCode, actorCode: "APPROVER",
  }, [403]);
  if (wrongStart.body.success !== false) throw new Error("wrong first-step actor was not rejected");
  evidence.checks.authorityDenial = true;

  await switchAccount("qaowner26");
  const current = await json(actorApi, "GET", `/home/api/process-executions?${new URLSearchParams({ tenantId, projectId, processCode })}`, undefined, [200]);
  if (current.body.found) throw new Error("zero baseline disagrees with runtime current execution; CREATE refused");
  ownershipBasis = "ZERO_BASELINE_ATOMIC_MARKER";
  const created = await json(actorApi, "POST", "/home/api/process-executions/start", {
    tenantId, projectId, processCode, actorCode: "COMPANY_MANAGER",
    siteScopeJson: JSON.stringify({ qaProvenance: executionProvenance() }),
  }, [200]);
  executionId = requiredSafeIdentifier(created.body.executionId, "created execution ID", /^[0-9a-f-]{36}$/i);
  evidence.executionId = executionId;
  if (created.body.created !== true || created.body.currentStepCode !== steps[0].stepCode) {
    executionId = "";
    evidence.executionId = "";
    throw new Error("QA CREATE did not create one new first-step execution");
  }
  const markerStep = steps[0];
  const markerDraftUrl = `/home/api/process-executions/draft?${new URLSearchParams({ tenantId, projectId, processCode, stepCode: markerStep.stepCode })}`;
  const markerDraft = await json(actorApi, "GET", markerDraftUrl, undefined, [200]);
  const markerSave = await json(actorApi, "PUT", "/home/api/process-executions/draft", {
    tenantId, projectId, processCode, stepCode: markerStep.stepCode, actorCode: markerStep.actorCode,
    expectedVersion: Number(markerDraft.body.draft?.draftVersion || 0),
    payloadJson: JSON.stringify({ qaOwnershipMarker: qaProvenance(markerStep) }),
    evidenceJson: JSON.stringify({ qaProvenance: qaProvenance(markerStep), evidenceType: "TEST_OWNERSHIP_MARKER" }),
  }, [200]);
  if (markerSave.body.draft?.draftStatus !== "DRAFT") throw new Error("QA ownership marker draft was not persisted");
  const markedState = scopedRelayState(runId, executionId);
  if (!isExactTestOwnedState(markedState, false)) throw new Error(`QA ownership marker verification failed ${JSON.stringify(markedState)}`);

  browser = await chromium.launch({ headless: true, timeout: 30_000, ...(executablePath ? { executablePath } : {}) });
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    await switchAccount(step.accountId);
    const executionResult = await json(actorApi, "GET", `/home/api/process-executions?${new URLSearchParams({ tenantId, projectId, processCode })}`, undefined, [200]);
    const execution = executionResult.body;
    executionId = String(execution.executionId || executionId);
    evidence.executionId = executionId;
    if (!execution.found || execution.currentStepCode !== step.stepCode || execution.executionStatus !== "RUNNING") {
      throw new Error(`handoff context mismatch ${step.accountId} ${JSON.stringify({ found: execution.found, currentStepCode: execution.currentStepCode, executionStatus: execution.executionStatus })}`);
    }

    const draftUrl = `/home/api/process-executions/draft?${new URLSearchParams({ tenantId, projectId, processCode, stepCode: step.stepCode })}`;
    const draftResult = await json(actorApi, "GET", draftUrl, undefined, [200]);
    const contract = draftResult.body.contract || {};
    const fields = JSON.parse(String(contract.fieldContractJson || "[]"));
    const editableRequired = fields.filter((field) => field.editable === true && field.required === true);
    if (editableRequired.length < 4 || contract.actorCode !== step.actorCode || contract.commandCode !== step.commandCode) {
      throw new Error(`professional field or actor contract incomplete ${step.stepCode}`);
    }

    const runtimeContractPath = `/runtime/screens/resolve?${new URLSearchParams({
      routePath: "/work/execution", processCode, stepCode: step.stepCode, audience: "USER",
    })}`;
    const runtimeContractResult = await json(actorApi, "GET", runtimeContractPath, undefined, [200]);
    const supportContract = requireSupportContract(runtimeContractResult.body, step);
    evidence.supportContracts.push(supportContract);

    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
      assertRelayActive(`${step.stepCode} ${viewport.name} visual verification`);
      const uiContext = await browser.newContext({ storageState: await actorApi.storageState(), ignoreHTTPSErrors: true, viewport });
      browserContexts.add(uiContext);
      try {
        const page = await uiContext.newPage();
        const runtimeErrors = [];
        const consoleErrors = [];
        const failedRequests = [];
        page.on("pageerror", (error) => runtimeErrors.push(safeError(error)));
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(safeError(message.text()));
        });
        page.on("requestfailed", (failedRequest) => {
          const failedUrl = new URL(failedRequest.url());
          failedRequests.push(`${failedRequest.method()} ${failedUrl.pathname} ${safeError(failedRequest.failure()?.errorText)}`);
        });
        const route = `/work/execution?${new URLSearchParams({ tenantId, projectId, processCode, stepCode: step.stepCode, guide: "1" })}`;
        const pageContractPromise = page.waitForResponse((candidate) => {
          const candidateUrl = new URL(candidate.url());
          return candidateUrl.pathname === "/runtime/screens/resolve"
            && candidateUrl.searchParams.get("processCode") === processCode
            && candidateUrl.searchParams.get("stepCode") === step.stepCode
            && candidateUrl.searchParams.get("audience") === "USER";
        }, { timeout: 20_000 });
        const [response, pageContractResponse] = await Promise.all([
          page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 20_000 }),
          pageContractPromise,
        ]);
        assertRelayActive(`${step.stepCode} ${viewport.name} page contract response`);
        if (pageContractResponse.status() !== 200) throw new Error(`page runtime contract HTTP ${pageContractResponse.status()}`);
        const pageSupportContract = requireSupportContract(await pageContractResponse.json(), step);
        if (pageSupportContract.contractHash !== supportContract.contractHash) {
          throw new Error(`page/API support contract hash mismatch ${step.stepCode}`);
        }
        await page.waitForFunction((code) => document.body.innerText.includes(code), step.stepCode, { timeout: 12_000 });
        const supportDom = await assertSupportDom(page, step);
        const state = await page.evaluate((code) => ({
          hasStep: document.body.innerText.includes(code),
          controls: document.querySelectorAll("input,textarea,select").length,
          pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          hasRuntimeError: document.body.innerText.includes("페이지 처리 중 오류") || document.body.innerText.includes("AUTHENTICATION_REQUIRED"),
        }), step.stepCode);
        const screenshotName = `${String(index + 1).padStart(2, "0")}-${step.stepCode}-${viewport.name}.png`;
        const screenshotPath = path.join(evidenceDirectory, screenshotName);
        if (existsSync(screenshotPath)) throw new Error(`immutable screenshot path already exists ${screenshotName}`);
        await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
        await chmod(screenshotPath, 0o400);
        const screenshotHash = crypto.createHash("sha256").update(await readFile(screenshotPath)).digest("hex");
        const relativeScreenshotPath = path.relative(root, screenshotPath).split(path.sep).join("/");
        evidence.screenshotPaths.push(relativeScreenshotPath);
        evidence.screenshots.push({
          ordinal: evidence.screenshotPaths.length,
          stepCode: step.stepCode,
          viewport: viewport.name,
          path: relativeScreenshotPath,
          sha256: screenshotHash,
        });
        if ((response?.status() || 0) >= 400 || runtimeErrors.length || consoleErrors.length || failedRequests.length
            || !state.hasStep || state.controls < 8 || state.pageOverflow || state.hasRuntimeError) {
          throw new Error(`work UI failed ${viewport.name} ${step.stepCode} ${JSON.stringify(state)} page=${runtimeErrors.join(" | ")} console=${consoleErrors.join(" | ")} network=${failedRequests.join(" | ")}`);
        }
        evidence.uiRoutes.push({
          stepCode: step.stepCode,
          accountId: step.accountId,
          viewport: viewport.name,
          controls: state.controls,
          supportDom,
          supportContractHash: pageSupportContract.contractHash,
          consoleErrorCount: consoleErrors.length,
          failedRequestCount: failedRequests.length,
          screenshotPath: relativeScreenshotPath,
          ok: true,
        });
      } finally {
        await uiContext.close();
        browserContexts.delete(uiContext);
      }
    }

    const payload = Object.fromEntries(fields.filter((field) => field.editable === true).map((field) => {
      const code = String(field.fieldCode);
      if (code.toLowerCase().includes("date") || code === "effectiveAt") return [code, "2026-08-06"];
      if (code === "lifecycleAction") return [code, "UPDATE"];
      if (code === "targetStatus") return [code, "ACTIVE"];
      if (code.toLowerCase().includes("result") || code === "approvalDecision") return [code, code === "approvalDecision" ? "APPROVE" : "PASS"];
      return [code, `QA ${step.stepCode} ${code}`];
    }));
    Object.assign(payload, {
      workSummary: `${step.stepCode} 실제 계정 릴레이 처리 완료`,
      decisionBasis: `${step.actorCode} 권한과 단계 계약에 따른 검증 가능한 처리 근거`,
      resultValue: String(index + 1), resultUnit: "step", exceptionReason: "",
    });
    const save = await json(actorApi, "PUT", "/home/api/process-executions/draft", {
      tenantId, projectId, processCode, stepCode: step.stepCode, actorCode: step.actorCode,
      expectedVersion: Number(draftResult.body.draft?.draftVersion || 0),
      payloadJson: JSON.stringify(payload),
      evidenceJson: JSON.stringify({
        qaProvenance: qaProvenance(step),
        documentId: `QA-MEMBER-${index + 1}`,
        sourceUrl: `qa://${runId}/${executionId}/${step.stepCode}`,
        checksum: crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
      }),
    }, [200]);
    if (save.body.draft?.draftStatus !== "DRAFT") throw new Error(`draft save failed ${step.stepCode}`);

    const idempotencyKey = crypto.randomUUID();
    const commandBody = {
      tenantId, projectId, processCode, stepCode: step.stepCode, actorCode: step.actorCode, commandCode: step.commandCode,
      idempotencyKey, requireDraft: true,
      requestJson: JSON.stringify({ qaProvenance: qaProvenance(step), payload }),
      resultJson: JSON.stringify({ qaProvenance: qaProvenance(step), completed: true, accountId: step.accountId }),
      snapshotRef: `qa-member-relay:${runId}:${executionId}:${step.stepCode}`,
    };
    const completed = await json(actorApi, "POST", `/home/api/process-executions/${executionId}/commands`, commandBody, [200]);
    const replay = await json(actorApi, "POST", `/home/api/process-executions/${executionId}/commands`, commandBody, [200]);
    if (replay.body.idempotent !== true) throw new Error(`idempotency failed ${step.stepCode}`);
    const next = steps[index + 1];
    if (next && (completed.body.nextStepCode !== next.stepCode || completed.body.nextActorCode !== next.actorCode)) {
      throw new Error(`next handoff mismatch ${step.stepCode}`);
    }
    if (!next && completed.body.executionStatus !== "COMPLETED") throw new Error("final execution did not complete");

    if (next) {
      const forbidden = await json(actorApi, "GET", `/home/api/process-executions/draft?${new URLSearchParams({ tenantId, projectId, processCode, stepCode: next.stepCode })}`, undefined, [403]);
      if (forbidden.body.success !== false) throw new Error(`previous actor accessed next step ${next.stepCode}`);
    }
  }
  if (evidence.screenshotPaths.length !== 8 || evidence.screenshots.length !== 8 || evidence.uiRoutes.length !== 8) {
    throw new Error(`visual evidence is incomplete screenshots=${evidence.screenshotPaths.length} routes=${evidence.uiRoutes.length}`);
  }
  evidence.checks.actorRelay = true;
  evidence.checks.idempotency = true;
  evidence.checks.responsive = true;
  evidence.checks.supportContract = evidence.supportContracts.length === 4
    && evidence.uiRoutes.every((route) => Object.values(route.supportDom.lanes).every(Boolean));
  if (!evidence.checks.supportContract) throw new Error("six support lanes were not verified on all eight actor/viewport pages");
  await verifyCompletedDatabaseState();
}

async function cleanupRun() {
  const cleanupStartedAt = Date.now();
  for (const uiContext of [...browserContexts]) {
    try {
      await uiContext.close();
    } catch (error) {
      evidence.cleanup.errors.push(`browser-context:${safeError(error)}`);
    } finally {
      browserContexts.delete(uiContext);
    }
  }
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      evidence.cleanup.errors.push(`browser:${safeError(error)}`);
    }
    browser = null;
  }

  try {
    await logoutAndDisposeActor("cleanup", true);
  } catch (error) {
    evidence.cleanup.errors.push(`actor-logout:${safeError(error)}`);
  }

  if (!executionId && ownershipBasis === "ZERO_BASELINE_ATOMIC_MARKER") {
    try {
      const atomicCandidate = scopedRelayState(runId, "");
      if (isExactTestOwnedState(atomicCandidate, true)) {
        executionId = atomicCandidate.executionIds[0];
        evidence.executionId = executionId;
      }
    } catch (error) {
      evidence.cleanup.errors.push(`atomic-marker-recovery:${safeError(error)}`);
    }
  }

  let cleanupOwnerApi = null;
  if (adminStorageState && executionId && ownershipBasis !== "NONE") {
    try {
      cleanupOwnerApi = await createSwitchedContext("qaowner26", true);
      await resetProcessState(cleanupOwnerApi);
    } catch (error) {
      evidence.cleanup.errors.push(`reset:${safeError(error)}`);
    } finally {
      if (cleanupOwnerApi) {
        try {
          await logoutContext(cleanupOwnerApi, "cleanup-reset:qaowner26", true);
        } catch (error) {
          try {
            await logoutContext(cleanupOwnerApi, "cleanup-reset-retry:qaowner26", true);
          } catch (retryError) {
            evidence.cleanup.errors.push(`cleanup-owner-logout:${safeError(error)}; retry:${safeError(retryError)}`);
          }
        }
        try {
          await disposeRequestContext(cleanupOwnerApi);
        } catch (error) {
          evidence.cleanup.errors.push(`cleanup-owner-context:${safeError(error)}`);
        }
      }
    }
  }

  if (adminApi) {
    try {
      await logoutContext(adminApi, "admin", true);
    } catch (error) {
      try {
        await logoutContext(adminApi, "admin", true);
      } catch (retryError) {
        evidence.cleanup.errors.push(`admin-logout:${safeError(error)}; retry:${safeError(retryError)}`);
      }
    } finally {
      try {
        await disposeRequestContext(adminApi);
      } catch (error) {
        evidence.cleanup.errors.push(`admin-context:${safeError(error)}`);
      }
      adminApi = null;
    }
  }
  for (const context of [...requestContexts]) {
    try {
      await disposeRequestContext(context);
    } catch (error) {
      evidence.cleanup.errors.push(`request-context:${safeError(error)}`);
    }
  }
  credentialPassword = "";
  adminStorageState = null;

  if (adminUser) {
    try {
      const residue = scopedRelayState(runId, executionId);
      evidence.cleanup.executionCount = residue.executionCount;
      evidence.cleanup.eventCount = residue.eventCount;
      evidence.cleanup.draftCount = residue.draftCount;
      if (residue.executionCount !== 0 || residue.eventCount !== 0 || residue.draftCount !== 0) {
        throw new Error(`post-cleanup residue executions=${residue.executionCount} events=${residue.eventCount} drafts=${residue.draftCount}`);
      }
    } catch (error) {
      evidence.cleanup.errors.push(`residue:${safeError(error)}`);
    }
    try {
      const postCleanupTokenCount = activeTokenCount();
      evidence.cleanup.activeTokenCount = postCleanupTokenCount;
      if (postCleanupTokenCount !== 0) throw new Error(`post-cleanup active tokens=${postCleanupTokenCount}`);
    } catch (error) {
      evidence.cleanup.errors.push(`tokens:${safeError(error)}`);
    }
  }
  if (!mainError && !evidence.cleanup.resetSucceeded) {
    evidence.cleanup.errors.push("reset:successful relay did not complete the required RESET cleanup");
  }
  if (!mainError && !evidence.cleanup.deleteSucceeded) {
    evidence.cleanup.errors.push("delete:successful relay did not remove its owned QA execution");
  }
  evidence.lifecycle.cleanupDurationMs = Date.now() - cleanupStartedAt;
  if (evidence.lifecycle.cleanupDurationMs > cleanupBudgetMs) {
    evidence.cleanup.errors.push(`cleanup-budget:duration=${evidence.lifecycle.cleanupDurationMs} budget=${cleanupBudgetMs}`);
  }
}

async function persistEvidence() {
  evidence.finishedAt = new Date().toISOString();
  evidence.durationMs = Date.parse(evidence.finishedAt) - startedAt.getTime();
  evidence.status = mainError || evidence.cleanup.errors.length ? "FAIL" : "PASS";
  if (mainError) evidence.failure = safeError(mainError);
  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await chmod(evidencePath, 0o400);
  await access(evidencePath);
}

const executionPromise = executeRelay();
try {
  await Promise.race([executionPromise, interruptPromise]);
} catch (error) {
  mainError = error;
  // Every write boundary is cooperative and every external operation is bounded.
  // Wait for the in-flight operation to observe termination before cleanup can mutate state.
  await executionPromise.catch(() => {});
} finally {
  clearTimeout(deadlineTimer);
  try {
    await cleanupRun();
    await persistEvidence();
  } finally {
    process.removeListener("SIGTERM", onSigterm);
    process.removeListener("SIGINT", onSigint);
  }
}

const relativeEvidencePath = path.relative(root, evidencePath).split(path.sep).join("/");
if (mainError || evidence.cleanup.errors.length) {
  throw new Error(`MEMBER_LIFECYCLE_RELAY_FAIL evidence=${relativeEvidencePath} reason=${safeError(mainError || evidence.cleanup.errors[0])}`);
}
console.log(JSON.stringify({
  status: "PASS",
  processCode,
  sourceCommit,
  executionId,
  steps: steps.length,
  actorAccounts: switchedAccounts.length,
  screenshots: evidence.screenshotPaths.length,
  cleanup: {
    reset: evidence.cleanup.resetSucceeded,
    deleted: evidence.cleanup.deleteSucceeded,
    executions: evidence.cleanup.executionCount,
    events: evidence.cleanup.eventCount,
    drafts: evidence.cleanup.draftCount,
    activeTokens: evidence.cleanup.activeTokenCount,
  },
  evidencePath: relativeEvidencePath,
}));
