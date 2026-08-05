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
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}
if (failed.length) process.exit(1);
