#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

const TARGET_IDS = Object.freeze([216005, 216006, 216007, 216008]);
const SUPPORTED_REASONS = new Set(["UNCHANGED", "DESIGN_CHANGED", "HISTORICAL_VERSION_REUSED"]);
const REQUEST_TIMEOUT_MS = Number(process.env.CARBONET_MEMBER_CONTRACT_REQUEST_TIMEOUT_MS || "15000");

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function invariant(condition, message, evidence = {}) {
  if (condition) return;
  const error = new Error(message);
  error.evidence = evidence;
  throw error;
}

function normalizeRoute(value) {
  return String(value || "").split("?", 1)[0].toLowerCase();
}

function readCookieJar(text) {
  const cookies = [];
  for (let line of String(text || "").split(/\r?\n/)) {
    if (line.startsWith("#HttpOnly_")) line = line.slice("#HttpOnly_".length);
    else if (!line || line.startsWith("#")) continue;
    const fields = line.split("\t");
    if (fields.length >= 7 && fields[5]) cookies.push(`${fields[5]}=${fields[6]}`);
  }
  invariant(cookies.length > 0, "authenticated cookie jar is empty");
  return cookies.join("; ");
}

async function requestJson(fetchImpl, baseUrl, cookie, path, options = {}) {
  const response = await fetchImpl(new URL(path, baseUrl), {
    redirect: "follow",
    signal: options.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...options,
    headers: {
      Cookie: cookie,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  if (text.trim()) {
    try { body = JSON.parse(text); }
    catch { body = text; }
  }
  invariant(response.status === 200 && body && typeof body === "object",
    `runtime request failed path=${path} status=${response.status}`,
    { path, status: response.status, responseType: typeof body });
  return body;
}

function assertTargetRows(rows) {
  invariant(Array.isArray(rows) && rows.length === TARGET_IDS.length,
    "exactly four member lifecycle contracts are required", { count: rows?.length });
  const ids = rows.map((row) => Number(row?.payload?.contractId));
  invariant(JSON.stringify(ids) === JSON.stringify(TARGET_IDS),
    "member lifecycle contract IDs are not exact and ordered", { ids });
  for (const row of rows) {
    const payload = row.payload || {};
    const expected = row.expected || {};
    invariant(payload.contractStatus === "VERIFIED", "source contract is not VERIFIED", { contractId: payload.contractId });
    invariant(expected.processCode === "MEMBER_LIFECYCLE" && expected.audience === "USER",
      "source identity is outside MEMBER_LIFECYCLE USER", { contractId: payload.contractId });
    invariant(/^MEMBER_LIFECYCLE_0[1-4]_[A-Z0-9_]+$/.test(expected.stepCode || ""),
      "source step identity is invalid", { contractId: payload.contractId, stepCode: expected.stepCode });
    invariant(normalizeRoute(expected.routePath) === "/work/execution",
      "source route identity is invalid", { contractId: payload.contractId, routePath: expected.routePath });
    invariant(/^[0-9a-f]{64}$/.test(expected.designHash || ""),
      "canonical design hash is invalid", { contractId: payload.contractId });
    invariant(expected.catalogHash === null || expected.catalogHash === "" || /^[0-9a-f]{64}$/.test(expected.catalogHash),
      "canonical catalog hash is invalid", { contractId: payload.contractId });
  }
}

function assertSupport(support, expected, label) {
  invariant(support && typeof support === "object" && !Array.isArray(support), `${label} support is missing`);
  const keys = Object.keys(support).sort();
  const expectedKeys = ["assetBindings", "catalogHash", "designCard", "designHash", "help", "lanes", "qa", "schemaVersion", "workGuide"].sort();
  invariant(JSON.stringify(keys) === JSON.stringify(expectedKeys), `${label} support envelope is not exact`, { keys });
  invariant(support.schemaVersion === "carbonet.executable-screen-support/v1", `${label} support schema is invalid`);
  invariant(support.designHash === expected.designHash && (support.catalogHash ?? null) === (expected.catalogHash ?? null),
    `${label} support hashes drifted from current DB canonical bundle`, {
      expectedDesignHash: expected.designHash,
      actualDesignHash: support.designHash,
      expectedCatalogHash: expected.catalogHash ?? null,
      actualCatalogHash: support.catalogHash ?? null,
    });
  const laneKeys = Object.keys(support.lanes || {}).sort();
  invariant(JSON.stringify(laneKeys) === JSON.stringify(["API", "DATABASE", "DESIGN_CARD", "FRONTEND", "HELP", "QA", "WORK_GUIDE"]),
    `${label} canonical lane set is incomplete`, { laneKeys });
  invariant(Array.isArray(support.assetBindings) && support.assetBindings.length > 0,
    `${label} asset bindings are incomplete`);
}

function assertPreview(body, row, phase) {
  const contractId = row.payload.contractId;
  const publication = body.runtimePublication || {};
  invariant(body.success === true && body.preview === true && body.rolledBack === true
      && body.committed === false && body.mutationScope === "READ_ONLY_PREDICTION",
    "preview was not read-only", { contractId });
  invariant(body.contract?.contractId === contractId && body.contract?.readinessScore === 100
      && String(body.contract?.readinessGaps || "") === "",
    "preview readiness is not 100", { contractId, contract: body.contract });
  invariant(body.designGate?.status === "PASSED" && body.designGate?.score === 100
      && String(body.designGate?.issues || "") === "",
    "preview design gate is not 100", { contractId, designGate: body.designGate });
  invariant(publication.contractId === contractId && publication.predicted === true
      && publication.applied === false && publication.published === false
      && publication.publicationMode === "PREDICTED_READ_ONLY"
      && publication.bindingCount === 1 && Number(publication.versionNo) >= 1
      && /^[0-9a-f]{32}$/.test(String(publication.contractHash || ""))
      && SUPPORTED_REASONS.has(publication.reason)
      && publication.wouldPublish === (publication.reason !== "UNCHANGED"),
    "preview publication prediction is incomplete", { contractId, publication });
  if (phase === "idempotent") {
    invariant(publication.reason === "UNCHANGED" && publication.wouldPublish === false,
      "idempotent preview did not predict UNCHANGED", { contractId, publication });
  }
  assertSupport(publication.support, row.expected, `preview contract=${contractId}`);
  invariant(publication.designHash === row.expected.designHash
      && (publication.catalogHash ?? null) === (row.expected.catalogHash ?? null),
    "preview top-level support hashes drifted", { contractId });
  invariant(body.autoImplementation?.buildRequired === false
      && body.autoImplementation?.fullGenerationDeferred === true,
    "preview requested a build", { contractId, automation: body.autoImplementation });
  return publication;
}

function assertPublish(body, row, predicted, phase) {
  const contractId = row.payload.contractId;
  const publication = body.runtimePublication || {};
  invariant(body.success === true && body.contract?.readinessScore === 100
      && body.designGate?.status === "PASSED" && body.designGate?.score === 100,
    "publish readiness/design gate drifted", { contractId });
  invariant(publication.contractId === contractId && publication.bindingCount === 1
      && publication.contractHash === predicted.contractHash
      && publication.versionNo === predicted.versionNo
      && Number(publication.versionId) >= 1,
    "published binding/version/hash does not match preview", { contractId, predicted, publication });
  invariant(publication.reason === predicted.reason
      && publication.published === (predicted.reason !== "UNCHANGED")
      && publication.buildRequired === false,
    "published outcome does not match preview", { contractId, predicted, publication });
  if (predicted.versionId !== null && predicted.versionId !== undefined) {
    invariant(publication.versionId === predicted.versionId,
      "published version ID does not match preview", { contractId, predicted, publication });
  }
  if (phase === "idempotent") {
    invariant(publication.reason === "UNCHANGED" && publication.published === false,
      "idempotent publish created a runtime version", { contractId, publication });
  }
  assertSupport(publication.support, row.expected, `publish contract=${contractId}`);
  invariant(digest(publication.support) === digest(predicted.support),
    "support changed between preview and publish", { contractId });
  return publication;
}

function assertResolved(body, row, publication) {
  const contractId = row.payload.contractId;
  invariant(body.source === "DB_VERSIONED_CONTRACT" && body.resolvedBy === "ROUTE_PROCESS_STEP_AUDIENCE"
      && body.matchCount === 1 && body.contractHash === publication.contractHash
      && body.versionId === publication.versionId && body.versionNo === publication.versionNo
      && normalizeRoute(body.routePath) === "/work/execution",
    "runtime resolver did not return the exact active contract", { contractId, publication, resolved: body });
  const contract = body.contract || {};
  invariant(contract.process?.processCode === row.expected.processCode
      && contract.process?.stepCode === row.expected.stepCode
      && contract.screen?.audience === row.expected.audience
      && normalizeRoute(contract.screen?.route) === normalizeRoute(row.expected.routePath),
    "resolved process/step/audience/route identity drifted", { contractId });
  assertSupport(contract.support, row.expected, `resolver contract=${contractId}`);
  invariant(digest(contract.support) === digest(publication.support),
    "resolver support differs from published support", { contractId });
}

export async function publishMemberLifecycleContracts({ rows, baseUrl, cookie, phase = "initial", fetchImpl = fetch }) {
  invariant(phase === "initial" || phase === "idempotent", "unsupported publisher phase", { phase });
  assertTargetRows(rows);

  // Safety invariant: collect and validate every read-only preview before the
  // first call to the mutation endpoint.
  const previews = [];
  for (const row of rows) {
    const body = await requestJson(fetchImpl, baseUrl, cookie,
      "/admin/api/system/actor-process/professional-screen-contracts/preview", {
        method: "POST", body: JSON.stringify(row.payload),
      });
    previews.push(assertPreview(body, row, phase));
  }

  const contracts = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const publishedBody = await requestJson(fetchImpl, baseUrl, cookie,
      "/admin/api/system/actor-process/professional-screen-contracts", {
        method: "POST", body: JSON.stringify(row.payload),
      });
    const publication = assertPublish(publishedBody, row, previews[index], phase);
    const params = new URLSearchParams({
      routePath: normalizeRoute(row.expected.routePath),
      processCode: row.expected.processCode,
      stepCode: row.expected.stepCode,
      audience: row.expected.audience,
    });
    const resolved = await requestJson(fetchImpl, baseUrl, cookie, `/runtime/screens/resolve?${params}`);
    assertResolved(resolved, row, publication);
    contracts.push({
      contractId: row.payload.contractId,
      stepCode: row.expected.stepCode,
      routePath: normalizeRoute(row.expected.routePath),
      payloadHash: digest(row.payload),
      predictionReason: previews[index].reason,
      contractHash: publication.contractHash,
      versionId: publication.versionId,
      versionNo: publication.versionNo,
      bindingCount: publication.bindingCount,
      designHash: publication.designHash,
      catalogHash: publication.catalogHash ?? null,
      supportHash: digest(publication.support),
      resolver: "PASS",
    });
  }
  return {
    success: true,
    phase,
    targetCount: contracts.length,
    previewCount: previews.length,
    publishCount: contracts.length,
    resolverCount: contracts.length,
    previewBeforeMutation: true,
    contracts,
  };
}

async function main() {
  const inputPath = String(process.env.CARBONET_MEMBER_CONTRACT_INPUT_FILE || "");
  const cookiePath = String(process.env.CARBONET_MEMBER_CONTRACT_COOKIE_JAR || "");
  const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "").replace(/\/$/, "");
  const phase = String(process.env.CARBONET_MEMBER_CONTRACT_PHASE || "initial");
  invariant(inputPath && cookiePath && /^https?:\/\//.test(baseUrl), "publisher runtime inputs are incomplete");
  const rows = JSON.parse(await readFile(inputPath, "utf8"));
  const cookie = readCookieJar(await readFile(cookiePath, "utf8"));
  const result = await publishMemberLifecycleContracts({ rows, baseUrl, cookie, phase });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`[member-contract-publisher] FAIL ${error.message}\n`);
    if (error.evidence) process.stderr.write(`${JSON.stringify(error.evidence)}\n`);
    process.exitCode = 1;
  });
}
