#!/bin/sh
':' //; exec node "$0" "$@"
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const contract = JSON.parse(read("projects/carbonet-frontend/source/src/features/reduction-workflow/reductionWorkflow.contract.json"));
const page = read("projects/carbonet-frontend/source/src/features/reduction-workflow/ReductionWorkflowPage.tsx");
const routes = read("projects/carbonet-frontend/source/src/app/routes/families/emissionMonitoringFamily.ts");
const bootstrap = read("projects/carbonet-frontend/source/src/lib/api/appBootstrap.ts");
const assignmentPage = read("projects/carbonet-frontend/source/src/features/work-assignment/WorkAssignmentPage.tsx");
const globalShell = read("projects/carbonet-frontend/source/src/features/home-entry/GlobalUserGnbShell.tsx");
const catalog = JSON.parse(read("projects/carbonet-frontend/src/main/resources/static/react-app/runtime/catalog.json"));

assert.equal(contract.schemaVersion, 1);
assert.equal(contract.processCode, "REDUCTION_MANAGEMENT");
assert.equal(contract.steps.length, 17);
assert.equal(new Set(contract.steps.map(step => step.code)).size, 17);
assert.equal(new Set(contract.steps.map(step => step.path)).size, 17);
assert.deepEqual(contract.steps.map(step => step.order), Array.from({ length: 17 }, (_, index) => index + 1));
assert.deepEqual(contract.qaScenarios, ["HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY"]);
assert.equal(contract.shellPolicy.header, "GLOBAL_USER_GNB_LOCKED");
assert.equal(contract.shellPolicy.footer, "COMMON_USER_FOOTER_LOCKED");
assert.equal(Object.keys(contract.runtimeMappings).length, 17);

for (const step of contract.steps) {
  assert.ok(step.account && step.actor, `${step.code}: account/actor`);
  assert.ok(step.permissions.length >= 3, `${step.code}: permissions`);
  assert.ok(step.inputs.length && step.functions.length && step.outputs.length, `${step.code}: IO contract`);
  assert.ok(routes.includes(`koPath: "${step.path}"`), `${step.code}: ko route`);
  assert.ok(routes.includes(`enPath: "/en${step.path}"`), `${step.code}: en route`);
  assert.ok(bootstrap.includes(`"${step.name}": "${step.path}"`), `${step.code}: development menu route`);
  const mapping = contract.runtimeMappings[step.code];
  assert.equal(mapping.length, 3, `${step.code}: process, step, actor runtime mapping`);
  assert.match(mapping[0], /^REDUCTION_[A-Z_]+$/);
  assert.match(mapping[1], new RegExp(`^${mapping[0]}_(REQUEST|EXECUTE|REVIEW|COMPLETE)$`));
  assert.match(mapping[2], /^[A-Z_]+$/);
  assert.ok(catalog.screens.some(screen => screen.process_code === mapping[0] && screen.actor_code === mapping[2] && screen.apis?.some(api => api.method === "POST" && api.code === mapping[1])), `${step.code}: runtime catalog authority contract`);
}

for (const token of ["data-reduction-process", "data-reduction-step", "INPUT_FUNCTION_OUTPUT", "AUTHORITY_QA", "HANDOFF", "RUNTIME_EXECUTION", "data-runtime-workspace-link", "data-runtime-assignment-link", "/home/workspace", "/emission/work-assignment", "projectId"]) {
  assert.ok(page.includes(token), `page token ${token}`);
}
for (const actor of ["REDUCTION_MANAGER", "DATA_ANALYST", "VERIFIER", "APPROVER", "AUDITOR"]) assert.ok(assignmentPage.includes(actor), `assignment actor ${actor}`);
for (const forbidden of ["<header", "HeaderBrand", "HeaderDesktopNav", "HeaderMobileMenu", "<footer"]) assert.equal(assignmentPage.includes(forbidden), false, `assignment page must use global shell: ${forbidden}`);
assert.ok(globalShell.includes("data-global-user-gnb"));
assert.ok(globalShell.includes("<CommonUserFooter"));
assert.ok(globalShell.includes("[data-global-user-page] footer"));
assert.ok(globalShell.includes("payload.isLoggedIn || session.value?.authenticated"));
for (const forbidden of ["<header", "<footer", "gnb-depth2", "GlobalUserGnbShell", "CommonUserFooter"]) {
  assert.equal(page.includes(forbidden), false, `page must not own global shell: ${forbidden}`);
}

console.log(`REDUCTION_WORKFLOW_SCREEN_CONTRACT_PASS steps=${contract.steps.length} routes=${contract.steps.length * 2} menuLinks=${contract.steps.length} qa=${contract.qaScenarios.length} shellLocked=2`);
