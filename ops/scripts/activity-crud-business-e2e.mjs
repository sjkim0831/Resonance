#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { request } = require("@playwright/test");
const baseURL = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
let projectId = String(process.env.CARBONET_ACTIVITY_TEST_PROJECT || "");
const account = String(process.env.CARBONET_ACTIVITY_TEST_ACCOUNT || "qadata26");
const password = String(process.env.CARBONET_ACTIVITY_TEST_PASSWORD || "");
if (!password) throw new Error("CARBONET_ACTIVITY_TEST_PASSWORD is required");

const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
let activityId = 0;
const marker = `QA CRUD ${Date.now()}`;
async function json(response, label, expected = 200) {
  const body = await response.text();
  if (response.status() !== expected) throw new Error(`${label} HTTP=${response.status()} expected=${expected}`);
  if (!body) return {};
  try { return JSON.parse(body); } catch { throw new Error(`${label} returned non-JSON`); }
}
try {
  const login = await api.post("/signin/actionLogin", {
    data: { userId: account, userPw: password, userSe: "USR" }, failOnStatusCode: false,
  });
  const loginPayload = await json(login, "login");
  if (loginPayload?.status === "loginFailure") throw new Error("login rejected");
  if (!projectId) {
    const portfolio = await json(await api.get("/home/api/emission-projects?size=1", { failOnStatusCode: false }), "project portfolio");
    projectId = String(portfolio?.items?.[0]?.id || "");
    if (!projectId) throw new Error("no accessible emission project for the test account");
  }

  const created = await json(await api.post(`/home/api/emission-projects/${projectId}/activities`, {
    data: { name: marker, category: "ENERGY", period: "2026-08", quantity: "1.25", unit: "MWh", note: "자동 CRUD 검증" },
    failOnStatusCode: false,
  }), "create activity");
  activityId = Number(created.id || 0);
  if (!created.success || activityId <= 0) throw new Error("create activity did not return an id");

  const first = await json(await api.get(`/home/api/emission-projects/${projectId}/activities/${activityId}`, { failOnStatusCode: false }), "read activity");
  if (Number(first.id) !== activityId || first.name !== marker || Number(first.quantity) !== 1.25) throw new Error("created activity readback mismatch");

  const updatedName = `${marker} 수정`;
  const updated = await json(await api.post(`/home/api/emission-projects/${projectId}/activities/${activityId}`, {
    data: { name: updatedName, category: "ENERGY", period: "2026-09", quantity: "2.5", unit: "MWh", note: "자동 CRUD 수정 검증" },
    failOnStatusCode: false,
  }), "update activity");
  if (!updated.success) throw new Error("update activity failed");

  const second = await json(await api.get(`/home/api/emission-projects/${projectId}/activities/${activityId}`, { failOnStatusCode: false }), "read updated activity");
  if (second.name !== updatedName || second.period !== "2026-09" || Number(second.quantity) !== 2.5) throw new Error("updated activity readback mismatch");

  const deleted = await json(await api.delete(`/home/api/emission-projects/${projectId}/activities/${activityId}`, { failOnStatusCode: false }), "delete activity");
  if (!deleted.success) throw new Error("delete activity failed");
  activityId = 0;
  await json(await api.get(`/home/api/emission-projects/${projectId}/activities/${Number(created.id)}`, { failOnStatusCode: false }), "deleted activity lookup", 404);
  console.log(JSON.stringify({ status: "PASS", create: 1, read: 2, update: 1, delete: 1, notFound: 1 }));
} finally {
  if (activityId > 0) {
    await api.delete(`/home/api/emission-projects/${projectId}/activities/${activityId}`, { failOnStatusCode: false }).catch(() => {});
  }
  await api.dispose();
}
