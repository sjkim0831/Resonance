import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runtimeDir = path.resolve(root, "../../carbonet-backend-metadata/process-runtime/generated");
const registryPath = path.resolve(root, "public/qa/process-preview-registry.json");
const coveragePath = path.resolve(root, "public/qa/process-preview-coverage.json");
const fingerprintPath = path.resolve(root, "public/qa/process-design-fingerprints.json");

if (!fs.existsSync(runtimeDir)) throw new Error(`Process runtime directory not found: ${runtimeDir}`);

const existing = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath, "utf8"))
  : { entries: [] };
const registered = new Map(
  (existing.entries || []).filter((entry) => entry.status === "PASS").map((entry) => [entry.processCode, entry]),
);
const fingerprintDocument = fs.existsSync(fingerprintPath)
  ? JSON.parse(fs.readFileSync(fingerprintPath, "utf8"))
  : { entries: {} };
const fingerprints = new Map(Object.entries(fingerprintDocument.entries || {}));
const designs = new Map();

for (const fileName of fs.readdirSync(runtimeDir).filter((name) => name.endsWith(".json")).sort()) {
  const document = JSON.parse(fs.readFileSync(path.join(runtimeDir, fileName), "utf8"));
  const processCode = document?.process?.code;
  if (!processCode) continue;
  const current = designs.get(processCode) || {
    processCode,
    processName: document.process.name || processCode,
    workTypeCode: document.process.workType || document.process.domain || "UNCLASSIFIED",
    domainCode: document.process.domain || document.process.workType || "UNCLASSIFIED",
    designedStepCount: 0,
  };
  current.designedStepCount += 1;
  designs.set(processCode, current);
}

const entries = [...designs.values()].sort((a, b) => a.processCode.localeCompare(b.processCode)).map((design) => {
  const evidence = registered.get(design.processCode);
  const fingerprint = fingerprints.get(design.processCode) || {};
  if (!evidence) return { ...design, ...fingerprint, designStatus: "PRESENT", status: "UNREGISTERED", freshnessStatus: "UNRECORDED", playbackMode: null, stepCount: design.designedStepCount, passed: 0, failed: 0 };
  const recordedTime = Date.parse(evidence.recordedAt || "");
  const approvedTime = Date.parse(fingerprint.latestDesignApprovedAt || "");
  const exactHash = Boolean(evidence.recordedDesignHash && fingerprint.designHash && evidence.recordedDesignHash === fingerprint.designHash);
  const freshnessStatus = exactHash ? "FRESH" : (Number.isFinite(recordedTime) && Number.isFinite(approvedTime) ? (recordedTime >= approvedTime ? "FRESH_BY_TIME" : "STALE") : "UNKNOWN");
  return { ...design, ...evidence, ...fingerprint, freshnessStatus, designStatus: "PRESENT", designedStepCount: design.designedStepCount };
});

// Keep explicitly registered recordings even before their generated design arrives.
for (const [processCode, evidence] of registered) {
  if (!designs.has(processCode)) entries.push({ ...evidence, designStatus: "MISSING" });
}
entries.sort((a, b) => a.processCode.localeCompare(b.processCode));

const registeredEntries = entries.filter((entry) => entry.status === "PASS");
const designedEntries = entries.filter((entry) => entry.designStatus === "PRESENT");
const coveredDesignedEntries = designedEntries.filter((entry) => entry.status === "PASS");
const unregisteredDesignedEntries = designedEntries.filter((entry) => entry.status !== "PASS");
const orphanedRecordingEntries = entries.filter((entry) => entry.status === "PASS" && entry.designStatus === "MISSING");
const freshRecordingEntries = coveredDesignedEntries.filter((entry) => entry.freshnessStatus === "FRESH" || entry.freshnessStatus === "FRESH_BY_TIME");
const staleRecordingEntries = coveredDesignedEntries.filter((entry) => entry.freshnessStatus === "STALE");
const unknownFreshnessEntries = coveredDesignedEntries.filter((entry) => entry.freshnessStatus === "UNKNOWN");
const workTypes = Object.entries(designedEntries.reduce((result, entry) => {
  const code = entry.workTypeCode || entry.domainCode || "UNCLASSIFIED";
  result[code] ||= { designed: 0, registered: 0, unregistered: 0 };
  result[code].designed += 1;
  if (entry.status === "PASS") result[code].registered += 1;
  else result[code].unregistered += 1;
  return result;
}, {})).sort(([left], [right]) => left.localeCompare(right)).map(([workTypeCode, counts]) => ({ workTypeCode, ...counts }));

const generatedAt = new Date().toISOString();
const registry = {
  version: "process-preview-registry-v2",
  generatedAt,
  environment: existing.environment || "DEV",
  policy: "AUTHENTICATED_RECORDING_ONLY_NO_WEBPAGE_SUBSTITUTION",
  designedProcessCount: designs.size,
  registeredProcessCount: registeredEntries.length,
  coveredDesignedProcessCount: coveredDesignedEntries.length,
  unregisteredProcessCount: unregisteredDesignedEntries.length,
  orphanedRecordingCount: orphanedRecordingEntries.length,
  freshRecordingCount: freshRecordingEntries.length,
  staleRecordingCount: staleRecordingEntries.length,
  unknownFreshnessCount: unknownFreshnessEntries.length,
  entries,
};
const coverage = {
  version: "process-preview-coverage-v1",
  generatedAt,
  status: registry.unregisteredProcessCount === 0 ? "PASS" : "INCOMPLETE",
  designedProcessCount: registry.designedProcessCount,
  registeredProcessCount: registry.registeredProcessCount,
  coveredDesignedProcessCount: registry.coveredDesignedProcessCount,
  unregisteredProcessCount: registry.unregisteredProcessCount,
  orphanedRecordingCount: registry.orphanedRecordingCount,
  freshRecordingCount: registry.freshRecordingCount,
  staleRecordingCount: registry.staleRecordingCount,
  unknownFreshnessCount: registry.unknownFreshnessCount,
  coveragePercent: registry.designedProcessCount ? Number((registry.coveredDesignedProcessCount * 100 / registry.designedProcessCount).toFixed(2)) : 0,
  freshnessPercent: registry.coveredDesignedProcessCount ? Number((registry.freshRecordingCount * 100 / registry.coveredDesignedProcessCount).toFixed(2)) : 0,
  workTypes,
  unregisteredProcessCodes: unregisteredDesignedEntries.map((entry) => entry.processCode),
  orphanedRecordingProcessCodes: orphanedRecordingEntries.map((entry) => entry.processCode),
  staleRecordingProcessCodes: staleRecordingEntries.map((entry) => entry.processCode),
  unknownFreshnessProcessCodes: unknownFreshnessEntries.map((entry) => entry.processCode),
};

fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
fs.writeFileSync(coveragePath, `${JSON.stringify(coverage, null, 2)}\n`);
console.log(JSON.stringify(coverage));
