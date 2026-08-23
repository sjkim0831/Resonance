#!/usr/bin/env -S node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (value) => fs.readFileSync(path.join(root, value), "utf8");
const ui = read("projects/carbonet-frontend/source/src/features/emission-simulate/EmissionSimulateMigrationPage.tsx");
const manifest = read("projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts");
const help = read("projects/carbonet-frontend/source/src/platform/screen-registry/helpContent.ts");
const process = read("apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260719130000__enforce_semantic_menu_route_bindings.sql");
const failures = [];
const requireToken = (source, token, label) => { if (!source.includes(token)) failures.push(`${label}:${token}`); };

for (const token of [
  "latestCalculation", "savedScenarios", "latestReductionRate", "inputHash.slice(0, 12)",
  'data-help-id="emission-simulate-context"', 'data-help-id="emission-simulate-history"',
  "프로젝트 선택 필요", "시뮬레이션 전에 산정을 완료해야 합니다.", "저장 시나리오 증거"
]) requireToken(ui, token, "UI");
for (const forbidden of ["₩2.4B", "94.8/100", "0.42 tCO2/₩M", "약 1.5억원", "약 2년 단축"]) {
  if (ui.includes(forbidden)) failures.push(`FAKE_METRIC:${forbidden}`);
}
requireToken(manifest, 'componentId: "EmissionSimulateHistory"', "MANIFEST");
requireToken(help, 'anchorSelector: \'[data-help-id="emission-simulate-history"]\'', "HELP");
for (const token of [
  "REDUCTION_EXECUTION_01_PLAN", "REDUCTION_EXECUTION_02_WORK",
  "REDUCTION_EXECUTION_03_VERIFY", "REDUCTION_EXECUTION_04_APPROVE",
  "'/emission/simulate'", "'REDUCTION_MANAGER'"
]) requireToken(process, token, "PROCESS");

if (failures.length) {
  console.error(`[reduction-execution-screen] FAIL count=${failures.length}`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("[reduction-execution-screen] PASS steps=4 actors=governed fakeMetrics=0 ledgerReadback=1 history=1 help=1");
