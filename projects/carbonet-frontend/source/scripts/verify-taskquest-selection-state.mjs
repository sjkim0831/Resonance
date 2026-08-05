import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  resolve(here, "../src/features/task-quest/TaskQuestPanel.tsx"),
  "utf8",
);

const checks = [
  ["one-shot emission index initialization", source.includes("emissionIndexGuideInitializedRef.current")],
  ["preserve persisted process selection", source.includes("persistedProcessCode && availableProcessCodes.has(persistedProcessCode)")],
  ["close overview before guide navigation", /setFlowOpen\(false\);\s*navigate\(guideTarget/.test(source)],
  ["close overview before assignment navigation", /setFlowOpen\(false\);\s*window\.location\.href/.test(source)],
  ["route process does not depend on current selection", !source.includes("[data?.processCatalog, selectedCatalogProcessCode, selectedWorkType]")],
  ["route step does not depend on current step", !source.includes("[selectedCatalogStep, selectedCatalogSteps]")],
  ["single emission end-to-end journey", source.includes("EMISSION_END_TO_END_CHILDREN") && source.includes("emissionEndToEndSteps")],
  ["step-specific page mode", source.includes('target.searchParams.set("mode",guidanceContract.viewMode)')],
  ["required and conditional guidance", source.includes("stepApplicabilityContracts") && source.includes("필수") && source.includes("조건부")],
  ["project-specific applicability decisions", source.includes("stepApplicabilityDecisions") && source.includes("effectiveProjectId")],
  ["conditional decision persistence", source.includes("saveStepApplicabilityDecision") && source.includes('method: "PUT"')],
  ["pending conditional step gate", source.includes('applicabilityType === "CONDITIONAL"') && source.includes('applicability !== "APPLICABLE"')],
  ["legitimate conditional skip", source.includes('applicability === "NOT_APPLICABLE"') && source.includes("nextIndex")],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}
if (failed.length) process.exit(1);
