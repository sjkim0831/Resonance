import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compileRelayDesign } from "../scripts/compile-process-account-relay-design.mjs";

const account = (id, actor) => ({ accountId:id, tenantId:"TENANT", projectId:"PROJECT", actorCode:actor, dataScope:"PROJECT", status:"ACTIVE" });
const actor = code => ({ code, name:code, type:"BUSINESS", responsibility:`${code} 책임`, conflicts:"" });
const screen = (processCode, stepCode, actorCode, routePath, featureCode) => ({
  processCode, stepCode, actorCode, routePath, screenName:stepCode, audience:"USER", readinessScore:100,
  authorityVerified:true, apiVerified:true, databaseVerified:true, exceptionVerified:true,
  features:[{ code:featureCode, source:"COMMAND_CONTRACT", detail:"" }],
});
const step = (order, code, actorCode, fromState, commandCode, toState) => ({
  stepOrder:order, stepCode:code, stepName:code, actorCode, fromState, commandCode, toState,
  completionRule:`${code} 완료`, actor:actor(actorCode), accounts:[account(`qa-${actorCode.toLowerCase()}`,actorCode)],
  policies:[{ groupName:`ROLE_${actorCode}`, tenantId:"TENANT", projectScope:"PROJECT", dataScope:"PROJECT" }],
  screens:[screen("EMISSION_PROJECT",code,actorCode,`/work/${code.toLowerCase()}`,commandCode)],
});
const readySteps = [
  step(1,"SETUP","COMPANY_MANAGER","DRAFT","CONFIRM_SCOPE","PLANNED"),
  step(2,"COLLECT","SITE_DATA_OWNER","PLANNED","SUBMIT","DATA_SUBMITTED"),
  step(3,"CALCULATE","CALCULATOR","DATA_SUBMITTED","CALCULATE","CALCULATED"),
  step(4,"VALIDATE","VERIFIER","CALCULATED","VALIDATE","VERIFIED"),
  step(5,"APPROVE","APPROVER","VERIFIED","APPROVE","APPROVED"),
  step(6,"REPORT","COMPANY_MANAGER","APPROVED","PUBLISH","COMPLETED"),
];
const source = steps => ({ sourceMeta:{ generatedAt:"2026-08-20T00:00:00Z" }, workTypes:[{code:"EMISSION"}], flat:[], hierarchy:[{ workType:{code:"EMISSION",name:"탄소배출 관리"}, process:{ code:"EMISSION_PROJECT",name:"탄소배출 프로젝트 수행",goal:"완료",startCondition:"신청",completionCondition:"발급",steps } }] });

const ready = compileRelayDesign(source(readySteps), "EMISSION_PROJECT");
assert.equal(ready.status, "READY");
assert.equal(6, ready.summary.stepCount);
assert.equal(5, ready.summary.accountCount);
assert.equal(0, ready.summary.gapCount);
assert.deepEqual(ready.requiredRelayScenarios, ["HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY"]);
assert.match(ready.designHash, /^[0-9a-f]{64}$/);

const currentLike = readySteps.toSpliced(4, 0, step(5,"EMISSION_PROJECT_CORRECT","SITE_DATA_OWNER","CORRECTION_REQUIRED","RESUBMIT","CALCULATED"));
currentLike[3] = step(4,"EMISSION_PROJECT_VALIDATE","VERIFIER","CALCULATED","VALIDATE","VERIFIED");
currentLike[2] = step(3,"EMISSION_PROJECT_CALCULATE","CALCULATOR","DATA_SUBMITTED","CALCULATE","CALCULATED");
currentLike[5] = step(6,"EMISSION_PROJECT_APPROVE","APPROVER","VERIFIED","APPROVE","APPROVED");
currentLike[6] = step(7,"EMISSION_PROJECT_REPORT","COMPANY_MANAGER","APPROVED","PUBLISH","COMPLETED");
const broken = compileRelayDesign(source(currentLike), "EMISSION_PROJECT");
assert.equal("REVIEW_REQUIRED", broken.status);
for (const code of ["HANDOFF_STATE_GAP","DECISION_BRANCH_GAP","RECALCULATION_LOOP_GAP"])
  assert.ok(broken.gaps.some(gap => gap.code === code), `missing ${code}`);

const missing = structuredClone(source(readySteps));
missing.hierarchy[0].process.steps[1].accounts = [];
missing.hierarchy[0].process.steps[2].policies = [];
missing.hierarchy[0].process.steps[3].screens[0].features = [];
missing.hierarchy[0].process.steps[4].screens[0].authorityVerified = false;
const incomplete = compileRelayDesign(missing, "EMISSION_PROJECT");
for (const code of ["ACCOUNT_GAP","AUTHORITY_GAP","FEATURE_GAP","AUTHORITY_UNVERIFIED"])
  assert.ok(incomplete.gaps.some(gap => gap.code === code), `missing ${code}`);

const collision = structuredClone(source(readySteps));
collision.hierarchy[0].process.steps[3].accounts[0].accountId = "qa-calculator";
assert.ok(compileRelayDesign(collision,"EMISSION_PROJECT").gaps.some(gap => gap.code === "SEGREGATION_GAP"));

const temporary = await mkdtemp(path.join(os.tmpdir(), "relay-design-compiler-"));
const input = path.join(temporary,"input.json"), output = path.join(temporary,"output.json");
await writeFile(input, JSON.stringify(source(currentLike)));
const cli = spawnSync(process.execPath,[path.resolve("ops/scripts/compile-process-account-relay-design.mjs"),"--input",input,"--process","EMISSION_PROJECT","--output",output,"--require-ready"],{encoding:"utf8"});
assert.equal(2, cli.status);
assert.match(cli.stdout,/status=REVIEW_REQUIRED/);
assert.equal("REVIEW_REQUIRED",JSON.parse(await readFile(output,"utf8")).status);
console.log("PROCESS_ACCOUNT_RELAY_DESIGN_COMPILER_PASS ready=1 mutants=4 secretValues=0");
