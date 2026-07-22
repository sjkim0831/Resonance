#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] ?? "") : fallback;
}

function asBoolean(value) {
  return /^(1|true|yes)$/i.test(String(value));
}

function normalizeRoute(value) {
  const route = String(value || "").trim();
  if (!route) return "";
  try {
    const url = new URL(route, "http://screen-smoke.local");
    return `${url.pathname}${url.search}`;
  } catch {
    return route.startsWith("/") ? route : `/${route}`;
  }
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const inputPath = path.resolve(readArg("input", ".cache/full-screen-smoke/contracts.jsonl"));
const outputPath = path.resolve(readArg("output", ".cache/full-screen-smoke/manifest.json"));
const baselinePath = path.resolve(readArg("baseline", ".cache/full-screen-smoke/last-success.json"));
const shardCount = Math.max(1, Number.parseInt(readArg("shards", "8"), 10) || 8);
const changedOnly = asBoolean(readArg("changedOnly", "false"));
const routePattern = readArg("routePattern", "");
const routeMatcher = routePattern ? new RegExp(routePattern) : null;

const rows = (await readFile(inputPath, "utf8"))
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSONL row ${index + 1}: ${error instanceof Error ? error.message : error}`);
    }
  });

const grouped = new Map();
for (const row of rows) {
  const routePath = normalizeRoute(row.routePath);
  if (!routePath) continue;
  const contract = {
    contractId: Number(row.contractId),
    processCode: String(row.processCode || ""),
    stepCode: String(row.stepCode || ""),
    actorCode: String(row.actorCode || ""),
    audience: String(row.audience || "").toUpperCase(),
    screenName: String(row.screenName || ""),
    contractStatus: String(row.contractStatus || ""),
    updatedAt: String(row.updatedAt || "")
  };
  const current = grouped.get(routePath) || [];
  current.push(contract);
  grouped.set(routePath, current);
}

let baseline = { fingerprints: {} };
try {
  baseline = JSON.parse(await readFile(baselinePath, "utf8"));
} catch {
  // A missing baseline intentionally selects every route on the first run.
}

const routes = [...grouped.entries()].map(([routePath, contracts]) => {
  const sortedContracts = [...contracts].sort((left, right) => left.contractId - right.contractId);
  const fingerprint = stableHash({ routePath, contracts: sortedContracts });
  return {
    id: stableHash(routePath).slice(0, 16),
    routePath,
    fingerprint,
    changed: baseline.fingerprints?.[routePath] !== fingerprint,
    contractIds: sortedContracts.map((contract) => contract.contractId),
    audiences: [...new Set(sortedContracts.map((contract) => contract.audience))].sort(),
    actorCodes: [...new Set(sortedContracts.map((contract) => contract.actorCode).filter(Boolean))].sort(),
    processCodes: [...new Set(sortedContracts.map((contract) => contract.processCode).filter(Boolean))].sort(),
    contracts: sortedContracts
  };
}).sort((left, right) => left.routePath.localeCompare(right.routePath));

const changedRoutes = changedOnly ? routes.filter((route) => route.changed) : routes;
const selectedRoutes = routeMatcher ? changedRoutes.filter((route) => routeMatcher.test(route.routePath)) : changedRoutes;
const shards = Array.from({ length: shardCount }, (_, index) => ({ index, routeIds: [] }));
selectedRoutes.forEach((route, index) => shards[index % shardCount].routeIds.push(route.id));

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  inputPath,
  baselinePath,
  options: { changedOnly, shardCount, routePattern },
  counts: {
    contractCount: rows.length,
    routeCount: routes.length,
    duplicateContractCount: rows.length - routes.length,
    selectedRouteCount: selectedRoutes.length,
    selectedContractCount: selectedRoutes.reduce((total, route) => total + route.contractIds.length, 0)
  },
  fingerprints: Object.fromEntries(routes.map((route) => [route.routePath, route.fingerprint])),
  routes,
  shards
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ outputPath, ...manifest.counts, shardCount, changedOnly })}\n`);
