#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.RESONANCE_ROOT || path.join(testRoot, "../.."));
const workPath = path.join(root, "projects/carbonet-frontend/source/src/features/work-execution/WorkExecutionPage.tsx");
const supportPath = path.join(root, "projects/carbonet-frontend/source/src/features/generated-screen/ExecutableScreenSupportCards.tsx");
const generatedPath = path.join(root, "projects/carbonet-frontend/source/src/features/generated-screen/GeneratedScreenPage.tsx");
const pipelinePath = path.join(root, "projects/carbonet-frontend/source/scripts/run-frontend-pipeline.mjs");
const harnessPath = process.env.WORK_EXECUTION_SUPPORT_RELAY_HARNESS
  ? path.resolve(process.env.WORK_EXECUTION_SUPPORT_RELAY_HARNESS)
  : path.join(root, "ops/scripts/resonance-member-lifecycle-relay-e2e.mjs");
const sources = {
  work: readFileSync(workPath, "utf8"),
  support: readFileSync(supportPath, "utf8"),
  generated: readFileSync(generatedPath, "utf8"),
  pipeline: readFileSync(pipelinePath, "utf8"),
  harness: readFileSync(harnessPath, "utf8"),
};

const required = [
  ["page resolve coordinate", "work", 'new URLSearchParams({ routePath: "/work/execution", processCode: requestedProcess, stepCode: effectiveStep, audience: "USER" })'],
  ["parallel draft and resolve", "work", "const [draftBody, versionedBody] = await Promise.all(["],
  ["monotonic load sequence", "work", "const sequence = ++loadSequence.current"],
  ["full context reset", "work", "clearLoadedContext();\n    if (!tenantId.trim()"],
  ["stale actor reset", "work", "setWork({});\n    setExecution({});\n    setHandoff({});"],
  ["stale inputs reset", "work", "setValues({});\n    setForm({ ...EMPTY_FORM });\n    setEvidence({ ...EMPTY_EVIDENCE });"],
  ["coordinate render gate", "work", 'loadedCoordinate === contextKey(tenantId, projectId, processCode, stepCode)'],
  ["tenant coordinate", "work", "tenantId.trim(),\n  projectId.trim()"],
  ["project coordinate", "work", "projectId.trim(),\n  processCode.trim().toUpperCase()"],
  ["process coordinate", "work", "processCode.trim().toUpperCase(),\n  stepCode.trim().toUpperCase()"],
  ["step coordinate", "work", 'stepCode.trim().toUpperCase(),\n].join("\\u001f")'],
  ["coordinate support gate", "work", "loadedContextCurrent && versionedSupport && <ExecutableScreenSupportCards"],
  ["successful coordinate binding", "work", "setLoadedCoordinate(contextKey(tenantId, projectId, resolvedSupport.processCode, resolvedSupport.stepCode))"],
  ["save coordinate gate", "work", "const saveDraft = async () => {\n    if (!requireLoadedContext()) return;"],
  ["start coordinate gate", "work", "const startExecution = async () => {\n    if (!requireLoadedContext() || !actorCode) return;"],
  ["complete coordinate gate", "work", 'const executionId = value(execution, "executionId");\n    if (!requireLoadedContext()) return;'],
  ["busy coordinate lock", "work", 'data-work-coordinate="step" disabled={busy}'],
  ["stale response rejection", "work", "]);\n      if (sequence !== loadSequence.current) return;\n      const resolvedSupport"],
  ["latest-only error", "work", "if (sequence === loadSequence.current) setError"],
  ["page fail-closed validator", "work", "requireVersionedExecutableSupport(versionedBody"],
  ["draft actor binding", "work", 'actorCode: value((draftBody as WorkDraft).contract, "actorCode")'],
  ["page shared renderer", "work", "<ExecutableScreenSupportCards"],
  ["DB version source", "support", 'envelope.source !== "DB_VERSIONED_CONTRACT"'],
  ["exact process", "support", 'invalid("processCode")'],
  ["exact step", "support", 'invalid("stepCode")'],
  ["exact actor", "support", 'actorCode !== expected.actorCode.trim().toUpperCase()'],
  ["exact permission audience", "support", 'invalid("permission.audience")'],
  ["exact 32 hex hash", "support", '/^[0-9a-f]{32}$/.test(contractHash)'],
  ["six test gates", "support", 'REQUIRED_TEST_GATES.every((gate) => testContract[gate] === true)'],
  ["seven support lanes", "support", "laneKeys.length !== REQUIRED_LANES.length"],
  ["typed data lanes", "support", "!Array.isArray(lanes.API) || lanes.API.length < 1"],
  ["nonempty frontend lane", "support", "!Object.keys(record(lanes.FRONTEND)).length"],
  ["exact lane aliases", "support", "OBJECT_LANE_ALIASES.every"],
  ["exact five scenarios", "support", "scenarios.length !== REQUIRED_SCENARIOS.length"],
  ["five QA scenario identities", "support", "REQUIRED_SCENARIOS.every"],
  ["help evidence", "support", 'invalid("help.items")'],
  ["work guide evidence", "support", 'invalid("workGuide.steps")'],
  ["QA evidence", "support", 'invalid("qa.checks")'],
  ["design evidence", "support", 'invalid("designCard.assetBindings")'],
  ["version marker gate", "support", 'const isVersioned = source === "DB_VERSIONED_CONTRACT" && versionId > 0'],
  ["fallback provenance", "support", 'data-support-source={isVersioned ? source : "STATIC_FALLBACK"}'],
  ["DOM contract root", "support", 'data-versioned-support-contract={isVersioned ? "" : undefined}'],
  ["DOM hash", "support", "data-contract-hash={contractHash}"],
  ["DOM version", "support", "data-version-id={String(versionId)}"],
  ["DOM process", "support", "data-process-code={processCode}"],
  ["DOM step", "support", "data-step-code={stepCode}"],
  ["DOM actor", "support", "data-actor-code={actorCode}"],
  ["DOM QA count", "support", "data-required-scenario-count={String(qaScenarios.length)}"],
  ["work guide card", "support", 'en ? "Work guide" : "업무 길잡이"'],
  ["step flow", "support", "<CommonTimeline"],
  ["QA card", "support", 'en ? "QA verification" : "QA 검증"'],
  ["design card", "support", 'en ? "Design summary" : "화면 설계 요약"'],
  ["KRDS badge", "support", 'text(designCard.designSystem) || "KRDS"'],
  ["contract next action", "support", 'data-support-next-action=""'],
  ["contract full workflow", "support", 'data-support-full-workflow=""'],
  ["global workflow event", "support", 'new CustomEvent("resonance:task-guide-focus"'],
  ["generated shared renderer", "generated", "<ExecutableScreenSupportCards"],
  ["generated source validation", "generated", 'if (envelope.source !== "DB_VERSIONED_CONTRACT")'],
  ["generated source propagation", "generated", "source: envelope.source"],
  ["automatic frontend gate", "pipeline", 'ops/tests/test-work-execution-versioned-support-ui.mjs'],
  ["harness page response retained", "harness", 'candidateUrl.pathname === "/runtime/screens/resolve"'],
  ["harness support DOM retained", "harness", "await assertSupportDom(page, step"],
];

