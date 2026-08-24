#!/usr/bin/env node
import process from "node:process";
import { createHash } from "node:crypto";

const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const userId = String(process.env.CARBONET_VALIDATE_USER || "");
const userPw = String(process.env.CARBONET_VALIDATE_PASSWORD || "");
const userSe = String(process.env.CARBONET_VALIDATE_USER_SE || "USR");
const loginPath = String(process.env.CARBONET_VALIDATE_LOGIN_PATH || "/admin/login/actionLogin");
const itemId = String(process.env.CARBONET_SCREEN_CONTRACT_ITEM_ID || "26");
// Candidate preview runs beside the complete process/browser validation group
// and performs exact DB/runtime rollback proofs. Preserve the 2.5s ordinary
// SLO, while giving only the deploy-time preview a bounded 7s contention budget.
const candidateMode = String(process.env.CARBONET_POSTDEPLOY_EVIDENCE_MODE || "") === "candidate";
const defaultMaxSaveMillis = candidateMode ? "7000" : "2500";
const maxSaveMillis = Number(process.env.CARBONET_SCREEN_CONTRACT_SAVE_MAX_MS || defaultMaxSaveMillis);
const maxResolveMillis = Number(process.env.CARBONET_SCREEN_CONTRACT_RESOLVE_MAX_MS || "1000");
const renderProbe = !["0", "false", "no"].includes(String(process.env.CARBONET_SCREEN_CONTRACT_RENDER_PROBE || "1").toLowerCase());
const previewMode = candidateMode || String(process.env.CARBONET_SCREEN_CONTRACT_PREVIEW_ONLY || "") === "1";

if (!userId || !userPw) {
  throw new Error("CARBONET_VALIDATE_USER and CARBONET_VALIDATE_PASSWORD are required for authenticated runtime save validation");
}

const cookieJar = new Map();

