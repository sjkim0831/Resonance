#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.RESONANCE_ROOT || path.join(testRoot, "../.."));
const frontendRoot = path.join(root, "projects/carbonet-frontend/source");
const panelPath = path.join(frontendRoot, "src/features/task-quest/TaskQuestPanel.tsx");
const gatePath = path.join(frontendRoot, "src/features/task-quest/taskQuestSessionGate.ts");
const frontendSessionHookPath = path.join(frontendRoot, "src/app/hooks/useFrontendSession.ts");
const adminShellPath = path.join(frontendRoot, "src/lib/api/adminShell.ts");
const pipelinePath = path.join(frontendRoot, "scripts/run-frontend-pipeline.mjs");
const sources = {
  panel: readFileSync(panelPath, "utf8"),
  gate: readFileSync(gatePath, "utf8"),
  hook: readFileSync(frontendSessionHookPath, "utf8"),
  admin: readFileSync(adminShellPath, "utf8"),
  pipeline: readFileSync(pipelinePath, "utf8"),
};

const required = [
  ["reactive session hook import", "panel", 'import { useFrontendSession } from "../../app/hooks/useFrontendSession"'],
  ["reactive session hook call", "panel", "const sessionState = useFrontendSession()"],
  ["shared fail-closed gate", "panel", "const canLoadPrivateTasks = canLoadTaskQuestPrivateTasks(sessionState.value)"],
  ["private request guard", "panel", "async function load() {\n    const sequence = beginTaskQuestPrivateLoad(privateLoadSequence);\n    if(!canLoadPrivateTasks){setData(null);setLoading(false);return;}"],
  ["private emission task request", "panel", 'fetch(`${api}?compact=true`, { credentials: "include" })'],
  ["effect private request guard", "panel", "useEffect(() => {\n    if(!canLoadPrivateTasks){invalidateTaskQuestPrivateLoad(privateLoadSequence);setData(null);setLoading(false);return;}"],
  ["stale private response rejection", "panel", "if (!isCurrentTaskQuestPrivateLoad(privateLoadSequence, sequence)) return"],
  ["unauthorized response reset", "panel", "if (isCurrentTaskQuestPrivateLoad(privateLoadSequence, sequence)) setData(null)"],
  ["effect cleanup invalidates pending load", "panel", "return () => {\n      window.clearInterval(timer);\n      invalidateTaskQuestPrivateLoad(privateLoadSequence);\n    }"],
  ["session transition dependency", "panel", "[api,canLoadPrivateTasks]"],
  ["authenticated data-backed panel gate", "panel", "if (!canLoadPrivateTasks || !data) return null"],
  ["next task trigger name", "panel", 'aria-label={en ? "My next task" : "다음 업무"}'],
  ["QA trigger name", "panel", 'aria-label={en ? "QA workflow" : "QA 업무"}'],
  ["workflow process selector name", "panel", 'aria-label={en ? "Process" : "업무 프로세스"}'],
  ["clickable workflow close name", "panel", 'aria-label={en ? "Close workflow" : "전체 업무 닫기"}'],
  ["workflow backdrop hidden", "panel", 'aria-hidden="true"\n                className="absolute inset-0 cursor-default"\n                onClick={() => setFlowOpen(false)}\n                tabIndex={-1}'],
  ["route process coordinate", "panel", 'const routeProcessCode = routeUrl.searchParams.get("processCode") || routeUrl.searchParams.get("process") || ""'],
  ["route step coordinate", "panel", 'const routeStepCode = routeUrl.searchParams.get("stepCode") || ""'],
  ["screen workflow coordinate", "panel", "screenContext: screenContext?.workflow"],
  ["strict authenticated helper", "gate", "return session?.authenticated === true"],
  ["monotonic private load epoch", "gate", "export function beginTaskQuestPrivateLoad(epoch: TaskQuestPrivateLoadEpoch): number {\n  epoch.current += 1;\n  return epoch.current;\n}"],
  ["private load epoch invalidation", "gate", "export function invalidateTaskQuestPrivateLoad(epoch: TaskQuestPrivateLoadEpoch): void {\n  epoch.current += 1;\n}"],
  ["exact current private load", "gate", "return epoch.current === sequence"],
  ["route-first process priority", "gate", "source.screenContext?.processCode,\n      source.route?.processCode,\n      source.selectedProcessCode,\n      source.focused?.processCode,\n      source.task?.processCode"],
  ["route-first step priority", "gate", "source.screenContext?.stepCode,\n      source.route?.stepCode,\n      source.focused?.stepCode,\n      source.task?.stepCode"],
  ["process-first domain priority", "gate", 'firstNonBlank(processDomainCode, taskDomainCode, selectedWorkType, "ALL")'],
  ["dedicated session invalidation event", "admin", 'const FRONTEND_SESSION_INVALIDATION_EVENT = "carbonet:frontend-session:invalidate"'],
  ["bootstrap session removal", "admin", "delete bootstrap.frontendSession"],
  ["session cache generation invalidation", "admin", "frontendSessionGeneration += 1"],
  ["stale session cache rejection", "admin", "if (generation === frontendSessionGeneration)"],
  ["session promise identity guard", "admin", "if (frontendSessionPromise === request)"],
  ["global session invalidation dispatch", "admin", "window.dispatchEvent(new Event(FRONTEND_SESSION_INVALIDATION_EVENT))"],
  ["session invalidation listener", "hook", "window.addEventListener(eventName, handleInvalidation)"],
  ["stable session reload ref", "hook", "const reloadRef = useRef(sessionState.reload)"],
  ["immediate session clear before reload", "hook", 'sessionState.setValue(null);\n      sessionState.setError("");\n      void reloadRef.current()'],
  ["session listener cleanup", "hook", "return () => window.removeEventListener(eventName, handleInvalidation)"],
  ["automatic frontend validation", "pipeline", "ops/tests/test-taskquest-session-gate.mjs"],
];

