#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.process || !args.output) usage();
  const source = JSON.parse(await readFile(args.input, "utf8"));
  const compiled = compileRelayDesign(source, args.process);
  await writeFile(args.output, `${JSON.stringify(compiled, null, 2)}\n`, "utf8");
  console.log(`PROCESS_ACCOUNT_RELAY_DESIGN status=${compiled.status} process=${compiled.processCode} steps=${compiled.summary.stepCount} accounts=${compiled.summary.accountCount} screens=${compiled.summary.screenCount} functions=${compiled.summary.functionCount} gaps=${compiled.summary.gapCount}`);
  if (args.requireReady && compiled.status !== "READY") process.exitCode = 2;
}

export function compileRelayDesign(source, requestedProcess) {
  exactObject(source, ["sourceMeta", "workTypes", "hierarchy", "flat"], "SOURCE_SCHEMA_INVALID");
  const matches = source.hierarchy.filter(entry => entry?.process?.code === requestedProcess);
  if (matches.length !== 1) throw new Error(matches.length ? "PROCESS_SOURCE_AMBIGUOUS" : "PROCESS_SOURCE_MISSING");
  const entry = matches[0];
  const process = entry.process;
  const steps = Array.isArray(process.steps) ? [...process.steps].sort((a, b) => Number(a.stepOrder) - Number(b.stepOrder)) : [];
  const gaps = [];
  if (!steps.length) gaps.push(gap("PROCESS_STEP_GAP", "프로세스 단계가 없습니다."));
  const seenOrders = new Set();
  const seenCodes = new Set();
  const compiledSteps = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const expectedOrder = index + 1;
    if (Number(step.stepOrder) !== expectedOrder || seenOrders.has(Number(step.stepOrder)))
      gaps.push(gap("STEP_ORDER_GAP", `${step.stepCode}: 단계 순서가 ${expectedOrder}이 아닙니다.`));
    if (!step.stepCode || seenCodes.has(step.stepCode)) gaps.push(gap("STEP_CODE_GAP", "단계 코드가 없거나 중복입니다."));
    seenOrders.add(Number(step.stepOrder)); seenCodes.add(step.stepCode);
    const actor = step.actor || null;
    const accounts = Array.isArray(step.accounts) ? step.accounts : [];
    const policies = Array.isArray(step.policies) ? step.policies : [];
    const screens = Array.isArray(step.screens) ? step.screens : [];
    if (!actor?.code) gaps.push(gap("ACTOR_GAP", `${step.stepCode}: 담당 액터가 없습니다.`));
    if (!accounts.length) gaps.push(gap("ACCOUNT_GAP", `${step.stepCode}/${step.actorCode}: 활성 계정이 없습니다.`));
    if (!policies.length) gaps.push(gap("AUTHORITY_GAP", `${step.stepCode}/${step.actorCode}: 권한 그룹이 없습니다.`));
    if (!screens.length) gaps.push(gap("SCREEN_GAP", `${step.stepCode}: 화면 계약이 없습니다.`));
    const compiledScreens = screens.map(screen => {
      const functions = Array.isArray(screen.features) ? screen.features.filter(item => item?.code && item.code !== "MISSING") : [];
      if (!functions.length) gaps.push(gap("FEATURE_GAP", `${step.stepCode}/${screen.routePath}: 기능 계약이 없습니다.`));
      if (screen.authorityVerified !== true) gaps.push(gap("AUTHORITY_UNVERIFIED", `${step.stepCode}/${screen.routePath}: 권한 실행 증거가 없습니다.`));
      if (screen.apiVerified !== true) gaps.push(gap("API_UNVERIFIED", `${step.stepCode}/${screen.routePath}: API 실행 증거가 없습니다.`));
      if (screen.databaseVerified !== true) gaps.push(gap("DATABASE_UNVERIFIED", `${step.stepCode}/${screen.routePath}: DB 재조회 증거가 없습니다.`));
      if (screen.exceptionVerified !== true) gaps.push(gap("EXCEPTION_UNVERIFIED", `${step.stepCode}/${screen.routePath}: 예외 상태 증거가 없습니다.`));
      return {
        routePath: screen.routePath,
        screenName: screen.screenName,
        audience: screen.audience,
        readinessScore: Number(screen.readinessScore || 0),
        functions: functions.map(item => ({ code: item.code, source: item.source, detail: item.detail || "" })),
        evidence: {
          authority: screen.authorityVerified === true,
          api: screen.apiVerified === true,
          database: screen.databaseVerified === true,
          exceptionStates: screen.exceptionVerified === true,
        },
      };
    });
    compiledSteps.push({
      stepOrder: Number(step.stepOrder), stepCode: step.stepCode, stepName: step.stepName,
      transition: { fromState: step.fromState, commandCode: step.commandCode, toState: step.toState },
      completionRule: step.completionRule,
      actor: actor ? { code: actor.code, name: actor.name, type: actor.type, responsibility: actor.responsibility, conflicts: actor.conflicts } : null,
      accounts: accounts.map(account => ({ accountId: account.accountId, tenantId: account.tenantId, projectId: account.projectId, dataScope: account.dataScope, status: account.status })),
      permissions: policies.map(policy => ({ groupName: policy.groupName, tenantId: policy.tenantId, projectScope: policy.projectScope, dataScope: policy.dataScope })),
      screens: compiledScreens,
    });
  }
  validateRelayStateGraph(requestedProcess, compiledSteps, gaps);
  validateSegregation(compiledSteps, gaps);
  const accountIds = new Set(compiledSteps.flatMap(step => step.accounts.map(account => account.accountId)));
  const routes = new Set(compiledSteps.flatMap(step => step.screens.map(screen => screen.routePath)));
  const functions = compiledSteps.flatMap(step => step.screens.flatMap(screen => screen.functions));
  const gapCounts = Object.fromEntries([...new Set(gaps.map(item => item.code))].sort().map(code => [code, gaps.filter(item => item.code === code).length]));
  const material = {
    schema: "carbonet.process-account-relay-design/v1",
    sourceGeneratedAt: source.sourceMeta.generatedAt,
    processCode: process.code,
    processName: process.name,
    workTypeCode: entry.workType.code,
    workTypeName: entry.workType.name,
    goal: process.goal,
    startCondition: process.startCondition,
    completionCondition: process.completionCondition,
    status: gaps.length ? "REVIEW_REQUIRED" : "READY",
    steps: compiledSteps,
    gaps,
    gapCounts,
    summary: {
      stepCount: compiledSteps.length,
      accountCount: accountIds.size,
      actorCount: new Set(compiledSteps.map(step => step.actor?.code).filter(Boolean)).size,
      screenCount: routes.size,
      functionCount: functions.length,
      gapCount: gaps.length,
    },
    requiredRelayScenarios: ["HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY"],
    closureRule: "READY requires every step to have active account, actor, exact permission group, screen, function and API/database/authority/exception evidence, plus a valid handoff graph.",
  };
  return { ...material, designHash: sha256(stable(material)) };
}

