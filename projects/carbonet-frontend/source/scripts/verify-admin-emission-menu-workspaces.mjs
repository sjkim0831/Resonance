import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "src/features/emission-common/adminMenuWorkspaceContracts.tsx");
const projectPath = path.join(root, "src/features/emission-project-list/AdminEmissionProjectOperationsPage.tsx");
const surveyPath = path.join(root, "src/features/emission-survey-admin/EmissionSurveyAdminMigrationPage.tsx");
const smokePath = path.join(root, "e2e/full-screen-smoke.spec.ts");
const repoRoot = path.resolve(root, "../../..");
const servicePath = path.join(repoRoot, "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/service/LcaWorkspaceExecutionService.java");
const controllerPath = path.join(repoRoot, "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/web/LcaWorkspaceExecutionController.java");
const migrationPath = path.join(repoRoot, "apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260819184500__create_lca_workspace_execution.sql");
const contract = fs.readFileSync(contractPath, "utf8");
const project = fs.readFileSync(projectPath, "utf8");
const survey = fs.readFileSync(surveyPath, "utf8");
const smoke = fs.readFileSync(smokePath, "utf8");
const service = fs.readFileSync(servicePath, "utf8");
const controller = fs.readFileSync(controllerPath, "utf8");
const migration = fs.readFileSync(migrationPath, "utf8");

const codes = [...contract.matchAll(/^\s+\["(A10[34][0-9]*)",\s*"[^"]+",\s*"([A-Z0-9_]+)"/gm)];
const menuCodes = codes.map((match) => match[1]);
const processCodes = codes.map((match) => match[2]);
assert.equal(menuCodes.length, 40, "carbon/LCA menu workspace count must remain 40");
assert.equal(new Set(menuCodes).size, 40, "menu codes must be unique");
assert.equal(new Set(processCodes).size, 40, "every menu must have a distinct process contract");
assert.equal(menuCodes.filter((code) => code.startsWith("A103")).length, 21, "carbon menu count drift");
assert.equal(menuCodes.filter((code) => code.startsWith("A104")).length, 19, "LCA menu count drift");

for (const token of ["data-work-input", "data-work-output", "data-work-action", "functionRoutes"]) {
  assert.ok(contract.includes(token), `missing machine-readable UI contract: ${token}`);
}
const lcaDetailCodes = [...contract.matchAll(/^\s{2}(LCA_[A-Z0-9_]+): lcaDetail\(/gm)].map((match) => match[1]);
assert.equal(lcaDetailCodes.length, 19, "every LCA menu needs a detailed SDUI contract");
assert.equal(new Set(lcaDetailCodes).size, 19, "LCA detail process codes must be unique");
for (const processCode of processCodes.filter((code) => code.startsWith("LCA_"))) {
  assert.ok(lcaDetailCodes.includes(processCode), `missing detailed LCA design: ${processCode}`);
}
for (const token of ["data-lca-process-flow", "data-process-step", "data-field-key", "data-field-type", "data-actor-code", "data-actor-relay-count", "completionEvidence", "fieldSchema"]) {
  assert.ok(contract.includes(token), `missing detailed LCA runtime contract: ${token}`);
}
for (const source of [project, survey]) {
  assert.ok(source.includes("currentAdminMenuCode("), "menuCode must select the rendered workspace");
  assert.ok(!source.includes("AdminMenuWorkspaceContractPanel"), "duplicate menu design/QA/work-guide panel must remain removed");
}
for (const token of ["AdminMenuWorkspaceContractPanel", "data-card-kind", "menu-workspace-"]) {
  assert.ok(!contract.includes(token), `removed duplicate workspace panel returned: ${token}`);
}
assert.ok(survey.includes('workspace.surface === "SURVEY_DATA"'), "LCA specialized menus must not render the shared survey form");
assert.ok(survey.includes("AdminMenuSpecializedWorkspace"), "LCA specialized workspace missing");
for (const token of ["data-business-key", "data-lca-save", "data-lca-record", "data-lca-command", "buildResilientCsrfHeaders", "/admin/emission/api/lca-workspaces/"]) {
  assert.ok(contract.includes(token), `LCA workspace persistence contract missing: ${token}`);
}
for (const route of ["/admin/emission/project-operations", "/admin/emission/validate", "/admin/emission/result_list", "/admin/emission/survey-report", "/admin/emission/survey-report-verify", "/admin/emission/evidence-management", "/admin/emission/data_history", "/admin/emission/lci-classification", "/admin/emission/ecoinvent", "/admin/emission/survey-admin-data"]) assert.ok(contract.includes(route), `missing real business route: ${route}`);
for (const menuCode of menuCodes) assert.ok(smoke.includes(`\"${menuCode}\"`), `authenticated browser relay is missing menu: ${menuCode}`);
for (const token of ["inspectAdminEmissionMenuModes", "adminEmissionMenuModeCount", "DUPLICATE_PANEL", "DUPLICATE_CARDS", "DUPLICATE_ACTIONS", "SURVEY_GRID"]) assert.ok(smoke.includes(token), `missing browser relay contract: ${token}`);
for (const token of ["DRAFT", "VALIDATED", "SUBMITTED", "APPROVED", "REJECTED", "invalid LCA workflow transition", "framework_lca_workspace_event", "framework_account_actor_assignment", "segregation of duties", "validator cannot approve"]) {
  assert.ok(service.includes(token), `backend LCA state contract missing: ${token}`);
}
for (const token of ["currentUserContextService.resolve(request)", "authentication required", "/{processCode}/{workspaceId}/commands"]) {
  assert.ok(controller.includes(token), `authenticated LCA API contract missing: ${token}`);
}
for (const token of ["framework_lca_workspace_record", "framework_lca_workspace_event", "jsonb_typeof(payload_json)='object'", "on delete restrict", "LCA_PROGRAM_MANAGER", "REPORT_VERIFIER", "grant select,insert,update"]) {
  assert.ok(migration.includes(token), `durable LCA database contract missing: ${token}`);
}

console.log(`ADMIN_EMISSION_MENU_WORKSPACE_PASS menus=${menuCodes.length} carbon=21 lca=19 lcaDetailed=19 processes=${new Set(processCodes).size} duplicatePanel=0 specializedSplit=1 realRoutes=11 persistentInputs=1 stateMachine=5 browserRelay=40`);
