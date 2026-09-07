import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.resolve(root, "public/qa/process-preview-registry.json"), "utf8"));
const coverage = JSON.parse(fs.readFileSync(path.resolve(root, "public/qa/process-preview-coverage.json"), "utf8"));
const errors = [];
const codes = registry.entries.map((entry) => entry.processCode);
if (new Set(codes).size !== codes.length) errors.push("duplicate processCode");
if (registry.designedProcessCount !== coverage.designedProcessCount) errors.push("designed count mismatch");
if (registry.registeredProcessCount !== coverage.registeredProcessCount) errors.push("registered count mismatch");
if (registry.coveredDesignedProcessCount !== coverage.coveredDesignedProcessCount) errors.push("covered design count mismatch");
if (registry.unregisteredProcessCount !== registry.designedProcessCount - registry.coveredDesignedProcessCount) errors.push("coverage arithmetic mismatch");
for (const entry of registry.entries.filter((item) => item.status === "PASS")) {
  if (!entry.videoUrl) errors.push(`${entry.processCode}: videoUrl missing`);
  const relative = String(entry.videoUrl || "").split("?")[0].replace(/^\//, "");
  if (relative && !fs.existsSync(path.resolve(root, "public", relative))) errors.push(`${entry.processCode}: video asset missing`);
  if (!entry.sha256 || !/^[a-f0-9]{64}$/i.test(entry.sha256)) errors.push(`${entry.processCode}: invalid sha256`);
}
if (errors.length) {
  console.error(JSON.stringify({ status: "FAIL", errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: "PASS", designed: registry.designedProcessCount, recordings: registry.registeredProcessCount, coveredDesigned: registry.coveredDesignedProcessCount, unregistered: registry.unregisteredProcessCount, orphanedRecordings: registry.orphanedRecordingCount, duplicateProcessCodes: 0 }));
