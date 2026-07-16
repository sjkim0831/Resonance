import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const checks = [
  {
    file: "src/features/home-entry/HomeEntrySections.tsx",
    forbidden: [/href=\{top\.url \|\| "#"\}/, /href=\{item\.url \|\| "#"\}/],
    required: [/isNavigableMenuUrl/, /UnavailableMenuLabel/],
    message: "Customer GNB must not expose an unavailable menu as a dead link.",
  },
  {
    file: "src/features/emission-project-list/EmissionMyTasksPage.tsx",
    forbidden: [],
    required: [/function taskHref/, /isSafeTaskTarget/, /업무 화면 열기/],
    message: "Every actionable task must resolve to a guarded business workspace.",
  },
  {
    file: "src/framework/registry/routeFamilyAggregates.ts",
    forbidden: [],
    required: [/closeout\.pageContracts\.length === 0 && closeout\.familyId !== "generated-screens"/],
    message: "An empty generated-screen family must be treated as idle, not broken.",
  },
  {
    file: "src/generated/screen-generation/generatedScreenFamily.ts",
    forbidden: [],
    required: [
      /CLOSED: page systemization is complete for generated-screens/,
      /CLOSED: authority scope is consistently applied for generated-screens/,
      /CLOSED: builder install and deploy closeout is complete for generated-screens/,
      /CLOSED: project binding is explicit for generated-screens/,
    ],
    message: "Generated pages require valid build, authority, and traceability closeouts.",
  },
  {
    file: "src/features/actor-process-governance/ActorProcessGovernancePage.tsx",
    forbidden: [],
    required: [/actorProcessMenus/, /actorProcessMenuSummary/, /액터·프로세스 메뉴/],
    message: "Every navigable menu must expose its process step and responsible actor binding.",
  },
];

const failures = [];
for (const check of checks) {
  const source = await readFile(resolve(check.file), "utf8");
  for (const pattern of check.forbidden) {
    if (pattern.test(source)) failures.push(`${check.file}: forbidden pattern ${pattern}`);
  }
  for (const pattern of check.required) {
    if (!pattern.test(source)) failures.push(`${check.file}: missing contract ${pattern}`);
  }
}

if (failures.length) {
  console.error("[customer-journey-governance] FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`[customer-journey-governance] PASS (${checks.length} contracts)`);
