#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { availableParallelism } from "node:os";

const startedAt = Date.now();
const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const reportPath = "/admin/api/system/actor-process/system-test-report";
const auditPath = `${reportPath}/audit`;
const fixturePath = argumentValue("--fixture") || process.env.SYSTEM_TEST_REPORT_FIXTURE || "";
const skipHttpSmoke = process.argv.includes("--skip-http-smoke") || process.env.SYSTEM_TEST_REPORT_SKIP_HTTP_SMOKE === "1";
const detectedParallelism = Math.max(1, availableParallelism());
const adaptiveSmokeConcurrency = Math.min(24, Math.max(8, Math.floor(detectedParallelism * 0.75)));
const smokeConcurrency = boundedInteger(process.env.SYSTEM_TEST_REPORT_SMOKE_CONCURRENCY, adaptiveSmokeConcurrency, 1, 32);
const smokeTimeoutMs = boundedInteger(process.env.SYSTEM_TEST_REPORT_SMOKE_TIMEOUT_MS, 8_000, 500, 60_000);
const smokeProgressEvery = boundedInteger(process.env.SYSTEM_TEST_REPORT_SMOKE_PROGRESS_EVERY, 100, 1, 10_000);
const smokeProgressIntervalMs = boundedInteger(process.env.SYSTEM_TEST_REPORT_SMOKE_PROGRESS_INTERVAL_MS, 5_000, 250, 60_000);
const maxRouteSmokes = boundedInteger(process.env.SYSTEM_TEST_REPORT_MAX_ROUTE_SMOKES, 5_000, 1, 100_000);
const auditPageSize = boundedInteger(process.env.SYSTEM_TEST_REPORT_AUDIT_PAGE_SIZE, 250, 1, 500);
const maxAuditPages = boundedInteger(process.env.SYSTEM_TEST_REPORT_MAX_AUDIT_PAGES, 10_000, 1, 100_000);

const PASS_RESULTS = new Set(["PASSED"]);
const NOT_RUN_RESULTS = new Set(["", "NOT_RUN", "NOT-RUN"]);
const SUMMARY_FIELDS = {
  processCount: ["processCount"],
  stepCount: ["stepCount"],
  routedStepCount: ["routedStepCount"],
  passedStepCount: ["passedStepCount", "passedCount"],
  blockedStepCount: ["blockedStepCount", "blockedCount"],
  notRunStepCount: ["notRunStepCount", "notRunCount"],
  verifiedContractCount: ["verifiedContractCount"],
  totalContractCount: ["totalContractCount"],
};

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "") : "";
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function numeric(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function summaryNumber(summary, aliases) {
  for (const alias of aliases) {
    const value = numeric(summary[alias]);
    if (value != null) return value;
  }
  return null;
}

function bool(value) {
  return value === true || value === 1 || String(value).toLowerCase() === "true";
}

function meaningfulContract(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  const raw = text(value);
  if (!raw || ["{}", "[]", "null", "undefined", "-", "n/a", "todo", "tbd"].includes(raw.toLowerCase())) return false;
  try {
    const parsed = JSON.parse(raw);
    return meaningfulContract(parsed);
  } catch {
    return raw.length >= 3;
  }
}

function normalizeItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (!Array.isArray(payload?.processes)) return [];
  return payload.processes.flatMap((process, processIndex) => {
    const steps = Array.isArray(process?.steps) ? process.steps : [];
    return steps.map((step, stepIndex) => ({
      ...process,
      ...step,
      developmentOrder: step.developmentOrder ?? process.developmentOrder ?? processIndex + 1,
      stepOrder: step.stepOrder ?? step.order ?? stepIndex + 1,
      processCode: step.processCode ?? process.processCode ?? process.code,
      processName: step.processName ?? process.processName ?? process.name,
    }));
  });
}

function routeCandidates(item) {
  const candidates = [item.routePath, item.userPath, item.adminPath]
    .map(text)
    .filter(Boolean);
  return [...new Set(candidates)];
}