function recordCookies(headers) {
  const raw = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie")].filter(Boolean);
  for (const line of raw) {
    const first = String(line).split(";")[0];
    const index = first.indexOf("=");
    if (index > 0) cookieJar.set(first.slice(0, index), first.slice(index + 1));
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(path, options = {}) {
  const started = performance.now();
  const response = await fetch(new URL(path, baseUrl), {
    redirect: options.redirect || "follow",
    ...options,
    headers: {
      ...(cookieJar.size ? { Cookie: cookieHeader() } : {}),
      ...(options.headers || {}),
    },
  });
  recordCookies(response.headers);
  const text = await response.text();
  const elapsedMs = Math.round(performance.now() - started);
  let body = null;
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body, elapsedMs, text };
}

function assertOk(condition, message, evidence = {}) {
  if (!condition) {
    const error = new Error(message);
    error.evidence = evidence;
    throw error;
  }
}

function value(row, ...keys) {
  for (const key of keys) {
    const found = row?.[key];
    if (found !== undefined && found !== null && String(found) !== "") return String(found);
  }
  return "";
}

function canonical(valueToCanonicalize) {
  if (Array.isArray(valueToCanonicalize)) return valueToCanonicalize.map(canonical);
  if (valueToCanonicalize && typeof valueToCanonicalize === "object") {
    return Object.fromEntries(Object.keys(valueToCanonicalize).sort().map((key) => [key, canonical(valueToCanonicalize[key])]));
  }
  return valueToCanonicalize;
}

function digest(valueToDigest) {
  return createHash("sha256").update(JSON.stringify(canonical(valueToDigest))).digest("hex");
}

function pickResolveTarget(detail, contract) {
  const item = detail.item || {};
  const binding = Array.isArray(detail.bindings) ? detail.bindings[0] || {} : {};
  const routePath = value(contract, "routePath", "route_path")
    || value(item, "routePath", "route_path", "route_key", "routeKey")
    || value(binding, "routePath", "route_path");
  const processCode = value(contract, "processCode", "process_code") || value(binding, "processCode", "process_code");
  const stepCode = value(contract, "stepCode", "step_code") || value(binding, "stepCode", "step_code");
  const audience = value(contract, "audience") || value(binding, "audience") || "USER";
  return { routePath, processCode, stepCode, audience };
}

async function main() {
  let sessionActive = false;
  try {
  const login = await request(loginPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, userPw, userSe }),
  });
  assertOk(login.response.status === 200, `login failed status=${login.response.status}`, { loginMs: login.elapsedMs });
  if (typeof login.body === "object" && login.body?.status === "loginFailure") {
    throw new Error("login rejected by application");
  }
  sessionActive = true;

  const detail = await request(`/admin/api/system/actor-process/page-development-master/${encodeURIComponent(itemId)}`);
  assertOk(detail.response.status === 200 && typeof detail.body === "object", `detail failed status=${detail.response.status}`, { detailMs: detail.elapsedMs });
  const contracts = Array.isArray(detail.body.contracts) ? detail.body.contracts : [];
  assertOk(contracts.length > 0, `no professional contracts found for itemId=${itemId}`);
  const contract = contracts[0];
  const contractId = value(contract, "contractId", "contract_id");
  assertOk(contractId, "contractId missing from detail response");

  const payload = { ...contract, contractId };
  const target = pickResolveTarget(detail.body, contract);
  assertOk(target.routePath && target.processCode && target.stepCode && target.audience, "resolve target incomplete", target);
  const params = new URLSearchParams(target);
  const contractHashBefore = digest(contract);
  let runtimeHashBefore = "";
  if (previewMode) {
    const resolvedBefore = await request(`/runtime/screens/resolve?${params.toString()}`);
    assertOk(resolvedBefore.response.status === 200 && typeof resolvedBefore.body === "object", `pre-resolve failed status=${resolvedBefore.response.status}`, { resolveMs: resolvedBefore.elapsedMs, target });
    runtimeHashBefore = digest(resolvedBefore.body);
  }
  const saves = [];
  const savePath = previewMode
    ? "/admin/api/system/actor-process/professional-screen-contracts/preview"
    : "/admin/api/system/actor-process/professional-screen-contracts";
  const attemptCount = previewMode ? 3 : 2;
  for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
    const saved = await request(savePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const automation = saved.body?.automation || saved.body?.autoImplementation;
    saves.push({
      attempt,
      status: saved.response.status,
      elapsedMs: saved.elapsedMs,
      success: saved.body?.success,
      publication: saved.body?.runtimePublication,
      automation,
      preview: saved.body?.preview,
      rolledBack: saved.body?.rolledBack,
      committed: saved.body?.committed,
      mutationScope: saved.body?.mutationScope,
      errorMessage: typeof saved.body?.message === "string" ? saved.body.message.slice(0, 2000) : undefined,
    });
    assertOk(saved.response.status === 200 && saved.body?.success === true, `save failed attempt=${attempt} status=${saved.response.status}`, saves.at(-1));
    assertOk(saved.elapsedMs <= maxSaveMillis, `save too slow attempt=${attempt} elapsedMs=${saved.elapsedMs} max=${maxSaveMillis}`, saves.at(-1));
    assertOk(saved.body?.runtimePublication?.contractId !== undefined, `runtime publication missing attempt=${attempt}`, saves.at(-1));
    assertOk(automation?.buildRequired === false, `save requested build attempt=${attempt}`, saves.at(-1));
    assertOk(automation?.fullGenerationDeferred === true, `full generation was not deferred attempt=${attempt}`, saves.at(-1));
    if (previewMode) {
      assertOk(saved.body?.preview === true && saved.body?.rolledBack === true && saved.body?.committed === false,
        `preview rollback contract failed attempt=${attempt}`, saves.at(-1));
      assertOk(saved.body?.mutationScope === "READ_ONLY_PREDICTION",
        `preview mutation scope failed attempt=${attempt}`, saves.at(-1));
      const publication = saved.body?.runtimePublication;
      const validReason = ["UNCHANGED", "DESIGN_CHANGED", "HISTORICAL_VERSION_REUSED"].includes(publication?.reason);
      const wouldPublishMatchesReason = publication?.wouldPublish === (publication?.reason !== "UNCHANGED");
      assertOk(publication?.predicted === true && publication?.applied === false
        && publication?.published === false && publication?.publicationMode === "PREDICTED_READ_ONLY"
        && validReason && wouldPublishMatchesReason,
      `preview publication prediction is invalid attempt=${attempt}`, saves.at(-1));
      assertOk(/^[0-9a-f]{32}$/.test(String(publication?.contractHash || ""))
        && Number(publication?.versionNo) >= 1 && Number(publication?.bindingCount) >= 1,
      `preview publication identity is incomplete attempt=${attempt}`, saves.at(-1));
    }
  }

  let prediction = null;
  if (previewMode) {
    const predictions = saves.map(({ publication }) => ({
      published: publication?.published,
      wouldPublish: publication?.wouldPublish,
      reason: publication?.reason,
      contractHash: publication?.contractHash,
      versionId: publication?.versionId ?? null,
      versionNo: publication?.versionNo,
      bindingCount: publication?.bindingCount,
      predicted: publication?.predicted,
      applied: publication?.applied,
      publicationMode: publication?.publicationMode,
    }));
    const fingerprints = predictions.map(digest);
    assertOk(new Set(fingerprints).size === 1,
      "preview publication prediction changed across identical read-only attempts",
      { predictions, fingerprints });
    prediction = { ...predictions[0], stable: true, fingerprint: fingerprints[0] };
  }

  const resolved = await request(`/runtime/screens/resolve?${params.toString()}`);
  assertOk(resolved.response.status === 200 && typeof resolved.body === "object", `resolve failed status=${resolved.response.status}`, { resolveMs: resolved.elapsedMs, target });
  assertOk(resolved.elapsedMs <= maxResolveMillis, `resolve too slow elapsedMs=${resolved.elapsedMs} max=${maxResolveMillis}`, { resolveMs: resolved.elapsedMs, target });
  assertOk(resolved.body?.versionNo || resolved.body?.screenKey, "resolve returned no active runtime contract", resolved.body);

  let contractHashAfter = contractHashBefore;
  let runtimeHashAfter = digest(resolved.body);
  if (!previewMode) runtimeHashBefore = runtimeHashAfter;
  if (previewMode) {
    const detailAfter = await request(`/admin/api/system/actor-process/page-development-master/${encodeURIComponent(itemId)}`);
    assertOk(detailAfter.response.status === 200 && typeof detailAfter.body === "object", `post-detail failed status=${detailAfter.response.status}`);
    const contractAfter = (Array.isArray(detailAfter.body.contracts) ? detailAfter.body.contracts : [])
      .find((item) => value(item, "contractId", "contract_id") === contractId);
    assertOk(contractAfter, `post-preview contract missing contractId=${contractId}`);
    contractHashAfter = digest(contractAfter);
    assertOk(contractHashAfter === contractHashBefore, "preview mutated canonical professional contract", { contractHashBefore, contractHashAfter });
    assertOk(runtimeHashAfter === runtimeHashBefore, "preview mutated canonical runtime publication", { runtimeHashBefore, runtimeHashAfter });
  }

  let pageProbe = null;
  if (renderProbe) {
    const page = await request(target.routePath, { redirect: "follow" });
    pageProbe = { status: page.response.status, elapsedMs: page.elapsedMs, html: /<!doctype html/i.test(page.text) };
    assertOk(page.response.status === 200 && pageProbe.html, `render probe failed status=${page.response.status}`, pageProbe);
  }

  console.log(JSON.stringify({
    success: true,
    candidateMode,
    previewMode,
    itemId,
    contractId,
    target,
    loginMs: login.elapsedMs,
    detailMs: detail.elapsedMs,
    saves,
    previewCount: previewMode ? saves.length : 0,
    rolledBack: previewMode,
    prediction,
    contractHashBefore,
    contractHashAfter,
    runtimeHashBefore,
    runtimeHashAfter,
    canonicalStateUnchanged: contractHashBefore === contractHashAfter && runtimeHashBefore === runtimeHashAfter,
    resolveMs: resolved.elapsedMs,
    versionNo: resolved.body?.versionNo,
    screenKey: resolved.body?.screenKey,
    pageProbe,
  }, null, 2));
  } finally {
    if (sessionActive) {
      const logout = await request("/signin/actionLogout", { method: "POST" });
      sessionActive = false;
      assertOk(logout.response.status === 200 && logout.body?.status === "success",
        `logout failed status=${logout.response.status}`);
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    message: error.message,
    evidence: error.evidence || null,
  }, null, 2));
  process.exitCode = 1;
});