function violations(candidateSources) {
  const missing = required
    .filter(([, file, token]) => !candidateSources[file].includes(token))
    .map(([name]) => name);
  if (candidateSources.panel.includes("__CARBONET_REACT_BOOTSTRAP__")) {
    missing.push("no static bootstrap snapshot");
  }
  if ((candidateSources.panel.match(/aria-label=\{en \? "Close workflow" : "전체 업무 닫기"\}/g) || []).length !== 1) {
    missing.push("single accessible workflow close");
  }
  if ((candidateSources.admin.match(/dispatchEvent\(new Event\(FRONTEND_SESSION_INVALIDATION_EVENT\)\)/g) || []).length !== 1) {
    missing.push("session invalidation dispatches once");
  }
  return missing;
}

assert.deepEqual(violations(sources), [], "TaskQuest session contract is incomplete");

const nodeModules = process.env.CARBONET_FRONTEND_NODE_MODULES
  ? path.resolve(process.env.CARBONET_FRONTEND_NODE_MODULES)
  : path.join(frontendRoot, "node_modules");
const ts = await import(pathToFileURL(path.join(nodeModules, "typescript/lib/typescript.js")).href);

function loadGateModule(candidate) {
  const compiled = ts.transpileModule(candidate, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function (module, exports) { ${compiled}\n})(module, module.exports);`, {
    module,
  });
  return module.exports;
}

function loadAdminShellModule(candidate, bootstrapSession = null) {
  const compiled = ts.transpileModule(candidate, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const storage = new Map();
  const pendingRequests = [];
  let fetchCount = 0;
  let invalidationDispatchCount = 0;
  const listenerSets = new Map();
  const windowTarget = new EventTarget();
  const fakeWindow = {
    __CARBONET_REACT_BOOTSTRAP__: bootstrapSession
      ? { frontendSession: bootstrapSession }
      : {},
    location: { origin: "https://carbonet.test" },
    localStorage: {
      getItem: (key) => storage.get(`local:${key}`) ?? null,
      removeItem: (key) => storage.delete(`local:${key}`),
      setItem: (key, value) => storage.set(`local:${key}`, String(value)),
    },
    addEventListener(name, listener) {
      const listeners = listenerSets.get(name) || new Set();
      listeners.add(listener);
      listenerSets.set(name, listeners);
      windowTarget.addEventListener(name, listener);
    },
    removeEventListener(name, listener) {
      listenerSets.get(name)?.delete(listener);
      windowTarget.removeEventListener(name, listener);
    },
    dispatchEvent(event) {
      if (event.type === "carbonet:frontend-session:invalidate") {
        invalidationDispatchCount += 1;
      }
      return windowTarget.dispatchEvent(event);
    },
  };
  const pageCache = {
    SESSION_STORAGE_CACHE_PREFIX: "carbonet:test:",
    readSessionStorageCache(key) {
      return storage.get(`session:${key}`) ?? null;
    },
    removeSessionStorageCache(key) {
      storage.delete(`session:${key}`);
    },
    writeSessionStorageCache(key, value) {
      storage.set(`session:${key}`, value);
    },
  };
  const core = {
    buildAdminApiPath: (value) => value,
    buildResilientCsrfHeaders: async (headers) => headers,
    fetchJson: async () => ({}),
    fetchJsonWithResponse() {
      fetchCount += 1;
      let resolve;
      let reject;
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      pendingRequests.push({ resolve, reject });
      return promise;
    },
    postJson: async () => ({}),
  };
  const require = (specifier) => {
    if (specifier === "../navigation/runtime") return { buildLocalizedPath: (ko) => ko };
    if (specifier === "./core") return core;
    if (specifier === "./pageCache") return pageCache;
    if (specifier === "./menuNormalization") return { normalizeAdminEmissionMenuTree: (value) => value };
    throw new Error(`Unexpected adminShell dependency: ${specifier}`);
  };
  const module = { exports: {} };
  vm.runInNewContext(`(function (module, exports, require) { ${compiled}\n})(module, module.exports, require);`, {
    Event,
    URL,
    module,
    require,
    window: fakeWindow,
  });
  return {
    api: module.exports,
    fakeWindow,
    get fetchCount() { return fetchCount; },
    get invalidationDispatchCount() { return invalidationDispatchCount; },
    listenerCount(name) { return listenerSets.get(name)?.size || 0; },
    resolveRequest(index, session) {
      pendingRequests[index].resolve({ response: { ok: true, status: 200 }, body: session });
    },
  };
}

function mountSessionConsumer(harness) {
  const eventName = harness.api.getFrontendSessionInvalidationEventName();
  let value = harness.api.readFrontendSessionSnapshot();
  let reloadCount = 0;
  const handleInvalidation = () => {
    value = null;
    reloadCount += 1;
    void harness.api.fetchFrontendSession().then((nextValue) => {
      value = nextValue;
    });
  };
  harness.fakeWindow.addEventListener(eventName, handleInvalidation);
  return {
    get value() { return value; },
    get reloadCount() { return reloadCount; },
    unmount() {
      harness.fakeWindow.removeEventListener(eventName, handleInvalidation);
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function simulateSessionTransitions(gate, sessions) {
  let requests = 0;
  let data = null;
  for (const session of sessions) {
    if (!gate(session)) {
      data = null;
      continue;
    }
    requests += 1;
    data = { items: [{ id: 1, name: "Emission task" }] };
  }
  return { requests, panelVisible: Boolean(data) };
}

const gateModule = loadGateModule(sources.gate);
const gate = gateModule.canLoadTaskQuestPrivateTasks;
assert.equal(gate(undefined), false, "unresolved session must fail closed");
assert.equal(gate(null), false, "missing session must fail closed");
assert.equal(gate({ authenticated: false }), false, "anonymous session must fail closed");
assert.equal(gate({ authenticated: "true" }), false, "non-boolean authentication must fail closed");
assert.equal(gate({ authenticated: true }), true, "authenticated session must open the private gate");

function routeBoundWorkflowOutcome(api) {
  const coordinate = api.resolveTaskQuestWorkflowCoordinate({
    screenContext: null,
    route: { processCode: "MEMBER_LIFECYCLE", stepCode: "MEMBER_LIFECYCLE_01_REQUEST" },
    selectedProcessCode: "MEMBER_LIFECYCLE",
    focused: { processCode: "EMISSION_PROJECT", stepCode: "EMISSION_PROJECT_02_DEFINE" },
    task: { processCode: "EMISSION_PROJECT", stepCode: "EMISSION_PROJECT_03_ASSIGN" },
  });
  const domainCode = api.resolveTaskQuestWorkflowDomainCode("MEMBER", "EMISSION", "EMISSION");
  return `${coordinate.processCode}|${coordinate.stepCode}|${domainCode}`;
}

assert.equal(
  routeBoundWorkflowOutcome(gateModule),
  "MEMBER_LIFECYCLE|MEMBER_LIFECYCLE_01_REQUEST|MEMBER",
  "opening the workflow must preserve the route-bound MEMBER process, step, and domain",
);

async function twoSessionConsumerOutcome(candidate) {
  const harness = loadAdminShellModule(candidate, { authenticated: true, accountId: "member" });
  const eventName = harness.api.getFrontendSessionInvalidationEventName();
  const taskQuest = mountSessionConsumer(harness);
  const header = mountSessionConsumer(harness);
  const initialAuthenticated = taskQuest.value?.authenticated === true
    && header.value?.authenticated === true;
  const listenersBefore = harness.listenerCount(eventName);
  harness.api.invalidateFrontendSessionCache();
  const immediateNull = taskQuest.value === null && header.value === null;
  const bootstrapRemoved = !("frontendSession" in harness.fakeWindow.__CARBONET_REACT_BOOTSTRAP__);
  const staleSnapshot = harness.api.readFrontendSessionSnapshot();
  const fetchCountAfterInvalidation = harness.fetchCount;
  if (fetchCountAfterInvalidation === 1) {
    harness.resolveRequest(0, { authenticated: false, accountId: null });
  }
  await flushMicrotasks();
  const anonymousAfterReload = taskQuest.value?.authenticated === false
    && header.value?.authenticated === false;
  const dispatchesAfterReload = harness.invalidationDispatchCount;
  taskQuest.unmount();
  header.unmount();
  const listenersAfter = harness.listenerCount(eventName);
  const reloadsBeforeUnmountedInvalidation = taskQuest.reloadCount + header.reloadCount;
  harness.api.invalidateFrontendSessionCache();
  await flushMicrotasks();
  return {
    initialAuthenticated,
    immediateNull,
    bootstrapRemoved,
    staleSnapshotIsNull: staleSnapshot === null,
    fetchCountAfterInvalidation,
    anonymousAfterReload,
    dispatchesAfterReload,
    listenersBefore,
    listenersAfter,
    reloadsAfterUnmountedInvalidation: taskQuest.reloadCount + header.reloadCount,
    reloadsBeforeUnmountedInvalidation,
    fetchCountAfterUnmountedInvalidation: harness.fetchCount,
    dispatchesAfterUnmountedInvalidation: harness.invalidationDispatchCount,
  };
}

const twoConsumerResult = await twoSessionConsumerOutcome(sources.admin);
assert.deepEqual(twoConsumerResult, {
  initialAuthenticated: true,
  immediateNull: true,
  bootstrapRemoved: true,
  staleSnapshotIsNull: true,
  fetchCountAfterInvalidation: 1,
  anonymousAfterReload: true,
  dispatchesAfterReload: 1,
  listenersBefore: 2,
  listenersAfter: 0,
  reloadsAfterUnmountedInvalidation: 2,
  reloadsBeforeUnmountedInvalidation: 2,
  fetchCountAfterUnmountedInvalidation: 1,
  dispatchesAfterUnmountedInvalidation: 2,
}, "two hook consumers must fail closed, share one reload, clean up listeners, and never loop");

async function staleSessionRequestOutcome(candidate) {
  const harness = loadAdminShellModule(candidate);
  const staleRequest = harness.api.fetchFrontendSession();
  harness.api.invalidateFrontendSessionCache();
  const currentRequest = harness.api.fetchFrontendSession();
  harness.resolveRequest(0, { authenticated: true, accountId: "stale-member" });
  await staleRequest;
  await flushMicrotasks();
  const dedupedCurrentRequest = harness.api.fetchFrontendSession();
  const fetchCountWhileCurrentPending = harness.fetchCount;
  if (fetchCountWhileCurrentPending !== 2) {
    return { fetchCountWhileCurrentPending, currentAuthenticated: null, snapshotAuthenticated: null };
  }
  harness.resolveRequest(1, { authenticated: false, accountId: null });
  const [, dedupedSession] = await Promise.all([currentRequest, dedupedCurrentRequest]);
  await flushMicrotasks();
  return {
    fetchCountWhileCurrentPending,
    currentAuthenticated: dedupedSession.authenticated,
    snapshotAuthenticated: harness.api.readFrontendSessionSnapshot()?.authenticated,
  };
}

assert.deepEqual(await staleSessionRequestOutcome(sources.admin), {
  fetchCountWhileCurrentPending: 2,
  currentAuthenticated: false,
  snapshotAuthenticated: false,
}, "a stale authenticated response must not replace or detach the deduplicated anonymous reload");
assert.deepEqual(
  await simulateSessionTransitions(gate, [undefined, { authenticated: true }]),
  { requests: 1, panelVisible: true },
  "a delayed authenticated session must fetch once and reveal the data-backed panel",
);
assert.deepEqual(
  await simulateSessionTransitions(gate, [undefined, { authenticated: false }]),
  { requests: 0, panelVisible: false },
  "an anonymous session must never issue the private request or reveal the panel",
);
assert.deepEqual(
  await simulateSessionTransitions(gate, [{ authenticated: true }, { authenticated: false }]),
  { requests: 1, panelVisible: false },
  "logout must clear the private panel without issuing an additional request",
);
assert.deepEqual(
  await simulateSessionTransitions(gate, [{ authenticated: true }, undefined]),
  { requests: 1, panelVisible: false },
  "an unknown session transition must clear the private panel without issuing an additional request",
);

async function simulateLatePrivateResponse(api) {
  const epoch = { current: 0 };
  let resolveResponse;
  const pendingResponse = new Promise((resolve) => { resolveResponse = resolve; });
  let fetchCount = 0;
  let data = null;
  let authenticated = true;
  const request = (async () => {
    const sequence = api.beginTaskQuestPrivateLoad(epoch);
    if (!api.canLoadTaskQuestPrivateTasks({ authenticated })) return;
    fetchCount += 1;
    const body = await pendingResponse;
    if (!api.isCurrentTaskQuestPrivateLoad(epoch, sequence)) return;
    data = body;
  })();
  authenticated = false;
  api.invalidateTaskQuestPrivateLoad(epoch);
  data = null;
  resolveResponse({ items: [{ id: 1, name: "Late private task" }] });
  await request;
  return { fetchCount, data, panelVisible: authenticated && Boolean(data) };
}

assert.deepEqual(
  await simulateLatePrivateResponse(gateModule),
  { fetchCount: 1, data: null, panelVisible: false },
  "logout must invalidate a pending private response before it can restore task data",
);

let mutants = 0;
for (const [name, expectedViolation, mutant] of [
  ["static bootstrap snapshot", "reactive session hook call", {
    ...sources,
    panel: sources.panel
      .replace("const sessionState = useFrontendSession();", "const sessionState = window.__CARBONET_REACT_BOOTSTRAP__?.frontendSession;")
      .replace("const canLoadPrivateTasks = canLoadTaskQuestPrivateTasks(sessionState.value);", "const canLoadPrivateTasks = canLoadTaskQuestPrivateTasks(sessionState);"),
  }],
  ["anonymous request", "private request guard", {
    ...sources,
    panel: sources.panel.replace(
      "async function load() {\n    const sequence = beginTaskQuestPrivateLoad(privateLoadSequence);\n    if(!canLoadPrivateTasks){setData(null);setLoading(false);return;}",
      "async function load() {",
    ),
  }],
  ["effect starts anonymous load", "effect private request guard", {
    ...sources,
    panel: sources.panel.replace(
      "useEffect(() => {\n    if(!canLoadPrivateTasks){invalidateTaskQuestPrivateLoad(privateLoadSequence);setData(null);setLoading(false);return;}",
      "useEffect(() => {",
    ),
  }],
  ["non-reactive effect", "session transition dependency", {
    ...sources,
    panel: sources.panel.replace("[api,canLoadPrivateTasks]", "[api]"),
  }],
  ["effect cleanup retains late response", "effect cleanup invalidates pending load", {
    ...sources,
    panel: sources.panel.replace(
      "return () => {\n      window.clearInterval(timer);\n      invalidateTaskQuestPrivateLoad(privateLoadSequence);\n    }",
      "return () => window.clearInterval(timer)",
    ),
  }],
  ["empty panel visible", "authenticated data-backed panel gate", {
    ...sources,
    panel: sources.panel.replace("if (!canLoadPrivateTasks || !data) return null;", ""),
  }],
  ["stale private response", "stale private response rejection", {
    ...sources,
    panel: sources.panel.replace("if (!isCurrentTaskQuestPrivateLoad(privateLoadSequence, sequence)) return;", ""),
  }],
  ["accessible backdrop duplicates close", "single accessible workflow close", {
    ...sources,
    panel: sources.panel.replace(
      'aria-hidden="true"\n                className="absolute inset-0 cursor-default"',
      'aria-label={en ? "Close workflow" : "전체 업무 닫기"}\n                className="absolute inset-0 cursor-default"',
    ),
  }],
]) {
  mutants += 1;
  assert(violations(mutant).includes(expectedViolation), `${name} mutant survived`);
}

for (const [name, file, token] of required) {
  mutants += 1;
  const mutant = { ...sources, [file]: sources[file].replace(token, "__REMOVED_BY_MUTANT__") };
  assert(violations(mutant).includes(name), `${name} mutant survived`);
}

for (const [name, mutantSource] of [
  ["truthy authentication", sources.gate.replace("session?.authenticated === true", "Boolean(session?.authenticated)")],
  ["default authenticated", sources.gate.replace("session?.authenticated === true", "session?.authenticated !== false")],
]) {
  mutants += 1;
  const mutantGate = loadGateModule(mutantSource).canLoadTaskQuestPrivateTasks;
  const anonymous = await simulateSessionTransitions(mutantGate, [undefined, { authenticated: false }]);
  const delayed = await simulateSessionTransitions(mutantGate, [undefined, { authenticated: true }]);
  assert(
    mutantGate(undefined) !== false
      || mutantGate({ authenticated: false }) !== false
      || mutantGate({ authenticated: "true" }) !== false
      || mutantGate({ authenticated: true }) !== true
      || anonymous.requests !== 0
      || delayed.requests !== 1
      || !delayed.panelVisible,
    `${name} mutant survived`,
  );
}

for (const [name, mutantSource] of [
  ["focused process overrides route", sources.gate.replace(
    "source.screenContext?.processCode,\n      source.route?.processCode,\n      source.selectedProcessCode,\n      source.focused?.processCode,\n      source.task?.processCode",
    "source.focused?.processCode,\n      source.task?.processCode,\n      source.screenContext?.processCode,\n      source.route?.processCode,\n      source.selectedProcessCode",
  )],
  ["focused step overrides route", sources.gate.replace(
    "source.screenContext?.stepCode,\n      source.route?.stepCode,\n      source.focused?.stepCode,\n      source.task?.stepCode",
    "source.focused?.stepCode,\n      source.task?.stepCode,\n      source.screenContext?.stepCode,\n      source.route?.stepCode",
  )],
  ["task domain overrides process", sources.gate.replace(
    'firstNonBlank(processDomainCode, taskDomainCode, selectedWorkType, "ALL")',
    'firstNonBlank(taskDomainCode, processDomainCode, selectedWorkType, "ALL")',
  )],
]) {
  mutants += 1;
  assert.notEqual(
    routeBoundWorkflowOutcome(loadGateModule(mutantSource)),
    "MEMBER_LIFECYCLE|MEMBER_LIFECYCLE_01_REQUEST|MEMBER",
    `${name} mutant survived`,
  );
}

for (const [name, mutantSource] of [
  ["logout does not invalidate epoch", sources.gate.replace(
    "export function invalidateTaskQuestPrivateLoad(epoch: TaskQuestPrivateLoadEpoch): void {\n  epoch.current += 1;\n}",
    "export function invalidateTaskQuestPrivateLoad(_epoch: TaskQuestPrivateLoadEpoch): void {}",
  )],
  ["late response always current", sources.gate.replace("return epoch.current === sequence", "return true")],
]) {
  mutants += 1;
  const outcome = await simulateLatePrivateResponse(loadGateModule(mutantSource));
  assert(
    outcome.fetchCount !== 1 || outcome.data !== null || outcome.panelVisible !== false,
    `${name} mutant survived`,
  );
}

for (const [name, mutantSource] of [
  ["stale bootstrap survives invalidation", sources.admin.replace(
    "delete bootstrap.frontendSession;",
    "void bootstrap.frontendSession;",
  )],
  ["session invalidation event omitted", sources.admin.replace(
    "window.dispatchEvent(new Event(FRONTEND_SESSION_INVALIDATION_EVENT));",
    "",
  )],
]) {
  mutants += 1;
  assert.notDeepEqual(
    await twoSessionConsumerOutcome(mutantSource),
    twoConsumerResult,
    `${name} mutant survived`,
  );
}

const expectedStaleRequestOutcome = {
  fetchCountWhileCurrentPending: 2,
  currentAuthenticated: false,
  snapshotAuthenticated: false,
};
for (const [name, mutantSource] of [
  ["stale request repopulates cache", sources.admin.replace(
    "generation === frontendSessionGeneration",
    "true",
  )],
  ["stale request detaches current promise", sources.admin.replace(
    "frontendSessionPromise === request",
    "true",
  )],
]) {
  mutants += 1;
  assert.notDeepEqual(
    await staleSessionRequestOutcome(mutantSource),
    expectedStaleRequestOutcome,
    `${name} mutant survived`,
  );
}

console.log(`TASKQUEST_SESSION_GATE_PASS checks=${required.length + 14} mutants=${mutants} consumers=2 reloadFetch=1 eventLoop=0 delayedFetch=1 anonymousFetch=0 logoutFetch=0 logoutPanel=hidden lateResponse=discarded staleBootstrap=cleared routeProcess=MEMBER_LIFECYCLE dataPanel=visible`);