function safeRoute(route) {
  if (!route.startsWith("/") || route.startsWith("//") || /[{}<>]/.test(route)) return null;
  try {
    const url = new URL(route, baseUrl);
    if (url.origin !== new URL(baseUrl).origin) return null;
    if (/^\/.*\/api(?:\/|$)/.test(url.pathname) || /^\/api(?:\/|$)/.test(url.pathname)) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function normalizeResult(value) {
  const candidate = typeof value === "object" && value !== null
    ? value.status ?? value.result ?? value.outcome
    : value;
  const normalized = text(candidate).toUpperCase();
  if (PASS_RESULTS.has(normalized)) return "PASSED";
  if (NOT_RUN_RESULTS.has(normalized)) return "NOT_RUN";
  return "BLOCKED";
}

function validate(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("system-test-report must be a JSON object");
  }
  if (payload.success === false) throw new Error("system-test-report returned success=false");
  if (payload.businessFunctionsExecuted !== false) {
    throw new Error("system-test-report must explicitly declare businessFunctionsExecuted=false");
  }
  const items = normalizeItems(payload);
  if (!items.length) throw new Error("system-test-report contains no process-step items");

  const itemResults = [];
  const issueCounts = new Map();
  const processGroups = new Map();
  const processOrders = new Map();
  const routeSet = new Set();
  const seenSteps = new Set();
  const duplicateSteps = [];

  const addIssue = (issues, code) => {
    issues.push(code);
    issueCounts.set(code, (issueCounts.get(code) || 0) + 1);
  };

  for (const [sourceIndex, item] of items.entries()) {
    const processCode = text(item.processCode);
    const stepCode = text(item.stepCode);
    const developmentOrder = numeric(item.developmentOrder);
    const stepOrder = numeric(item.stepOrder);
    const issues = [];
    if (!text(item.domainCode)) addIssue(issues, "DOMAIN_CODE_MISSING");
    if (developmentOrder == null || developmentOrder < 1) addIssue(issues, "PROCESS_ORDER_INVALID");
    if (!processCode) addIssue(issues, "PROCESS_CODE_MISSING");
    if (!text(item.processName)) addIssue(issues, "PROCESS_NAME_MISSING");
    if (!stepCode) addIssue(issues, "STEP_CODE_MISSING");
    if (stepOrder == null || stepOrder < 1) addIssue(issues, "STEP_ORDER_INVALID");
    if (!text(item.stepName)) addIssue(issues, "STEP_NAME_MISSING");
    if (!text(item.actorCode)) addIssue(issues, "ACTOR_CODE_MISSING");
    if (!text(item.commandCode)) addIssue(issues, "COMMAND_CODE_MISSING");
    if (!text(item.fromState)) addIssue(issues, "FROM_STATE_MISSING");
    if (!text(item.toState)) addIssue(issues, "TO_STATE_MISSING");
    if (!text(item.completionRule)) addIssue(issues, "COMPLETION_RULE_MISSING");
    if (!meaningfulContract(item.inputContract)) addIssue(issues, "INPUT_CONTRACT_MISSING");
    if (!meaningfulContract(item.outputContract)) addIssue(issues, "OUTPUT_CONTRACT_MISSING");
    if (!meaningfulContract(item.apiContract)) addIssue(issues, "API_CONTRACT_MISSING");

    const routes = routeCandidates(item);
    if (bool(item.requiresUserPage) && !text(item.userPath)) addIssue(issues, "USER_ROUTE_MISSING");
    if (bool(item.requiresAdminPage) && !text(item.adminPath)) addIssue(issues, "ADMIN_ROUTE_MISSING");
    if ((bool(item.requiresUserPage) || bool(item.requiresAdminPage)) && routes.length === 0) {
      addIssue(issues, "ROUTE_MISSING");
    }
    for (const route of routes) {
      const safe = safeRoute(route);
      if (!safe) addIssue(issues, "ROUTE_INVALID");
      else routeSet.add(safe);
    }

    const identity = processCode && stepCode ? `${processCode}::${stepCode}` : "";
    if (identity && seenSteps.has(identity)) {
      duplicateSteps.push(identity);
      addIssue(issues, "DUPLICATE_PROCESS_STEP");
    } else if (identity) {
      seenSteps.add(identity);
    }

    const contractResult = normalizeResult(item.latestResult ?? item.testState);
    const simulationResult = normalizeResult(item.simulationTestResult);
    const businessResult = normalizeResult(item.businessTestResult);
    if (contractResult === "PASSED") {
      if (!text(item.latestRunId)) addIssue(issues, "CONTRACT_PASS_RUN_ID_MISSING");
      if (!meaningfulContract(item.latestInput)) addIssue(issues, "CONTRACT_PASS_INPUT_EVIDENCE_MISSING");
      if (!meaningfulContract(item.latestOutput) && !meaningfulContract(item.evidenceJson)) {
        addIssue(issues, "CONTRACT_PASS_OUTPUT_EVIDENCE_MISSING");
      }
      if (!text(item.executedBy)) addIssue(issues, "CONTRACT_PASS_EXECUTOR_MISSING");
      if (!text(item.executedAt)) addIssue(issues, "CONTRACT_PASS_EXECUTED_AT_MISSING");
      if ((numeric(item.scenarioCount) ?? 0) < 1) addIssue(issues, "CONTRACT_PASS_SCENARIO_MISSING");
    }
    if (simulationResult !== "NOT_RUN") {
      if (!text(item.latestSimulationRunId)) addIssue(issues, "SIMULATION_RUN_ID_MISSING");
      if (!text(item.simulationCaseCode) || !text(item.simulationCaseType)) addIssue(issues, "SIMULATION_CASE_MISSING");
      if (!text(item.simulationTraceScope)) addIssue(issues, "SIMULATION_TRACE_SCOPE_MISSING");
      if (!text(item.simulationProcessVersion)) addIssue(issues, "SIMULATION_PROCESS_VERSION_MISSING");
      if (!meaningfulContract(item.simulationEvidenceJson)) addIssue(issues, "SIMULATION_EVIDENCE_MISSING");
      if (!text(item.simulationExecutedBy)) addIssue(issues, "SIMULATION_EXECUTOR_MISSING");
      if (!text(item.simulationExecutedAt)) addIssue(issues, "SIMULATION_EXECUTED_AT_MISSING");
      if (simulationResult === "PASSED" && !bool(item.simulationCurrentVersion)) addIssue(issues, "SIMULATION_STALE_CONTRACT_VERSION");
    }
    if (businessResult !== "NOT_RUN") {
      addIssue(issues, "BUSINESS_RESULT_MUST_REMAIN_NOT_RUN");
    }
    if (text(item.businessEvidenceStatus) !== "EVIDENCE_LEDGER_UNAVAILABLE") {
      addIssue(issues, "BUSINESS_EVIDENCE_STATUS_INVALID");
    }
    if (processCode && processOrders.has(processCode) && processOrders.get(processCode) !== developmentOrder) {
      addIssue(issues, "PROCESS_ORDER_INCONSISTENT");
    } else if (processCode) {
      processOrders.set(processCode, developmentOrder);
    }
    const normalized = { sourceIndex, processCode, stepCode, developmentOrder, stepOrder, contractResult, simulationResult, businessResult, issues };
    itemResults.push(normalized);
    if (!processGroups.has(processCode)) processGroups.set(processCode, []);
    processGroups.get(processCode).push(normalized);
  }

  const orderViolations = [];
  let previousProcessOrder = -Infinity;
  for (const [processCode, developmentOrder] of processOrders) {
    if (developmentOrder != null && developmentOrder < previousProcessOrder) {
      orderViolations.push({ processCode, previousOrder: previousProcessOrder, developmentOrder, type: "PROCESS" });
      const first = processGroups.get(processCode)?.[0];
      if (first) {
        first.issues.push("PROCESS_ORDER_NOT_ASCENDING");
        issueCounts.set("PROCESS_ORDER_NOT_ASCENDING", (issueCounts.get("PROCESS_ORDER_NOT_ASCENDING") || 0) + 1);
      }
    }
    if (developmentOrder != null) previousProcessOrder = developmentOrder;
  }
  for (const [processCode, group] of processGroups) {
    let previous = -Infinity;
    for (const item of group) {
      if (item.stepOrder != null && item.stepOrder < previous) {
        orderViolations.push({ processCode, stepCode: item.stepCode, previousOrder: previous, stepOrder: item.stepOrder, type: "STEP" });
        item.issues.push("STEP_ORDER_NOT_ASCENDING");
        issueCounts.set("STEP_ORDER_NOT_ASCENDING", (issueCounts.get("STEP_ORDER_NOT_ASCENDING") || 0) + 1);
      }
      if (item.stepOrder != null) previous = item.stepOrder;
    }
  }

  const derived = {
    processCount: [...processGroups.keys()].filter(Boolean).length,
    stepCount: items.length,
    routedStepCount: itemResults.filter((entry) => routeCandidates(items[entry.sourceIndex]).some((route) => safeRoute(route))).length,
    passedStepCount: itemResults.filter((entry) => entry.contractResult === "PASSED").length,
    blockedStepCount: itemResults.filter((entry) => entry.contractResult === "BLOCKED").length,
    notRunStepCount: itemResults.filter((entry) => entry.contractResult === "NOT_RUN").length,
  };
  const summary = payload.summary && typeof payload.summary === "object" ? payload.summary : {};
  const summaryMismatches = [];
  if (text(summary.businessEvidenceStatus) !== "EVIDENCE_LEDGER_UNAVAILABLE") {
    summaryMismatches.push({ field: "businessEvidenceStatus", reported: summary.businessEvidenceStatus, expected: "EVIDENCE_LEDGER_UNAVAILABLE" });
  }
  for (const [field, aliases] of Object.entries(SUMMARY_FIELDS)) {
    const reported = summaryNumber(summary, aliases);
    if (reported == null) {
      summaryMismatches.push({ field, issue: "MISSING" });
      continue;
    }
    if (Object.hasOwn(derived, field) && reported !== derived[field]) {
      summaryMismatches.push({ field, reported, derived: derived[field] });
    }
  }
  const totalContractCount = summaryNumber(summary, SUMMARY_FIELDS.totalContractCount);
  const verifiedContractCount = summaryNumber(summary, SUMMARY_FIELDS.verifiedContractCount);
  if (totalContractCount != null && verifiedContractCount != null && verifiedContractCount > totalContractCount) {
    summaryMismatches.push({ field: "verifiedContractCount", issue: "EXCEEDS_TOTAL" });
  }

  const contractBlocked = itemResults.filter((entry) => entry.issues.length > 0);
  const processSummary = [...processGroups.entries()].map(([processCode, group]) => ({
    processCode,
    stepCount: group.length,
    contractDefinitionReadyCount: group.filter((item) => item.issues.length === 0).length,
    contractDefinitionBlockedCount: group.filter((item) => item.issues.length > 0).length,
    contractPassedCount: group.filter((item) => item.contractResult === "PASSED").length,
    contractTestBlockedCount: group.filter((item) => item.contractResult === "BLOCKED").length,
    contractNotRunCount: group.filter((item) => item.contractResult === "NOT_RUN").length,
    simulationPassedCount: group.filter((item) => item.simulationResult === "PASSED").length,
    simulationBlockedCount: group.filter((item) => item.simulationResult === "BLOCKED").length,
    simulationNotRunCount: group.filter((item) => item.simulationResult === "NOT_RUN").length,
    businessPassedCount: group.filter((item) => item.businessResult === "PASSED").length,
    businessBlockedCount: group.filter((item) => item.businessResult === "BLOCKED").length,
    businessNotRunCount: group.filter((item) => item.businessResult === "NOT_RUN").length,
  }));

  const auditCoverage = {
    targetCount: numeric(payload.targetCount ?? summary.auditTargetCount),
    auditedBindingCount: numeric(payload.auditedBindingCount),
    auditedCapabilityTargetCount: numeric(payload.auditedCapabilityTargetCount),
  };
  return {
    items,
    routes: [...routeSet].slice(0, maxRouteSmokes),
    routeCandidateCount: routeSet.size,
    derived,
    validation: {
      checkedItemCount: items.length,
      contractReadyCount: items.length - contractBlocked.length,
      contractBlockedCount: contractBlocked.length,
      issueCounts: Object.fromEntries([...issueCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
      summaryMismatchCount: summaryMismatches.length,
      summaryMismatches,
      orderViolationCount: orderViolations.length,
      orderViolations: orderViolations.slice(0, 50),
      duplicateStepCount: duplicateSteps.length,
      duplicateSteps: duplicateSteps.slice(0, 50),
    },
    processSummary,
    auditCoverage,
    reportedSummary: Object.fromEntries(Object.entries(SUMMARY_FIELDS).map(([field, aliases]) => [field, summaryNumber(summary, aliases)])),
  };
}

function splitSetCookie(raw) {
  if (!raw) return [];
  return raw.split(/,(?=\s*[^;,\s]+=)/g);
}

function cookieHeader(headers) {
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : splitSetCookie(headers.get("set-cookie"));
  return values.map((value) => value.split(";", 1)[0]).filter(Boolean).join("; ");
}

async function runContractAuditPages(cookie) {
  let targetOffset = 0;
  let pageCount = 0;
  const totals = { targetCount: 0, passedCount: 0, blockedCount: 0, errorCount: 0 };
  while (true) {
    pageCount += 1;
    if (pageCount > maxAuditPages) throw new Error(`contract audit exceeded ${maxAuditPages} pages`);
    const response = await fetch(`${baseUrl}${auditPath}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", cookie },
      body: JSON.stringify({ targetOffset, maxTargets: auditPageSize }),
      signal: AbortSignal.timeout(Math.max(smokeTimeoutMs, 60_000)),
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.toLowerCase().includes("application/json")) {
      throw new Error(`contract audit page ${pageCount} failed with HTTP ${response.status}`);
    }
    const page = await response.json();
    if (page?.success === false || page?.businessFunctionsExecuted !== false) {
      throw new Error(`contract audit page ${pageCount} violated the contract-only execution policy`);
    }
    const errorCount = numeric(page.errorCount) ?? 0;
    if (text(page.outcome ?? page.result).toUpperCase() === "ERROR" || errorCount > 0) {
      const failures = Array.isArray(page.runs)
        ? page.runs.filter((run) => text(run?.result).toUpperCase() === "ERROR")
        : [];
      const reasonCounts = new Map();
      for (const failure of failures) {
        const reason = text(failure?.message) || "CONTRACT_AUDIT_FAILED";
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      }
      const reasons = [...reasonCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 10)
        .map(([reason, count]) => `${reason}:${count}`)
        .join(",");
      const samples = failures.slice(0, 5).map((failure) => ({
        processCode: text(failure?.processCode),
        stepCode: text(failure?.stepCode),
        routePath: text(failure?.routePath),
        capabilityCode: text(failure?.capabilityCode),
        message: text(failure?.message) || "CONTRACT_AUDIT_FAILED",
      }));
      process.stderr.write(`[all-process-contract-audit] page=${pageCount} errors=${errorCount} reasons=${reasons || "unavailable"} samples=${JSON.stringify(samples)}\n`);
      throw new Error(`contract audit page ${pageCount} returned ${errorCount} errors`);
    }
    totals.targetCount += numeric(page.targetCount) ?? 0;
    totals.passedCount += numeric(page.passedCount) ?? 0;
    totals.blockedCount += numeric(page.blockedCount) ?? 0;
    totals.errorCount += errorCount;
    const hasMore = bool(page.hasMore);
    if (!hasMore) return { ...totals, pageCount, complete: true, lastTargetOffset: targetOffset };
    const nextTargetOffset = numeric(page.nextTargetOffset);
    if (nextTargetOffset == null || nextTargetOffset <= targetOffset) {
      throw new Error(`contract audit page ${pageCount} returned an invalid nextTargetOffset`);
    }
    targetOffset = nextTargetOffset;
  }
}

async function loadLiveReport() {
  const username = text(process.env.CARBONET_ADMIN_AUDIT_USER);
  const password = String(process.env.CARBONET_ADMIN_AUDIT_PASSWORD || "");
  if (!username || !password) throw new Error("Kubernetes admin audit credentials were not supplied");
  const response = await fetch(`${baseUrl}/admin/login/actionLogin`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ userId: username, userPw: password, userSe: "USR" }),
    signal: AbortSignal.timeout(smokeTimeoutMs),
  });
  const body = await response.json().catch(() => ({}));
  const cookie = cookieHeader(response.headers);
  if (!response.ok || body.status !== "loginSuccess" || !cookie) {
    throw new Error(`admin login failed with HTTP ${response.status}`);
  }
  const contractAudit = await runContractAuditPages(cookie);
  const reportResponse = await fetch(`${baseUrl}${reportPath}`, {
    headers: { accept: "application/json", cookie },
    signal: AbortSignal.timeout(Math.max(smokeTimeoutMs, 30_000)),
  });
  if (!reportResponse.ok) throw new Error(`system-test-report failed with HTTP ${reportResponse.status}`);
  const contentType = reportResponse.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`system-test-report returned non-JSON content type: ${contentType || "missing"}`);
  }
  return { payload: await reportResponse.json(), cookie, contractAudit };
}

async function smokeOne(route, cookie) {
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      method: "GET",
      redirect: "manual",
      headers: { accept: "text/html,application/json", cookie },
      signal: AbortSignal.timeout(smokeTimeoutMs),
    });
    const location = response.headers.get("location") || "";
    await response.body?.cancel().catch(() => undefined);
    const redirectedToLogin = response.status >= 300 && response.status < 400 && /\/(?:signin|login)(?:[/?]|$)/i.test(location);
    const passed = response.status >= 200 && response.status < 400 && !redirectedToLogin;
    return {
      route: new URL(route, baseUrl).pathname,
      statusCode: response.status,
      result: passed ? "REACHABLE" : "UNREACHABLE",
      reason: redirectedToLogin ? "AUTH_REDIRECT" : passed ? "GET_REACHABLE" : "HTTP_ERROR",
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      route: new URL(route, baseUrl).pathname,
      statusCode: 0,
      result: "UNREACHABLE",
      reason: error?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK_ERROR",
      durationMs: Date.now() - started,
    };
  }
}

async function smokeRoutes(routes, cookie) {
  if (skipHttpSmoke || !cookie) {
    return { candidateCount: routes.length, smokedCount: 0, reachableCount: 0, unreachableCount: 0, skippedCount: routes.length, unreachable: [], concurrency: 0, durationMs: 0, requestsPerSecond: 0 };
  }
  const smokeStartedAt = Date.now();
  const effectiveConcurrency = Math.min(smokeConcurrency, routes.length);
  const results = new Array(routes.length);
  let cursor = 0;
  let completed = 0;
  let nextProgress = Math.min(smokeProgressEvery, routes.length);
  let lastProgressAt = smokeStartedAt;
  const logProgress = (force = false) => {
    const now = Date.now();
    if (!force && completed < nextProgress && now - lastProgressAt < smokeProgressIntervalMs) return;
    const elapsedMs = Math.max(1, now - smokeStartedAt);
    const requestsPerSecond = completed * 1_000 / elapsedMs;
    const remaining = routes.length - completed;
    const etaSeconds = requestsPerSecond > 0 ? Math.ceil(remaining / requestsPerSecond) : null;
    const percentage = routes.length ? (completed * 100 / routes.length).toFixed(1) : "100.0";
    process.stderr.write(`[all-process-contract-audit] route-smoke progress=${completed}/${routes.length} percent=${percentage} concurrency=${effectiveConcurrency} rate=${requestsPerSecond.toFixed(1)}/s etaSeconds=${etaSeconds ?? "unknown"}\n`);
    while (nextProgress <= completed) nextProgress += smokeProgressEvery;
    lastProgressAt = now;
  };
  process.stderr.write(`[all-process-contract-audit] route-smoke start routes=${routes.length} concurrency=${effectiveConcurrency} detectedParallelism=${detectedParallelism} timeoutMs=${smokeTimeoutMs}\n`);
  const workers = Array.from({ length: effectiveConcurrency }, async () => {
    while (cursor < routes.length) {
      const index = cursor++;
      results[index] = await smokeOne(routes[index], cookie);
      completed += 1;
      logProgress(completed === routes.length);
    }
  });
  await Promise.all(workers);
  const durationMs = Date.now() - smokeStartedAt;
  const blocked = results.filter((item) => item.result === "UNREACHABLE");
  return {
    candidateCount: routes.length,
    smokedCount: results.length,
    reachableCount: results.length - blocked.length,
    unreachableCount: blocked.length,
    skippedCount: 0,
    unreachable: blocked.slice(0, 100),
    p95Ms: results.length ? results.map((item) => item.durationMs).sort((a, b) => a - b)[Math.ceil(results.length * 0.95) - 1] : 0,
    concurrency: effectiveConcurrency,
    durationMs,
    requestsPerSecond: durationMs > 0 ? Number((results.length * 1_000 / durationMs).toFixed(2)) : results.length,
  };
}

async function main() {
  let payload;
  let cookie = "";
  let authenticated = false;
  let contractAudit = { pageCount: 0, targetCount: 0, passedCount: 0, blockedCount: 0, errorCount: 0, complete: false, skipped: true };
  if (fixturePath) {
    payload = JSON.parse(await readFile(fixturePath, "utf8"));
    cookie = text(process.env.SYSTEM_TEST_REPORT_FIXTURE_COOKIE);
  } else {
    const live = await loadLiveReport();
    payload = live.payload;
    cookie = live.cookie;
    contractAudit = { ...live.contractAudit, skipped: false };
    authenticated = true;
  }
  const audited = validate(payload);
  const routes = await smokeRoutes(audited.routes, cookie);
  const business = audited.processSummary.reduce((summary, process) => ({
    passedCount: summary.passedCount + process.businessPassedCount,
    blockedCount: summary.blockedCount + process.businessBlockedCount,
    notRunCount: summary.notRunCount + process.businessNotRunCount,
  }), { passedCount: 0, blockedCount: 0, notRunCount: 0 });
  const simulation = audited.processSummary.reduce((summary, process) => ({
    passedCount: summary.passedCount + process.simulationPassedCount,
    blockedCount: summary.blockedCount + process.simulationBlockedCount,
    notRunCount: summary.notRunCount + process.simulationNotRunCount,
  }), { passedCount: 0, blockedCount: 0, notRunCount: 0 });
  const contractTestBlocked = audited.derived.blockedStepCount > 0 || audited.derived.notRunStepCount > 0;
  const businessEvidenceInvalid = business.passedCount > 0 || business.blockedCount > 0;
  const blocked = contractTestBlocked || businessEvidenceInvalid || audited.validation.contractBlockedCount > 0 ||
    audited.validation.summaryMismatchCount > 0 || routes.unreachableCount > 0 ||
    audited.routeCandidateCount > maxRouteSmokes;
  const output = {
    status: blocked ? "BLOCKED" : "PASS",
    authenticated,
    endpoint: reportPath,
    summary: {
      processCount: audited.derived.processCount,
      stepCount: audited.derived.stepCount,
      routedStepCount: audited.derived.routedStepCount,
      passCount: audited.derived.passedStepCount,
      blockedCount: audited.derived.blockedStepCount,
      notRunCount: audited.derived.notRunStepCount,
      recordedBusinessPassCount: business.passedCount,
      recordedBusinessBlockedCount: business.blockedCount,
      recordedBusinessNotRunCount: business.notRunCount,
      simulationPassedCount: simulation.passedCount,
      simulationBlockedCount: simulation.blockedCount,
      simulationNotRunCount: simulation.notRunCount,
      contractTestPassedCount: audited.derived.passedStepCount,
      contractTestBlockedCount: audited.derived.blockedStepCount,
      contractTestNotRunCount: audited.derived.notRunStepCount,
      contractReadyCount: audited.validation.contractReadyCount,
      contractBlockedCount: audited.validation.contractBlockedCount,
      routeCandidateCount: audited.routeCandidateCount,
    },
    reportedSummary: audited.reportedSummary,
    validation: audited.validation,
    routeSmoke: routes,
    processes: audited.processSummary,
    auditCoverage: audited.auditCoverage,
    contractAuditPagination: contractAudit,
    auditMode: authenticated ? "CONTRACT_EVIDENCE_REFRESH_AND_READ_ONLY_INVENTORY" : "READ_ONLY_INVENTORY",
    businessExecutionPerformed: false,
    businessFunctionsExecuted: false,
    contractTestResultsAreNotBusinessTests: true,
    evidencePolicy: "READ_ONLY_AUDIT_BUSINESS_PASS_REQUIRES_RECORDED_BUSINESS_RUN_NO_PROMOTION",
    durationMs: Date.now() - startedAt,
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = blocked ? 3 : 0;
}

main().catch((error) => {
  process.stderr.write(`[all-process-contract-audit] ${error.message}\n`);
  process.stdout.write(`${JSON.stringify({
    status: "ERROR",
    authenticated: false,
    endpoint: reportPath,
    summary: { processCount: 0, stepCount: 0, routedStepCount: 0, passCount: 0, blockedCount: 0, notRunCount: 0, contractReadyCount: 0, contractBlockedCount: 0, routeCandidateCount: 0 },
    errorCode: "AUDIT_EXECUTION_FAILED",
    durationMs: Date.now() - startedAt,
  })}\n`);
  process.exitCode = 2;
});
