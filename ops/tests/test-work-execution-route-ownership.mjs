#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.RESONANCE_ROOT || path.join(testRoot, "../.."));
const appPath = path.join(root, "projects/carbonet-frontend/source/src/App.tsx");
const pipelinePath = path.join(root, "projects/carbonet-frontend/source/scripts/run-frontend-pipeline.mjs");
const sources = {
  app: readFileSync(appPath, "utf8"),
  pipeline: readFileSync(pipelinePath, "utf8"),
};

const narrowGuard = `const preserveRegisteredWorkExecutionPage =
    page === "work-execution" || location.pathname === "/work/execution";`;
const guardedSelection = `const CurrentPage = generatedRuntime && !preserveRegisteredWorkExecutionPage
    ? GeneratedScreenRuntime
    : RegisteredPage;`;
const required = [
  ["narrow page and route exemption", "app", narrowGuard],
  ["generated runtime remains the enabled-route choice", "app", guardedSelection],
  ["automatic frontend validation", "pipeline", "ops/tests/test-work-execution-route-ownership.mjs"],
];

function violations(candidateSources) {
  return required
    .filter(([, file, token]) => !candidateSources[file].includes(token))
    .map(([name]) => name);
}

function selectedRuntime({ generatedRuntime, page, pathname }) {
  const preserveRegisteredWorkExecutionPage =
    page === "work-execution" || pathname === "/work/execution";
  return generatedRuntime && !preserveRegisteredWorkExecutionPage ? "generated" : "registered";
}

assert.deepEqual(violations(sources), [], "work execution route ownership contract is incomplete");
assert.equal(selectedRuntime({ generatedRuntime: true, page: "work-execution", pathname: "/work/execution" }), "registered");
assert.equal(selectedRuntime({ generatedRuntime: true, page: "work-execution", pathname: "/alternate" }), "registered");
assert.equal(selectedRuntime({ generatedRuntime: true, page: "alternate", pathname: "/work/execution" }), "registered");
assert.equal(selectedRuntime({ generatedRuntime: true, page: "alternate", pathname: "/generated/route" }), "generated");
assert.equal(selectedRuntime({ generatedRuntime: false, page: "alternate", pathname: "/generated/route" }), "registered");

let mutants = 0;
for (const [name, expectedViolation, candidate] of [
  ["page exemption removed", "narrow page and route exemption", {
    ...sources,
    app: sources.app.replace('page === "work-execution"', "false"),
  }],
  ["route exemption removed", "narrow page and route exemption", {
    ...sources,
    app: sources.app.replace('location.pathname === "/work/execution"', "false"),
  }],
  ["all generated routes forced registered", "narrow page and route exemption", {
    ...sources,
    app: sources.app.replace(narrowGuard, "const preserveRegisteredWorkExecutionPage = generatedRuntime;"),
  }],
  ["work execution overridden by generated runtime", "generated runtime remains the enabled-route choice", {
    ...sources,
    app: sources.app.replace(guardedSelection, "const CurrentPage = generatedRuntime ? GeneratedScreenRuntime : RegisteredPage;"),
  }],
]) {
  mutants += 1;
  assert(violations(candidate).includes(expectedViolation), `${name} mutant survived`);
}

for (const [name, file, token] of required) {
  mutants += 1;
  const candidate = { ...sources, [file]: sources[file].replace(token, "__REMOVED_BY_MUTANT__") };
  assert(violations(candidate).includes(name), `${name} required-token mutant survived`);
}

console.log(`WORK_EXECUTION_ROUTE_OWNERSHIP_PASS checks=${required.length + 6} mutants=${mutants} workExecution=registered otherGeneratedRoutes=generated`);
