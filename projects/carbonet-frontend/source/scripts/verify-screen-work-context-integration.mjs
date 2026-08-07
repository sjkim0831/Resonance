import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
const occurrences = (source, token) => source.split(token).length - 1;

const app = read("src/App.tsx");
const shell = read("src/features/home-entry/GlobalUserGnbShell.tsx");
const task = read("src/features/task-quest/TaskQuestPanel.tsx");
const design = read("src/features/screen-development-note/ScreenDevelopmentNotePanel.tsx");
const help = read("src/components/help/HelpOverlay.tsx");
const workspace = read("src/features/process-step-workspace/ProcessStepWorkspacePage.tsx");
const context = read("src/features/runtime-assist/screenWorkContext.ts");
const professionalCanvas = read("src/features/actor-process-governance/ProfessionalDesignCanvas.tsx");

expect(
  occurrences(app, "<TaskQuestPanel") === 1,
  "App must mount exactly one TaskQuestPanel.",
);
expect(
  !shell.includes("TaskQuestPanel"),
  "GlobalUserGnbShell must not mount a duplicate TaskQuestPanel.",
);
expect(
  app.includes("/home/api/screen-context?"),
  "App must resolve the shared server screen context.",
);
expect(
  app.includes("workContext={screenWorkContext}") &&
    app.includes("screenContext={screenWorkContext}"),
  "Help, screen design, guide and QA must share one screenWorkContext.",
);
expect(
  task.includes('query.get("processCode") || query.get("process")') &&
    task.includes('query.get("stepCode") || query.get("step")'),
  "Guide and QA must support canonical and legacy route keys.",
);
expect(
  task.includes("normalizeScreenRoute(String(path))") &&
    task.includes("[qaOpen, qaScreenExecutionAllowed, routePath]") &&
    !task.includes("onWorkContextResolved") &&
    task.includes("synchronizedScreenRouteRef") &&
    task.includes("onScreenContextSelection(candidate)") &&
    task.includes('data-qa-screen-context=""') &&
    app.includes("selectAmbiguousScreenWorkflow") &&
    app.includes("current?.selectionRequired") &&
    app.includes("item.audience || \"\"") &&
    app.includes("onScreenContextSelection={selectAmbiguousScreenWorkflow}"),
  "Guide and QA must react to SPA route changes and share only a server-candidate ambiguous selection.",
);
expect(
  design.includes('data-screen-work-context=""') &&
    design.includes("업무 계약은 액터·프로세스 원장에서 읽기 전용으로 연동") &&
    design.includes("identity?.canonicalRoutePath") &&
    design.includes("routePath:designRoutePath"),
  "Screen design must display the linked read-only workflow contract and save by canonical screen route.",
);
expect(
  help.includes('data-help-work-context=""') &&
    help.includes("workContext.workflow.inputContract") &&
    help.includes("processCode: workContext?.workflow?.processCode") &&
    help.includes("stepCode: workContext?.workflow?.stepCode"),
  "Help must display and trace the linked workflow input and completion guidance.",
);
expect(
  app.includes("linked: Boolean(body.workflow)") &&
    app.includes("candidateCount: candidates.length") &&
    app.includes('source: "unlinked"') &&
    /query\.set\(\s*"audience"/.test(app) &&
    app.includes("isPublicWorkflowRoute(location.pathname)") &&
    app.includes('? "PUBLIC"') &&
    app.includes(': "USER"') &&
    app.includes("classification,") &&
    app.includes("reasonCode:") &&
    app.includes("reasonText:") &&
    !app.includes('["tenantId", "projectId", "processCode", "stepCode", "actorCode", "capabilityCode"'),
  "App must quarantine stale context, derive route audience and normalize the server result before sharing it with four cards.",
);
expect(
  context.includes("ScreenWorkflowClassification") &&
    context.includes('"EXECUTABLE"') &&
    context.includes('"INFORMATIONAL"') &&
    context.includes('"EXCLUDED"') &&
    context.includes('"REVIEW_REQUIRED"') &&
    context.includes("isPublicWorkflowRoute") &&
    !context.includes('"/join/",'),
  "Shared screen context must expose the four classifications and keep public join routes eligible for guidance.",
);
expect(
  task.includes("screenWorkflowMatchesTask") &&
    task.includes("taskExecutionBlocked") &&
    task.includes("qaScreenExecutionAllowed") &&
    task.includes('data-screen-task-mismatch=""') &&
    task.includes('data-public-workflow-guidance=""') &&
    task.includes("공개 회원가입 절차 안내입니다") &&
    task.includes("!qaScreenExecutionAllowed || !selectedCatalogSteps.length"),
  "Guide and QA must block mismatched execution while preserving non-mutating public registration guidance.",
);
expect(
  context.includes("accessRestricted?: boolean") &&
    context.includes("reviewStatus?: string") &&
    app.includes("accessRestricted: Boolean(body.accessRestricted)") &&
    app.includes("reviewStatus: body.reviewStatus") &&
    occurrences(task, "data-screen-access-restricted") >= 2 &&
    task.includes("!screenContext?.accessRestricted") &&
    task.includes("Boolean(screenContext?.accessRestricted)") &&
    help.includes('data-screen-access-restricted="true"') &&
    design.includes('data-screen-access-restricted="true"'),
  "All four cards must distinguish access-restricted executable screens from design gaps and block QA/task mutations.",
);
expect(
  design.includes('data-screen-classification={workClassification}') &&
    design.includes('routePath=${encodeURIComponent(designRoutePath)}') &&
    help.includes('data-screen-classification={workClassification}') &&
    help.includes('routePath=${encodeURIComponent(workContext.routePath)}') &&
    design.includes('workClassification==="INFORMATIONAL"') &&
    help.includes('workClassification === "INFORMATIONAL"'),
  "Help and screen design must explain classification states and route review-required screens to actor-process design.",
);
expect(
  professionalCanvas.includes('new URLSearchParams(window.location.search).get("routePath")') &&
    professionalCanvas.includes("normalizeScreenRoute(raw)") &&
    professionalCanvas.includes('normalizeScreenRoute(value(node.row, "routePath")) === requestedRoutePath') &&
    professionalCanvas.includes("setQuery(requestedRoutePath)") &&
    professionalCanvas.includes("initialRouteFocusHandled.current = true") &&
    professionalCanvas.includes("centerNode(target)"),
  "Professional design canvas must canonicalize, locate, select and center the routePath review target while preserving the query on misses.",
);
expect(
  workspace.includes('query.get("processCode") || query.get("process")') &&
    workspace.includes('query.get("stepCode") || query.get("step")') &&
    workspace.includes("replaceNavigation(") &&
    !workspace.includes("history.replaceState"),
  "Process workspace must accept aliases and notify the SPA when workflow selectors change.",
);
expect(
  context.includes('/^\\/en$/i.test') && context.includes('localizedPath === "/"'),
  "Frontend route canonicalization must normalize /en and trailing slashes like the backend.",
);
for (const prefix of ["/login/", "/admin/login/", "/signin/", "/find/", "/password/", "/error/"]) {
  expect(context.includes(`"${prefix}"`), `Assist exclusion is missing: ${prefix}`);
}

if (failures.length) {
  console.error("[screen-work-context] FAIL");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("[screen-work-context] PASS");
console.log("mounts=1 context=shared classifications=4 aliases=2 admin=true qaSpa=true qaMismatch=blocked canonicalDesign=true helpTrace=true stale=quarantined publicJoin=guided");
