#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.env.ROOT_DIR || ".");
const cache = path.resolve(process.env.FULL_SCREEN_SMOKE_CACHE_DIR || path.join(root, ".cache/full-screen-smoke"));
const manifestPath = path.resolve(process.env.FULL_SCREEN_SMOKE_MANIFEST || path.join(cache, "manifest.json"));
const resultDir = path.resolve(process.env.FULL_SCREEN_SMOKE_RESULT_DIR || path.join(cache, "results"));
const contextPath = path.resolve(process.env.FULL_SCREEN_QUALITY_CONTEXT || path.join(cache, "quality-context.jsonl"));
const reportPath = path.resolve(process.env.FULL_SCREEN_QUALITY_REPORT || path.join(cache, "quality-report.json"));
const queuePath = path.resolve(process.env.FULL_SCREEN_QUALITY_QUEUE || path.join(cache, "development-priority-queue.json"));
const historyPath = path.resolve(process.env.FULL_SCREEN_QUALITY_HISTORY || path.join(cache, "quality-history.json"));

const readJson = async (file, fallback) => { try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; } };
const normalizeRoute = (value) => { try { return new URL(String(value), "http://quality.local").pathname.replace(/\/$/, "") || "/"; } catch { return String(value).split("?")[0].replace(/\/$/, "") || "/"; } };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const manifest = await readJson(manifestPath, null);
if (!manifest) throw new Error(`manifest not found: ${manifestPath}`);
const contextRows = (await readFile(contextPath, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const contextByRoute = new Map(contextRows.map((row) => [normalizeRoute(row.routeKey), row]));
const resultFiles = (await readdir(resultDir)).filter((name) => /^shard-\d+\.json$/.test(name));
const currentResults = [];
for (const file of resultFiles) currentResults.push(...((await readJson(path.join(resultDir, file), {})).results || []));
const resultByRoute = new Map(currentResults.map((result) => [result.routePath, result]));
const previous = await readJson(reportPath, { routes: [] });
const previousByRoute = new Map((previous.routes || []).map((route) => [route.routePath, route]));

function scoreRoute(route, result, db) {
  const runtimeGaps = [];
  let availability = result.ok && result.status < 400 ? 25 : 0;
  let rendering = result.bodyTextLength >= 20 ? 15 : 0;
  let reliability = 15 - Math.min(15, (result.consoleErrorCount || 0) * 4 + (result.pageErrorCount || 0) * 5 + (result.apiFailureCount || 0) * 5);
  let accessibility = 15;
  if (!(result.mainLandmarkCount > 0)) { accessibility -= 4; runtimeGaps.push("MAIN_LANDMARK_MISSING"); }
  if (!(result.headingCount > 0)) { accessibility -= 4; runtimeGaps.push("HEADING_MISSING"); }
  if (result.unlabeledFormControlCount > 0) { accessibility -= Math.min(5, result.unlabeledFormControlCount); runtimeGaps.push("FORM_LABEL_MISSING"); }
  if (result.imageMissingAltCount > 0) { accessibility -= Math.min(2, result.imageMissingAltCount); runtimeGaps.push("IMAGE_ALT_MISSING"); }
  const responsive = result.overflowX ? 0 : 10;
  const performance = result.durationMs <= 500 ? 10 : result.durationMs <= 1000 ? 8 : result.durationMs <= 2000 ? 5 : 2;
  if (!result.ok) runtimeGaps.push(...(result.errors || []));
  if ((result.apiFailureCount || 0) > 0) runtimeGaps.push("API_FAILURE");
  if ((result.consoleErrorCount || 0) > 0) runtimeGaps.push("CONSOLE_ERROR");
  if (result.overflowX) runtimeGaps.push("RESPONSIVE_OVERFLOW");
  if (result.durationMs > 1000) runtimeGaps.push("SLOW_RENDER");
  const traceability = Math.round(clamp(Number(db?.professionalScore || 0), 0, 100) / 10);
  const qualityScore = availability + rendering + reliability + clamp(accessibility, 0, 15) + responsive + performance + traceability;
  const gaps = [...new Set([...(db?.gapCodes || []), ...runtimeGaps])];
  const priority = !result.ok ? "P0" : qualityScore < 70 ? "P1" : qualityScore < 85 ? "P2" : qualityScore < 95 ? "P3" : "READY";
  return { qualityScore, runtimeScore: qualityScore - traceability, traceabilityScore: traceability, priority, gaps };
}

function suggestion(gaps) {
  if (gaps.some((gap) => /HTTP_|BLANK_SCREEN|BOOTSTRAP/.test(gap))) return "직접접속 fallback과 React 자산 closure를 복구한 뒤 해당 URL만 재검사";
  if (gaps.includes("API_FAILURE")) return "실패 API 계약·권한·예외 응답을 수정하고 해당 화면 테스트를 재실행";
  if (gaps.includes("PROCESS_BINDING_MISSING") || gaps.includes("ACTOR_MISSING")) return "Actor·Process·Step 화면 바인딩을 관리 계약에 등록";
  if (gaps.includes("TEST_MISSING")) return "Happy path·권한·격리·예외·복구 테스트를 Step에 연결";
  if (gaps.includes("DATA_CONTRACT_MISSING") || gaps.includes("DB_LINEAGE_INCOMPLETE")) return "화면 필드와 DB/API 데이터 lineage를 연결";
  if (gaps.some((gap) => /LANDMARK|HEADING|LABEL|ALT/.test(gap))) return "시맨틱 landmark, 제목 계층, 폼 label, 이미지 대체텍스트를 보완";
  if (gaps.includes("SLOW_RENDER")) return "해당 화면 chunk와 초기 API 호출을 지연 로딩하고 변경 파일만 재빌드";
  return "전문 화면 계약의 남은 gap을 보완하고 변경 화면만 재검사";
}

const scoredRoutes = [];
for (const route of manifest.routes) {
  const result = resultByRoute.get(route.routePath);
  if (!result) {
    const prior = previousByRoute.get(route.routePath);
    if (prior) scoredRoutes.push(prior);
    continue;
  }
  const db = contextByRoute.get(normalizeRoute(route.routePath));
  const scored = scoreRoute(route, result, db);
  scoredRoutes.push({
    routeId: route.id, routePath: route.routePath, contractIds: route.contractIds,
    actorCodes: route.actorCodes, processCodes: route.processCodes,
    screenName: db?.screenName || route.contracts?.[0]?.screenName || "",
    sourceRef: db?.sourceRef || "", professionalScore: Number(db?.professionalScore || 0),
    taskCount: Number(db?.actualTaskCount || 0), testCount: Number(db?.testCount || 0),
    durationMs: result.durationMs, ...scored,
    suggestedFix: suggestion(scored.gaps)
  });
}

const duplicateContracts = [];
for (const route of manifest.routes) {
  const seen = new Set();
  for (const contract of route.contracts || []) {
    const key = [contract.processCode, contract.stepCode, contract.actorCode, contract.audience].join("|");
    if (seen.has(key)) duplicateContracts.push({ routePath: route.routePath, contractId: contract.contractId, signature: key });
    seen.add(key);
  }
}
const manifestRoutes = new Set(manifest.routes.map((route) => normalizeRoute(route.routePath)));
const screenInventoryCandidates = contextRows.filter((row) => !manifestRoutes.has(normalizeRoute(row.routeKey)) || Number(row.bindingCount || 0) === 0).map((row) => {
  const contracted = manifestRoutes.has(normalizeRoute(row.routeKey));
  const reason = !contracted && row.implementationStatus === "DESIGN_ONLY" ? "PLANNED_NOT_CONTRACTED"
    : !contracted ? "IMPLEMENTED_WITHOUT_CONTRACT" : "NO_PROCESS_BINDING";
  return { routePath: row.routeKey, screenName: row.screenName, sourceRef: row.sourceRef, implementationStatus: row.implementationStatus, reason };
});
const unusedScreens = screenInventoryCandidates.filter((row) => row.reason !== "PLANNED_NOT_CONTRACTED");
const plannedScreens = screenInventoryCandidates.filter((row) => row.reason === "PLANNED_NOT_CONTRACTED");

const queue = scoredRoutes.filter((route) => route.priority !== "READY").sort((a, b) => {
  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return rank[a.priority] - rank[b.priority] || a.qualityScore - b.qualityScore || a.routePath.localeCompare(b.routePath);
}).map((route, index) => ({ queueOrder: index + 1, ...route, incrementalCommand: `FULL_SCREEN_SMOKE_CHANGED_ONLY=true npm run test:e2e:full-screen-smoke` }));

const previousHistory = await readJson(historyPath, { runs: [] });
const failureSignals = scoredRoutes.filter((route) => route.gaps.some((gap) => /HTTP_|BLANK_SCREEN|BOOTSTRAP|API_FAILURE|CONSOLE_ERROR/.test(gap))).map((route) => ({ routePath: route.routePath, gaps: route.gaps }));
const run = { completedAt: new Date().toISOString(), routeCount: scoredRoutes.length, averageScore: scoredRoutes.length ? Number((scoredRoutes.reduce((sum, route) => sum + route.qualityScore, 0) / scoredRoutes.length).toFixed(2)) : 0, failureSignals };
const runs = [...(previousHistory.runs || []), run].slice(-30);
const recurrence = new Map();
for (const item of runs.flatMap((entry) => entry.failureSignals || [])) for (const gap of item.gaps) {
  const key = `${item.routePath}|${gap}`; recurrence.set(key, (recurrence.get(key) || 0) + 1);
}
const selfHealCandidates = [...recurrence.entries()].filter(([, count]) => count >= 2).map(([key, occurrences]) => {
  const [routePath, gap] = key.split("|");
  return { routePath, gap, occurrences, proposedRule: suggestion([gap]) };
});

const summary = {
  routeCount: scoredRoutes.length,
  averageScore: run.averageScore,
  readyCount: scoredRoutes.filter((route) => route.priority === "READY").length,
  priorityCounts: Object.fromEntries(["P0", "P1", "P2", "P3"].map((priority) => [priority, scoredRoutes.filter((route) => route.priority === priority).length])),
  duplicateContractCandidateCount: duplicateContracts.length,
  unusedScreenCandidateCount: unusedScreens.length,
  plannedScreenBacklogCount: plannedScreens.length,
  selfHealCandidateCount: selfHealCandidates.length
};
const report = { schemaVersion: 1, completedAt: run.completedAt, summary, routes: scoredRoutes, duplicateContracts, unusedScreens, plannedScreens, selfHealCandidates };
const priorityQueue = { schemaVersion: 1, completedAt: run.completedAt, summary, queue };
await mkdir(path.dirname(reportPath), { recursive: true });
await Promise.all([
  writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`),
  writeFile(queuePath, `${JSON.stringify(priorityQueue, null, 2)}\n`),
  writeFile(historyPath, `${JSON.stringify({ schemaVersion: 1, runs }, null, 2)}\n`)
]);
process.stdout.write(`${JSON.stringify(summary)}\n`);
