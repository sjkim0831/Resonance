import { createRequire } from "node:module";
import path from "node:path";

/**
 * Drives one freshly-started execution through the declared direct step chain.
 * The callbacks perform the concrete draft/command calls, while this shared
 * state-machine guard prevents a harness from skipping or reordering a step.
 */
export async function relayDeclaredProcessPrerequisites({
  steps,
  targetStepCode,
  startExecution,
  executeStep,
}) {
  if (!Array.isArray(steps) || !steps.length || typeof startExecution !== "function"
      || typeof executeStep !== "function" || !targetStepCode) {
    throw new Error("DECLARED_RELAY_PREREQUISITE_INPUT_INVALID");
  }
  const ordered = [...steps].sort((left, right) => Number(left.stepOrder) - Number(right.stepOrder)
    || String(left.stepCode).localeCompare(String(right.stepCode), "en"));
  if (new Set(ordered.map(row => String(row.stepCode))).size !== ordered.length
      || ordered.some((row, index) => !Number.isSafeInteger(Number(row.stepOrder))
        || Number(row.stepOrder) < 1
        || (index > 0 && Number(row.stepOrder) <= Number(ordered[index - 1].stepOrder)))) {
    throw new Error("DECLARED_RELAY_STEP_CHAIN_NOT_EXACT");
  }
  const targetIndex = ordered.findIndex(row => String(row.stepCode) === String(targetStepCode));
  if (targetIndex < 0) throw new Error("DECLARED_RELAY_TARGET_STEP_MISSING");
  const started = await startExecution(ordered[0]);
  const executionId = String(started?.executionId || "");
  let currentStepCode = String(started?.currentStepCode || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(executionId)
      || currentStepCode !== String(ordered[0].stepCode)) {
    throw new Error("DECLARED_RELAY_START_CONTEXT_INVALID");
  }
  const setupTransitions = [];
  for (let index = 0; index < targetIndex; index += 1) {
    const step = ordered[index], next = ordered[index + 1];
    if (currentStepCode !== String(step.stepCode)) {
      throw new Error("DECLARED_RELAY_CURRENT_STEP_MISMATCH");
    }
    const transition = await executeStep({ executionId, step, next, index });
    const nextStepCode = String(transition?.nextStepCode || "");
    if (nextStepCode !== String(next.stepCode)) {
      throw new Error("DECLARED_RELAY_NEXT_STEP_MISMATCH");
    }
    setupTransitions.push({
      stepCode: String(step.stepCode),
      nextStepCode,
      setupReceiptHash: String(transition?.setupReceiptHash || ""),
    });
    currentStepCode = nextStepCode;
  }
  return { executionId, currentStepCode, setupTransitions };
}

/**
 * Shared authenticated relay runtime. Business and generated-design smoke
 * harnesses use the same session creation, account switching and browser
 * cleanup path so a smoke producer cannot accidentally test as a different
 * principal than the one attached to its evidence.
 */
export async function openDeclaredProcessRelayRuntime({
  root,
  baseURL,
  password,
  accounts,
  loginPath = "/signin/actionLogin",
  requestTimeoutMs = 15_000,
}) {
  if (!root || !baseURL || !password || !accounts || !Object.keys(accounts).length) {
    throw new Error("DECLARED_RELAY_RUNTIME_INPUT_INVALID");
  }
  const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
  const { chromium, request } = require("@playwright/test");
  const contexts = new Map();
  let browser;
  let closed = false;

  try {
    for (const accountId of [...new Set(Object.values(accounts).map(String))].sort()) {
      const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
      const response = await api.post(loginPath, {
        data: { userId: accountId, userPw: password, userSe: "USR" },
        failOnStatusCode: false,
        timeout: requestTimeoutMs,
      });
      const body = await response.json().catch(() => ({}));
      if (response.status() !== 200 || body?.status !== "loginSuccess"
          || String(body?.userId || "").toLowerCase() !== accountId.toLowerCase()) {
        await api.dispose();
        throw new Error(`DECLARED_RELAY_LOGIN_REJECTED:${accountId}:${response.status()}`);
      }
      const state = await api.storageState();
      if (!state.cookies.length) {
        await api.dispose();
        throw new Error(`DECLARED_RELAY_SESSION_MISSING:${accountId}`);
      }
      contexts.set(accountId, api);
    }
  } catch (error) {
    for (const api of contexts.values()) await api.dispose().catch(() => {});
    throw error;
  }

  async function pageFor(accountId, viewport = { width: 1440, height: 1000 }) {
    const api = contexts.get(String(accountId));
    if (!api) throw new Error(`DECLARED_RELAY_ACCOUNT_NOT_OPEN:${accountId}`);
    browser ||= await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: await api.storageState(), viewport });
    const page = await context.newPage();
    return { context, page };
  }

  async function close() {
    if (closed) return;
    closed = true;
    if (browser) await browser.close().catch(() => {});
    for (const api of contexts.values()) await api.dispose().catch(() => {});
  }

  return {
    apiFor(accountId) {
      const api = contexts.get(String(accountId));
      if (!api) throw new Error(`DECLARED_RELAY_ACCOUNT_NOT_OPEN:${accountId}`);
      return api;
    },
    pageFor,
    close,
  };
}
