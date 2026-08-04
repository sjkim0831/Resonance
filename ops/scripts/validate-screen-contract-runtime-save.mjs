#!/usr/bin/env node
import process from "node:process";

const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const userId = String(process.env.CARBONET_VALIDATE_USER || "");
const userPw = String(process.env.CARBONET_VALIDATE_PASSWORD || "");
const userSe = String(process.env.CARBONET_VALIDATE_USER_SE || "USR");
const loginPath = String(process.env.CARBONET_VALIDATE_LOGIN_PATH || "/admin/login/actionLogin");
const itemId = String(process.env.CARBONET_SCREEN_CONTRACT_ITEM_ID || "26");
const maxSaveMillis = Number(process.env.CARBONET_SCREEN_CONTRACT_SAVE_MAX_MS || "2000");
const maxResolveMillis = Number(process.env.CARBONET_SCREEN_CONTRACT_RESOLVE_MAX_MS || "1000");
const renderProbe = !["0", "false", "no"].includes(String(process.env.CARBONET_SCREEN_CONTRACT_RENDER_PROBE || "1").toLowerCase());

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
  const login = await request(loginPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, userPw, userSe }),
  });
  assertOk(login.response.status === 200, `login failed status=${login.response.status}`, { loginMs: login.elapsedMs });
  if (typeof login.body === "object" && login.body?.status === "loginFailure") {
    throw new Error("login rejected by application");
  }

  const detail = await request(`/admin/api/system/actor-process/page-development-master/${encodeURIComponent(itemId)}`);
  assertOk(detail.response.status === 200 && typeof detail.body === "object", `detail failed status=${detail.response.status}`, { detailMs: detail.elapsedMs });
  const contracts = Array.isArray(detail.body.contracts) ? detail.body.contracts : [];
  assertOk(contracts.length > 0, `no professional contracts found for itemId=${itemId}`);
  const contract = contracts[0];
  const contractId = value(contract, "contractId", "contract_id");
  assertOk(contractId, "contractId missing from detail response");

  const payload = { ...contract, contractId };
  const saves = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const saved = await request("/admin/api/system/actor-process/professional-screen-contracts", {
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
    });
    assertOk(saved.response.status === 200 && saved.body?.success === true, `save failed attempt=${attempt} status=${saved.response.status}`, saves.at(-1));
    assertOk(saved.elapsedMs <= maxSaveMillis, `save too slow attempt=${attempt} elapsedMs=${saved.elapsedMs} max=${maxSaveMillis}`, saves.at(-1));
    assertOk(saved.body?.runtimePublication?.contractId !== undefined, `runtime publication missing attempt=${attempt}`, saves.at(-1));
    assertOk(automation?.buildRequired === false, `save requested build attempt=${attempt}`, saves.at(-1));
    assertOk(automation?.fullGenerationDeferred === true, `full generation was not deferred attempt=${attempt}`, saves.at(-1));
  }

  const target = pickResolveTarget(detail.body, contract);
  assertOk(target.routePath && target.processCode && target.stepCode && target.audience, "resolve target incomplete", target);
  const params = new URLSearchParams(target);
  const resolved = await request(`/runtime/screens/resolve?${params.toString()}`);
  assertOk(resolved.response.status === 200 && typeof resolved.body === "object", `resolve failed status=${resolved.response.status}`, { resolveMs: resolved.elapsedMs, target });
  assertOk(resolved.elapsedMs <= maxResolveMillis, `resolve too slow elapsedMs=${resolved.elapsedMs} max=${maxResolveMillis}`, { resolveMs: resolved.elapsedMs, target });
  assertOk(resolved.body?.versionNo || resolved.body?.screenKey, "resolve returned no active runtime contract", resolved.body);

  let pageProbe = null;
  if (renderProbe) {
    const page = await request(target.routePath, { redirect: "follow" });
    pageProbe = { status: page.response.status, elapsedMs: page.elapsedMs, html: /<!doctype html/i.test(page.text) };
    assertOk(page.response.status === 200 && pageProbe.html, `render probe failed status=${page.response.status}`, pageProbe);
  }

  console.log(JSON.stringify({
    success: true,
    itemId,
    contractId,
    target,
    loginMs: login.elapsedMs,
    detailMs: detail.elapsedMs,
    saves,
    resolveMs: resolved.elapsedMs,
    versionNo: resolved.body?.versionNo,
    screenKey: resolved.body?.screenKey,
    pageProbe,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    message: error.message,
    evidence: error.evidence || null,
  }, null, 2));
  process.exitCode = 1;
});