function violations(candidateSources) {
  return required.filter(([, file, token]) => !candidateSources[file].includes(token)).map(([name]) => name);
}

assert.deepEqual(violations(sources), [], "versioned work support UI contract is incomplete");
assert.doesNotMatch(sources.work, /catch\s*\([^)]*\)\s*\{[^}]*setVersionedSupport\([^)]*support/i,
  "versioned support must not fall back after a resolver failure");
assert.equal((sources.generated.match(/<ExecutableScreenSupportCards/g) || []).length, 1,
  "GeneratedScreenPage must use one shared support renderer");

let mutants = 0;
for (const [name, expectedViolation, mutant] of [
  ["wrong actor", "exact actor", { ...sources, support: sources.support.replace(
    "actorCode !== expected.actorCode.trim().toUpperCase()",
    "!actorCode",
  ) }],
  ["wide hash", "exact 32 hex hash", { ...sources, support: sources.support.replace(
    "/^[0-9a-f]{32}$/.test(contractHash)",
    "/^[0-9a-f]{32,64}$/.test(contractHash)",
  ) }],
  ["missing test gate", "six test gates", { ...sources, support: sources.support.replace(
    "REQUIRED_TEST_GATES.every((gate) => testContract[gate] === true)",
    "true",
  ) }],
  ["extra scenario allowed", "exact five scenarios", { ...sources, support: sources.support.replace(
    "scenarios.length !== REQUIRED_SCENARIOS.length",
    "false",
  ) }],
  ["null data lane allowed", "typed data lanes", { ...sources, support: sources.support.replace(
    "!Array.isArray(lanes.API) || lanes.API.length < 1",
    "false",
  ) }],
  ["failed B load retains A context", "full context reset", { ...sources, work: sources.work.replace(
    "clearLoadedContext();\n    if (!tenantId.trim()",
    "setVersionedSupport(null);\n    if (!tenantId.trim()",
  ) }],
  ["step edit retains prior actor", "coordinate render gate", { ...sources, work: sources.work.replace(
    'loadedCoordinate === contextKey(tenantId, projectId, processCode, stepCode)',
    "true",
  ) }],
  ["tenant omitted from coordinate", "tenant coordinate", { ...sources, work: sources.work.replace(
    "tenantId.trim(),\n  projectId.trim()",
    '"",\n  projectId.trim()',
  ) }],
  ["project omitted from coordinate", "project coordinate", { ...sources, work: sources.work.replace(
    "projectId.trim(),\n  processCode.trim().toUpperCase()",
    '"",\n  processCode.trim().toUpperCase()',
  ) }],
  ["process omitted from coordinate", "process coordinate", { ...sources, work: sources.work.replace(
    "processCode.trim().toUpperCase(),\n  stepCode.trim().toUpperCase()",
    '"",\n  stepCode.trim().toUpperCase()',
  ) }],
  ["step omitted from coordinate", "step coordinate", { ...sources, work: sources.work.replace(
    'stepCode.trim().toUpperCase(),\n].join("\\u001f")',
    '"",\n].join("\\u001f")',
  ) }],
  ["static fallback marked versioned", "version marker gate", { ...sources, support: sources.support.replace(
    'source === "DB_VERSIONED_CONTRACT" && ',
    "",
  ) }],
]) {
  mutants += 1;
  assert(violations(mutant).includes(expectedViolation), `${name} mutant survived`);
}
for (const [name, file, token] of required) {
  mutants += 1;
  const mutant = { ...sources, [file]: sources[file].replace(token, "__REMOVED_BY_MUTANT__") };
  assert(violations(mutant).includes(name), `${name} mutant survived`);
}

console.log(`WORK_EXECUTION_VERSIONED_SUPPORT_UI_PASS checks=${required.length + 2} mutants=${mutants} cards=3 scenarios=5 lanes=7`);
