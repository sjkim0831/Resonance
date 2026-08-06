#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const startedAt = Date.now();
const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const reportPath = "/admin/api/system/actor-process/system-test-report";
const fixturePath = argumentValue("--fixture") || process.env.SYSTEM_TEST_REPORT_FIXTURE || "";
const skipHttpSmoke = process.argv.includes("--skip-http-smoke") || process.env.SYSTEM_TEST_REPORT_SKIP_HTTP_SMOKE === "1";
const smokeConcurrency = boundedInteger(process.env.SYSTEM_TEST_REPORT_SMOKE_CONCURRENCY, 8, 1, 32);
const smokeTimeoutMs = boundedInteger(process.env.SYSTEM_TEST_REPORT_SMOKE_TIMEOUT_MS, 8_000, 500, 60_000);
const maxRouteSmokes = boundedInteger(process.env.SYSTEM_TEST_REPORT_MAX_ROUTE_SMOKES, 5_000, 1, 100_000);

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
    if (businessResult === "PASSED") {
      if (!text(item.latestBusinessRunId)) addIssue(issues, "BUSINESS_PASS_RUN_ID_MISSING");
      if (!text(item.businessCaseCode) || !text(item.businessCaseType)) addIssue(issues, "BUSINESS_PASS_CASE_MISSING");
      if (!meaningfulContract(item.businessEvidenceJson)) addIssue(issues, "BUSINESS_PASS_EVIDENCE_MISSING");
      if (!text(item.businessExecutedBy)) addIssue(issues, "BUSINESS_PASS_EXECUTOR_MISSING");
      if (!text(item.businessExecutedAt)) addIssue(issues, "BUSINESS_PASS_EXECUTED_AT_MISSING");
    }
    if (processCode && processOrders.has(processCode) && processOrders.get(processCode) !== developmentOrder) {
      addIssue(issues, "PROCESS_ORDER_INCONSISTENT");
    } else if (processCode) {
      processOrders.set(processCode, developmentOrder);
    }
    const normalized = { sourceIndex, processCode, stepCode, developmentOrder, stepOrder, contractResult, businessResult, issues };
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
    businessPassedCount: group.filter((item) => item.businessResult === "PASSED").length,
    businessBlockedCount: group.filter((item) => item.businessResult === "BLOCKED").length,
    businessNotRunCount: group.filter((item) => item.businessResult === "NOT_RUN").length,
  }));

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
  const reportResponse = await fetch(`${baseUrl}${reportPath}`, {
    headers: { accept: "application/json", cookie },
    signal: AbortSignal.timeout(Math.max(smokeTimeoutMs, 30_000)),
  });
  if (!reportResponse.ok) throw new Error(`system-test-report failed with HTTP ${reportResponse.status}`);
  const contentType = reportResponse.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`system-test-report returned non-JSON content type: ${contentType || "missing"}`);
  }
  return { payload: await reportResponse.json(), cookie };
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
    return { candidateCount: routes.length, smokedCount: 0, reachableCount: 0, unreachableCount: 0, skippedCount: routes.length, unreachable: [] };
  }
  const results = new Array(routes.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(smokeConcurrency, routes.length) }, async () => {
    while (cursor < routes.length) {
      const index = cursor++;
      results[index] = await smokeOne(routes[index], cookie);
    }
  });
  await Promise.all(workers);
  const blocked = results.filter((item) => item.result === "UNREACHABLE");
  return {
    candidateCount: routes.length,
    smokedCount: results.length,
    reachableCount: results.length - blocked.length,
    unreachableCount: blocked.length,
    skippedCount: 0,
    unreachable: blocked.slice(0, 100),
    p95Ms: results.length ? results.map((item) => item.durationMs).sort((a, b) => a - b)[Math.ceil(results.length * 0.95) - 1] : 0,
  };
}

async function main() {
  let payload;
  let cookie = "";
  let authenticated = false;
  if (fixturePath) {
    payload = JSON.parse(await readFile(fixturePath, "utf8"));
  } else {
    const live = await loadLiveReport();
    payload = live.payload;
    cookie = live.cookie;
    authenticated = true;
  }
  const audited = validate(payload);
  const routes = await smokeRoutes(audited.routes, cookie);
  const business = audited.processSummary.reduce((summary, process) => ({
    passedCount: summary.passedCount + process.businessPassedCount,
    blockedCount: summary.blockedCount + process.businessBlockedCount,
    notRunCount: summary.notRunCount + process.businessNotRunCount,
  }), { passedCount: 0, blockedCount: 0, notRunCount: 0 });
  const businessTestBlocked = business.blockedCount > 0 || business.notRunCount > 0;
  const blocked = businessTestBlocked || audited.validation.contractBlockedCount > 0 ||
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
      passCount: business.passedCount,
      blockedCount: business.blockedCount,
      notRunCount: business.notRunCount,
      recordedBusinessPassCount: business.passedCount,
      recordedBusinessBlockedCount: business.blockedCount,
      recordedBusinessNotRunCount: business.notRunCount,
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
    auditMode: "READ_ONLY_INVENTORY",
    businessExecutionPerformed: false,
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
