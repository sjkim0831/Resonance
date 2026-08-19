import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "src/features/emission-common/adminMenuWorkspaceContracts.tsx");
const projectPath = path.join(root, "src/features/emission-project-list/AdminEmissionProjectOperationsPage.tsx");
const surveyPath = path.join(root, "src/features/emission-survey-admin/EmissionSurveyAdminMigrationPage.tsx");
const smokePath = path.join(root, "e2e/full-screen-smoke.spec.ts");
const contract = fs.readFileSync(contractPath, "utf8");
const project = fs.readFileSync(projectPath, "utf8");
const survey = fs.readFileSync(surveyPath, "utf8");
const smoke = fs.readFileSync(smokePath, "utf8");

const codes = [...contract.matchAll(/^\s+\["(A10[34][0-9]*)",\s*"[^"]+",\s*"([A-Z0-9_]+)"/gm)];
const menuCodes = codes.map((match) => match[1]);
const processCodes = codes.map((match) => match[2]);
assert.equal(menuCodes.length, 40, "carbon/LCA menu workspace count must remain 40");
assert.equal(new Set(menuCodes).size, 40, "menu codes must be unique");
assert.equal(new Set(processCodes).size, 40, "every menu must have a distinct process contract");
assert.equal(menuCodes.filter((code) => code.startsWith("A103")).length, 21, "carbon menu count drift");
assert.equal(menuCodes.filter((code) => code.startsWith("A104")).length, 19, "LCA menu count drift");

for (const token of ["data-menu-code", "data-process-code", "data-card-kind", "data-work-input", "data-work-output", "data-work-action", "functionRoutes", "workspaceAction"]) {
  assert.ok(contract.includes(token), `missing machine-readable UI contract: ${token}`);
}
for (const card of ["help", "design", "qa", "guide"]) assert.ok(contract.includes(`\"${card}\"`), `missing floating card: ${card}`);
for (const source of [project, survey]) {
  assert.ok(source.includes("currentAdminMenuCode("), "menuCode must select the rendered workspace");
  assert.ok(source.includes("AdminMenuWorkspaceContractPanel"), "screen must render its design/QA/work-guide contract");
}
assert.ok(survey.includes('workspace.surface === "SURVEY_DATA"'), "LCA specialized menus must not render the shared survey form");
assert.ok(survey.includes("AdminMenuSpecializedWorkspace"), "LCA specialized workspace missing");
assert.ok(!contract.includes("<input className=\"mt-2 w-full"), "workspace must not expose fake non-persistent inputs");
for (const route of ["/admin/emission/project-operations", "/admin/emission/validate", "/admin/emission/result_list", "/admin/emission/survey-report", "/admin/emission/survey-report-verify", "/admin/emission/evidence-management", "/admin/emission/data_history", "/admin/emission/lci-classification", "/admin/emission/ecoinvent", "/admin/emission/survey-admin-data"]) assert.ok(contract.includes(route), `missing real business route: ${route}`);
for (const menuCode of menuCodes) assert.ok(smoke.includes(`\"${menuCode}\"`), `authenticated browser relay is missing menu: ${menuCode}`);
for (const token of ["inspectAdminEmissionMenuModes", "adminEmissionMenuModeCount", "data-feature-index", "SURVEY_GRID", "allowedWorkspaceActionPaths"]) assert.ok(smoke.includes(token), `missing browser relay contract: ${token}`);
assert.ok(smoke.includes('"/admin/emission/report-template"'), "report-template relay route is not browser-verified");

console.log(`ADMIN_EMISSION_MENU_WORKSPACE_PASS menus=${menuCodes.length} carbon=21 lca=19 processes=${new Set(processCodes).size} cards=4 specializedSplit=1 realRoutes=11 fakeInputs=0 browserRelay=40`);
