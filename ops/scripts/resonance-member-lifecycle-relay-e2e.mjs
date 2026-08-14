#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";

const authLockFile = String(process.env.CARBONET_QA_AUTH_LOCK_FILE || "/tmp/carbonet-qa-auth-session.lock");
const authLockTimeoutSeconds = String(process.env.CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS || "60");
if (process.env.CARBONET_MEMBER_RELAY_LOCK_HELD !== "1") {
  if (!/^[1-9]\d{0,3}$/.test(authLockTimeoutSeconds)) throw new Error("invalid QA authentication lock timeout");
  const locked = spawnSync("flock", [
    "-w", authLockTimeoutSeconds, authLockFile,
    process.execPath, ...process.argv.slice(1),
  ], {
    stdio: "inherit",
    env: { ...process.env, CARBONET_MEMBER_RELAY_LOCK_HELD: "1" },
  });
  if (locked.error) throw new Error("unable to acquire the canonical QA authentication lock");
  process.exit(locked.status ?? 1);
}
delete process.env.CARBONET_MEMBER_RELAY_LOCK_HELD;

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium, request } = require("@playwright/test");
const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const namespace = String(process.env.K8S_NAMESPACE || "carbonet-prod");
const postgresDatabase = String(process.env.POSTGRES_DB || "carbonet");
const postgresUser = String(process.env.POSTGRES_ADMIN_USER || "postgres");
const postgresContainer = String(process.env.CARBONET_POSTGRES_CONTAINER || "patroni");
const credentialSecret = String(process.env.CARBONET_MEMBER_RELAY_AUTH_SECRET
  || process.env.CARBONET_QA_AUTH_SECRET
  || "carbonet-test-account-switch");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const executablePath = ["/snap/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(existsSync);

const tenantId = "TEST_COMPANY_001";
const projectId = "PRJ-ACTOR-TEST";
const processCode = "MEMBER_LIFECYCLE";
const steps = [
  { stepCode: "MEMBER_LIFECYCLE_01_PLAN", actorCode: "COMPANY_MANAGER", accountId: "qaowner26", commandCode: "PLAN" },
  { stepCode: "MEMBER_LIFECYCLE_02_WORK", actorCode: "SITE_DATA_OWNER", accountId: "qadata26", commandCode: "WORK" },
  { stepCode: "MEMBER_LIFECYCLE_03_VERIFY", actorCode: "VERIFIER", accountId: "qaverify26", commandCode: "VERIFY" },
  { stepCode: "MEMBER_LIFECYCLE_04_APPROVE", actorCode: "APPROVER", accountId: "qaapprove26", commandCode: "APPROVE" },
];
const switchedAccounts = [...new Set(steps.map((step) => step.accountId))];
const startedAt = new Date();
const runId = `${startedAt.toISOString().replace(/[-:.TZ]/g, "")}-${sourceCommit.slice(0, 12)}-${crypto.randomUUID()}`;
const evidenceDirectory = path.join(root, "var/test-evidence/member-lifecycle-relay", runId);
const evidencePath = path.join(evidenceDirectory, "evidence.json");
const evidence = {
  schemaVersion: 1,
  runId,
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
  },
  uiRoutes: [],
  screenshotPaths: [],
  screenshots: [],
  cleanup: {
    resetAttempted: false,
    resetSucceeded: false,
    eventCount: null,
    draftCount: null,
    activeTokenBaseline: null,
    activeTokenCount: null,
    actorLogoutAttempts: [],
    adminLogout: null,
    contextDisposals: 0,
    errors: [],
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
const requestContexts = new Set();
const browserContexts = new Set();

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
    ["CARBONET_QA_AUTH_USER", "CARBONET_QA_AUTH_PASSWORD"],
    ["CARBONET_ADMIN_TEST_USER", "CARBONET_ADMIN_TEST_PASSWORD"],
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

function relayResidueCounts() {
  const execution = executionId
    ? sqlLiteral(executionId, "execution ID", /^[0-9a-f-]{36}$/i)
    : null;
  const project = sqlLiteral(projectId, "project ID");
  const process = sqlLiteral(processCode, "process code");
  const value = databaseQuery(`select
    (select count(*) from framework_process_execution_event event
     where ${execution ? `event.execution_id=${execution}::uuid` : "false"})::text
    || '|' ||
    (select count(*) from framework_process_work_draft draft
     where draft.tenant_id=${sqlLiteral(tenantId, "tenant ID")} and draft.project_id=${project} and draft.process_code=${process})::text`, "member relay residue query");
  const match = /^(\d+)\|(\d+)$/.exec(value);
  if (!match) throw new Error("member relay residue query returned an invalid result");
  return { eventCount: Number(match[1]), draftCount: Number(match[2]) };
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

async function createSwitchedContext(userId) {
  if (!adminStorageState) throw new Error("administrator storage state is unavailable");
  const context = await request.newContext({
    baseURL: baseUrl,
    ignoreHTTPSErrors: true,
    storageState: adminStorageState,
  });
  requestContexts.add(context);
  const response = await context.post("/signin/testAccountSwitch", {
    data: { userId },
    headers: { "X-Carbonet-Test-Mode": "1" },
    failOnStatusCode: false,
  });
  const body = await response.json().catch(() => ({}));
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
  await logoutAndDisposeActor("switch");
  actorApi = await createSwitchedContext(userId);
  actorUser = userId;
  return actorApi;
}

async function json(context, method, url, data, expected = [200]) {
  const options = {
    method,
    headers: { "X-Carbonet-Test-Mode": "1" },
    failOnStatusCode: false,
  };
  if (data !== undefined) options.data = data;
  const response = await context.fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!expected.includes(response.status())) throw new Error(`${method} ${url} HTTP ${response.status()} ${body.message || ""}`);
  return { response, body };
}

async function resetProcessState(context) {
  evidence.cleanup.resetAttempted = true;
  const reset = await json(context, "POST", "/home/api/process-executions/qa-instance", {
    action: "RESET", projectId, processCode,
  }, [200, 409]);
  evidence.cleanup.resetSucceeded = reset.response.status() === 200 && reset.body.success === true;
  if (reset.response.status() !== 200 && reset.body.message !== "관리할 QA 인스턴스가 없습니다. 먼저 추가하세요.") {
    throw new Error(`cleanup RESET failed HTTP ${reset.response.status()}`);
  }
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

  adminApi = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
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

  await switchAccount("qaapprove26");
  const wrongStart = await json(actorApi, "POST", "/home/api/process-executions/start", {
    tenantId, projectId, processCode, actorCode: "APPROVER",
  }, [403]);
  if (wrongStart.body.success !== false) throw new Error("wrong first-step actor was not rejected");
  evidence.checks.authorityDenial = true;

  await switchAccount("qaowner26");
  const current = await json(actorApi, "GET", `/home/api/process-executions?${new URLSearchParams({ tenantId, projectId, processCode })}`, undefined, [200]);
  if (current.body.found) {
    await json(actorApi, "POST", "/home/api/process-executions/qa-instance", { action: "RESET", projectId, processCode }, [200]);
  } else {
    await json(actorApi, "POST", "/home/api/process-executions/qa-instance", {
      action: "CREATE", projectId, processCode, actorCode: "COMPANY_MANAGER",
    }, [200]);
  }

  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
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

    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
      const uiContext = await browser.newContext({ storageState: await actorApi.storageState(), ignoreHTTPSErrors: true, viewport });
      browserContexts.add(uiContext);
      try {
        const page = await uiContext.newPage();
        const runtimeErrors = [];
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        const route = `/work/execution?${new URLSearchParams({ tenantId, projectId, processCode, stepCode: step.stepCode, guide: "1" })}`;
        const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.waitForFunction((code) => document.body.innerText.includes(code), step.stepCode, { timeout: 12_000 });
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
        if ((response?.status() || 0) >= 400 || runtimeErrors.length || !state.hasStep || state.controls < 8 || state.pageOverflow || state.hasRuntimeError) {
          throw new Error(`work UI failed ${viewport.name} ${step.stepCode} ${JSON.stringify(state)} ${runtimeErrors.join(" | ")}`);
        }
        evidence.uiRoutes.push({
          stepCode: step.stepCode,
          accountId: step.accountId,
          viewport: viewport.name,
          controls: state.controls,
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
        documentId: `QA-MEMBER-${index + 1}`,
        sourceUrl: `qa://${executionId}/${step.stepCode}`,
        checksum: crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
      }),
    }, [200]);
    if (save.body.draft?.draftStatus !== "DRAFT") throw new Error(`draft save failed ${step.stepCode}`);

    const idempotencyKey = crypto.randomUUID();
    const commandBody = {
      tenantId, projectId, processCode, stepCode: step.stepCode, actorCode: step.actorCode, commandCode: step.commandCode,
      idempotencyKey, requireDraft: true, requestJson: JSON.stringify(payload),
      resultJson: JSON.stringify({ completed: true, accountId: step.accountId }), snapshotRef: `qa:${executionId}:${step.stepCode}`,
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
  await verifyCompletedDatabaseState();
}

async function cleanupRun() {
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

  let cleanupOwnerApi = null;
  if (adminStorageState) {
    try {
      cleanupOwnerApi = await createSwitchedContext("qaowner26");
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
      const residue = relayResidueCounts();
      evidence.cleanup.eventCount = residue.eventCount;
      evidence.cleanup.draftCount = residue.draftCount;
      if (residue.eventCount !== 0 || residue.draftCount !== 0) {
        throw new Error(`post-cleanup residue events=${residue.eventCount} drafts=${residue.draftCount}`);
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

try {
  await executeRelay();
} catch (error) {
  mainError = error;
} finally {
  await cleanupRun();
  await persistEvidence();
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
    events: evidence.cleanup.eventCount,
    drafts: evidence.cleanup.draftCount,
    activeTokens: evidence.cleanup.activeTokenCount,
  },
  evidencePath: relativeEvidencePath,
}));
