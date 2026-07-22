#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve(process.env.FULL_SCREEN_SMOKE_MANIFEST || ".cache/full-screen-smoke/manifest.json");
const resultDir = path.resolve(process.env.FULL_SCREEN_SMOKE_RESULT_DIR || ".cache/full-screen-smoke/results");
const baselinePath = path.resolve(process.env.FULL_SCREEN_SMOKE_BASELINE || ".cache/full-screen-smoke/last-success.json");
const summaryPath = path.resolve(process.env.FULL_SCREEN_SMOKE_SUMMARY || ".cache/full-screen-smoke/summary.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const files = (await readdir(resultDir)).filter((name) => /^shard-\d+\.json$/.test(name)).sort();
const routeResults = [];
let completeShardCount = 0;
for (const file of files) {
  const payload = JSON.parse(await readFile(path.join(resultDir, file), "utf8"));
  if (payload.complete === true) completeShardCount += 1;
  routeResults.push(...(payload.results || []));
}

const failures = routeResults.filter((result) => !result.ok);
const recovered = routeResults.filter((result) => result.recovered);
const testedContractIds = new Set(routeResults.flatMap((result) => result.contractIds || []));
const summary = {
  schemaVersion: 1,
  completedAt: new Date().toISOString(),
  manifestCounts: manifest.counts,
  testedRouteCount: routeResults.length,
  testedContractCount: testedContractIds.size,
  completeShardCount,
  expectedShardCount: manifest.shards.filter((shard) => shard.routeIds.length > 0).length,
  passedRouteCount: routeResults.length - failures.length,
  failedRouteCount: failures.length,
  recoveredRouteCount: recovered.length,
  failures
};
await mkdir(path.dirname(summaryPath), { recursive: true });
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
if (routeResults.length !== manifest.counts.selectedRouteCount || completeShardCount !== summary.expectedShardCount || failures.length > 0) {
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exitCode = 1;
} else {
  await writeFile(baselinePath, `${JSON.stringify({ completedAt: summary.completedAt, fingerprints: manifest.fingerprints }, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}
