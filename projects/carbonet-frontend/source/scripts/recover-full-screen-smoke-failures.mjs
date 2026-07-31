#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] ?? "") : fallback;
}

const mode = argument("mode");
const manifestPath = path.resolve(argument("manifest"));
const summaryPath = path.resolve(argument("summary"));
const recoveryManifestPath = path.resolve(argument("recoveryManifest"));
const recoveryResultDir = path.resolve(argument("recoveryResultDir"));
const primaryResultDir = path.resolve(argument("primaryResultDir"));

if (mode === "prepare") {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const summary = JSON.parse(await readFile(summaryPath, "utf8"));
  const failedIds = new Set((summary.failures || []).map((failure) => failure.routeId));
  const routes = manifest.routes.filter((route) => failedIds.has(route.id));
  const recoveryManifest = {
    ...manifest,
    generatedAt: new Date().toISOString(),
    options: { ...manifest.options, recovery: true, shardCount: 1 },
    counts: {
      ...manifest.counts,
      selectedRouteCount: routes.length,
      selectedContractCount: routes.reduce((count, route) => count + route.contractIds.length, 0)
    },
    routes,
    shards: [{ index: 0, routeIds: routes.map((route) => route.id) }]
  };
  await mkdir(path.dirname(recoveryManifestPath), { recursive: true });
  await writeFile(recoveryManifestPath, `${JSON.stringify(recoveryManifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ recoveryRouteCount: routes.length })}\n`);
} else if (mode === "merge") {
  const recoveryFiles = (await readdir(recoveryResultDir)).filter((name) => /^shard-\d+\.json$/.test(name));
  const recoveredById = new Map();
  for (const file of recoveryFiles) {
    const payload = JSON.parse(await readFile(path.join(recoveryResultDir, file), "utf8"));
    for (const result of payload.results || []) {
      if (result.ok) recoveredById.set(result.routeId, { ...result, recovered: true });
    }
  }
  let mergedCount = 0;
  const primaryFiles = (await readdir(primaryResultDir)).filter((name) => /^shard-\d+\.json$/.test(name));
  for (const file of primaryFiles) {
    const filePath = path.join(primaryResultDir, file);
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    payload.results = (payload.results || []).map((result) => {
      const recovered = recoveredById.get(result.routeId);
      if (!result.ok && recovered) {
        mergedCount += 1;
        return recovered;
      }
      return result;
    });
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify({ recoveredRouteCount: recoveredById.size, mergedCount })}\n`);
  if (mergedCount !== recoveredById.size) process.exitCode = 1;
} else {
  throw new Error(`Unsupported --mode: ${mode}`);
}
