import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runtimeDir = path.resolve(root, "../../carbonet-backend-metadata/process-runtime/generated");
const registryPath = path.resolve(root, "public/qa/process-preview-registry.json");
const outputPath = path.resolve(root, "public/qa/process-preview-readiness.json");

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const recorded = new Set((registry.entries || []).filter((e) => e.status === "PASS").map((e) => e.processCode));
const processes = new Map();

for (const file of fs.readdirSync(runtimeDir).filter((n) => n.endsWith(".json")).sort()) {
  const doc = JSON.parse(fs.readFileSync(path.join(runtimeDir, file), "utf8"));
  const code = doc?.process?.code;
  if (!code) continue;
  const row = processes.get(code) || { processCode: code, processName: doc.process.name || code, workTypeCode: doc.process.workType || doc.process.domain || "UNCLASSIFIED", steps: [] };
  const pages = Array.isArray(doc?.frontend?.pages) ? doc.frontend.pages : [];
  const relatedBusinessRoute = doc?.step?.guide?.relatedBusinessRoute;
  const executionRoutes = typeof relatedBusinessRoute === "string" && relatedBusinessRoute.startsWith("/")
    ? [relatedBusinessRoute]
    : pages.map((p) => p.route).filter(Boolean);
  row.steps.push({
    stepCode: doc?.step?.code || file.replace(/\.json$/, ""),
    actorCode: doc?.step?.actor?.actorCode || null,
    routeStatuses: relatedBusinessRoute ? ["IMPLEMENTED"] : [...new Set(pages.map((p) => p.routeStatus || "MISSING"))],
    routes: executionRoutes,
    apiCount: Array.isArray(doc?.backend?.apis) ? doc.backend.apis.length : 0,
    commandCount: Array.isArray(doc?.backend?.commands) ? doc.backend.commands.length : 0,
    generationStatus: doc?.generationStatus || "MISSING",
    approvalStatus: doc?.approvalStatus || "MISSING",
  });
  processes.set(code, row);
}

const entries = [...processes.values()].sort((a, b) => a.processCode.localeCompare(b.processCode)).map((row) => {
  row.steps.sort((a, b) => a.stepCode.localeCompare(b.stepCode));
  if (recorded.has(row.processCode)) return { ...row, readiness: "RECORDED", blockers: [] };
  const blockers = [];
  const statuses = new Set(row.steps.flatMap((s) => s.routeStatuses));
  if (!row.steps.length) blockers.push("NO_STEPS");
  if (row.steps.some((s) => !s.routes.length)) blockers.push("ROUTE_MISSING");
  if (statuses.has("DESIGN_ONLY")) blockers.push("DESIGN_ONLY_ROUTE");
  if ([...statuses].some((s) => s !== "IMPLEMENTED" && s !== "DESIGN_ONLY")) blockers.push("ROUTE_STATUS_UNVERIFIED");
  if (row.steps.some((s) => !s.actorCode)) blockers.push("ACTOR_MISSING");
  if (row.steps.some((s) => s.apiCount < 1 || s.commandCount < 1)) blockers.push("BACKEND_CONTRACT_MISSING");
  if (row.steps.some((s) => s.generationStatus !== "GENERATED")) blockers.push("GENERATION_NOT_READY");
  if (row.steps.some((s) => s.approvalStatus !== "APPROVED")) blockers.push("DESIGN_NOT_APPROVED");
  const structuralReady = blockers.length === 0;
  if (structuralReady) blockers.push("ACTOR_TEST_ACCOUNT_MAPPING_REQUIRED", "AUTHENTICATED_RELAY_RECORDING_REQUIRED");
  const readiness = structuralReady ? "EXECUTABLE_PENDING_ACCOUNT_MAPPING" : (blockers.includes("DESIGN_ONLY_ROUTE") ? "DESIGN_ONLY" : "BLOCKED");
  return { ...row, readiness, blockers: [...new Set(blockers)] };
});

const counts = entries.reduce((out, e) => (out[e.readiness] = (out[e.readiness] || 0) + 1, out), {});
const byWorkType = Object.values(entries.reduce((out, e) => {
  const key = e.workTypeCode;
  out[key] ||= { workTypeCode: key, total: 0, recorded: 0, executablePendingAccountMapping: 0, designOnly: 0, blocked: 0 };
  out[key].total += 1;
  if (e.readiness === "RECORDED") out[key].recorded += 1;
  else if (e.readiness === "EXECUTABLE_PENDING_ACCOUNT_MAPPING") out[key].executablePendingAccountMapping += 1;
  else if (e.readiness === "DESIGN_ONLY") out[key].designOnly += 1;
  else out[key].blocked += 1;
  return out;
}, {})).sort((a, b) => a.workTypeCode.localeCompare(b.workTypeCode));
const output = {
  version: "process-preview-readiness-v1",
  generatedAt: new Date().toISOString(),
  policy: "NO_PASS_WITHOUT_AUTHENTICATED_RECORDING",
  totalProcessCount: entries.length,
  counts,
  byWorkType,
  entries,
};
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
if (entries.some((e) => e.readiness !== "RECORDED" && !e.blockers.length)) throw new Error("UNRECORDED_PROCESS_WITHOUT_BLOCKER");
console.log(JSON.stringify({ status: "PASS", totalProcessCount: entries.length, counts, outputPath }));
