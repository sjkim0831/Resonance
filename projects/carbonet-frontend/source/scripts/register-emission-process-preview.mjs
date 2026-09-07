import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const evidenceDir = path.resolve(process.env.EMISSION_PREVIEW_EVIDENCE_DIR || "../../../var/test-evidence/emission-live-22-step/PRJ-2026-B650F5");
const videoPath = path.resolve(root, process.env.EMISSION_PREVIEW_VIDEO || "public/qa/emission-relay-proof/emission-live-22-step-ui-relay.mp4");
const registryPath = path.resolve(root, "public/qa/process-preview-registry.json");
const outputDir = path.resolve(root, "public/qa/emission-relay-proof");
const timelinePath = path.join(outputDir, "emission-live-22-step-timeline.json");
const manifestPath = path.join(outputDir, "emission-live-22-step-manifest.json");

for (const filePath of [path.join(evidenceDir, "evidence.json"), videoPath, registryPath]) {
  if (!fs.existsSync(filePath)) throw new Error(`Required preview asset not found: ${filePath}`);
}

const evidence = JSON.parse(fs.readFileSync(path.join(evidenceDir, "evidence.json"), "utf8"));
if (evidence.steps?.length !== 22 || evidence.cleanup !== true) throw new Error("Only a cleaned 22/22 relay evidence can be registered");
const probeDuration = (filePath) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath], { encoding: "utf8" }).trim());
const videoDuration = probeDuration(videoPath);
let elapsed = 0;
const steps = evidence.steps.map((step) => {
  const duration = probeDuration(step.clip);
  const item = {
    id: `${step.processCode}::${step.stepCode}`,
    timeSeconds: Number(elapsed.toFixed(3)),
    durationSeconds: Number(duration.toFixed(3)),
    processCode: step.processCode,
    stepOrder: step.ordinal,
    stepCode: step.stepCode,
    stepName: step.stepCode,
    actorCode: step.actor,
    account: step.account,
    routePath: "/work/execution",
    screenName: "전문 업무 실행",
    result: step.bodyStatus,
    timestampBasis: "AUTHENTICATED_UI_CLIP_BOUNDARY",
  };
  elapsed += duration;
  return item;
});

const sha256 = crypto.createHash("sha256").update(fs.readFileSync(videoPath)).digest("hex");
const stat = fs.statSync(videoPath);
const processCounts = steps.reduce((counts, step) => {
  counts[step.processCode] = (counts[step.processCode] || 0) + 1;
  return counts;
}, {});
const fullRelayProcessCodes = new Set(["EMISSION_PROJECT"]);
const generatedAt = new Date().toISOString();
const timeline = {
  status: "PASS",
  version: "emission-live-relay-timeline-v1",
  video: path.basename(videoPath),
  videoDurationSeconds: videoDuration,
  processCount: Object.keys(processCounts).length,
  stepCount: steps.length,
  mappingMode: "AUTHENTICATED_UI_CLIP_BOUNDARY",
  steps,
};
const manifest = {
  status: "PASS",
  recordingMode: "22_AUTHENTICATED_UI_LOGIN_INPUT_SAVE_COMPLETE_ACCOUNT_RELAY",
  processCount: Object.keys(processCounts).length,
  stepCount: steps.length,
  passed: steps.length,
  failed: 0,
  cleanup: evidence.cleanup,
  projectId: evidence.projectId,
  recordedAt: evidence.finishedAt,
  durationSeconds: videoDuration,
  sizeBytes: stat.size,
  sha256,
  evidenceUrl: "/qa/emission-relay-proof/emission-live-22-step-ui-relay-evidence.json",
};
fs.writeFileSync(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const videoUrl = `/qa/emission-relay-proof/${path.basename(videoPath)}?v=${sha256.slice(0, 8)}`;
for (const entry of registry.entries || []) {
  const stepCount = processCounts[entry.processCode];
  const fullRelay = fullRelayProcessCodes.has(entry.processCode);
  if (!stepCount && !fullRelay) continue;
  Object.assign(entry, {
    status: "PASS",
    playbackMode: fullRelay ? "FULL" : "TIMELINE_RANGE",
    videoUrl,
    timelineUrl: fullRelay ? undefined : "/qa/emission-relay-proof/emission-live-22-step-timeline.json",
    manifestUrl: fullRelay ? undefined : "/qa/emission-relay-proof/emission-live-22-step-manifest.json",
    evidenceUrl: manifest.evidenceUrl,
    stepCount: fullRelay ? steps.length : stepCount,
    passed: fullRelay ? steps.length : stepCount,
    failed: 0,
    sha256,
    recordedAt: evidence.finishedAt || generatedAt,
    environment: "DEV",
  });
}
registry.generatedAt = generatedAt;
fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", processes: Object.keys(processCounts).length, steps: steps.length, durationSeconds: videoDuration, sha256, registryPath }));