function validateRelayStateGraph(processCode, steps, gaps) {
  for (let index = 0; index < steps.length - 1; index += 1) {
    const current = steps[index], next = steps[index + 1];
    if (current.transition.toState !== next.transition.fromState) gaps.push(gap(
      "HANDOFF_STATE_GAP", `${current.stepCode}(${current.transition.toState}) → ${next.stepCode}(${next.transition.fromState}) 상태가 연결되지 않습니다.`));
  }
  if (processCode !== "EMISSION_PROJECT") return;
  const byCode = new Map(steps.map(step => [step.stepCode, step]));
  const validation = byCode.get("EMISSION_PROJECT_VALIDATE");
  const correction = byCode.get("EMISSION_PROJECT_CORRECT");
  const calculation = byCode.get("EMISSION_PROJECT_CALCULATE");
  const approval = byCode.get("EMISSION_PROJECT_APPROVE");
  if (!validation || !correction || !calculation || !approval) return;
  if (validation.transition.toState === "VERIFIED" && correction.transition.fromState === "CORRECTION_REQUIRED") gaps.push(gap(
    "DECISION_BRANCH_GAP", "검증 적합→승인과 부적합→보완 분기가 하나의 직선 단계로 표현되어 있습니다."));
  if (correction.transition.toState !== calculation.transition.fromState) gaps.push(gap(
    "RECALCULATION_LOOP_GAP", `보완 후 ${correction.transition.toState} 상태가 산정 시작상태 ${calculation.transition.fromState}로 재진입하지 않습니다.`));
  if (approval.transition.fromState !== "VERIFIED") gaps.push(gap("APPROVAL_ENTRY_GAP", "승인은 VERIFIED 상태에서만 진입해야 합니다."));
}

function validateSegregation(steps, gaps) {
  const byActor = new Map();
  for (const step of steps) {
    if (!step.actor?.code) continue;
    const ids = new Set(step.accounts.map(account => String(account.accountId).toLowerCase()));
    byActor.set(step.actor.code, ids);
  }
  for (const pair of [["CALCULATOR", "VERIFIER"], ["CALCULATOR", "APPROVER"], ["VERIFIER", "APPROVER"]]) {
    const [left, right] = pair, a = byActor.get(left) || new Set(), b = byActor.get(right) || new Set();
    const overlap = [...a].filter(id => b.has(id));
    if (overlap.length) gaps.push(gap("SEGREGATION_GAP", `${left}와 ${right} 계정이 ${overlap.length}건 중복됩니다.`));
  }
}

function gap(code, message) { return { code, severity: code.endsWith("UNVERIFIED") ? "EVIDENCE" : "DESIGN", message }; }
function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function exactObject(value, keys, code) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error(code); }
function parseArgs(values) { const out = {}; for (let i = 0; i < values.length; i += 1) { const key = values[i]; if (key === "--require-ready") out.requireReady = true; else if (key.startsWith("--")) out[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = values[++i]; } return out; }
function usage() { console.error("usage: compile-process-account-relay-design.mjs --input <hierarchy.json> --process <PROCESS_CODE> --output <compiled.json> [--require-ready]"); process.exit(2); }
