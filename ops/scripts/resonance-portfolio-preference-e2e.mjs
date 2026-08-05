#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { request } = require("@playwright/test");
const baseURL = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const password = String(process.env.CARBONET_ACTOR_TEST_PASSWORD || "");
const account = String(process.env.CARBONET_PORTFOLIO_TEST_ACCOUNT || "qaowner26");
const projectId = String(process.env.CARBONET_ACTOR_TEST_PROJECT || "PRJ-ACTOR-TEST");
if (!password) throw new Error("CARBONET_ACTOR_TEST_PASSWORD is required");

const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
try {
  const login = await api.post("/signin/actionLogin", { data: { userId: account, userPw: password, userSe: "USR" } });
  if (login.status() !== 200) throw new Error(`login failed status=${login.status()}`);
  const endpoint = "/home/api/emission-project-portfolio/preference";
  const beforeResponse = await api.get(endpoint);
  if (beforeResponse.status() !== 200) throw new Error(`preference read failed status=${beforeResponse.status()}`);
  const before = await beforeResponse.json();
  const update = await api.put(endpoint, { data: {
    selectedProjectId: projectId, keyword: "QA-PORTFOLIO", status: "", site: "",
    sortCode: "NAME_ASC", nextTaskCode: "EMISSION_PROJECT_SETUP", version: Number(before.version || 0),
  }});
  if (update.status() !== 200) throw new Error(`preference update failed status=${update.status()} body=${await update.text()}`);
  const saved = await update.json();
  if (saved.selectedProjectId !== projectId || saved.keyword !== "QA-PORTFOLIO" || saved.sortCode !== "NAME_ASC") {
    throw new Error("saved preference does not match request");
  }
  const stale = await api.put(endpoint, { data: { ...saved, keyword: "STALE", version: Number(before.version || 0) } });
  if (stale.status() !== 409) throw new Error(`stale version must return 409 actual=${stale.status()}`);
  const reread = await (await api.get(endpoint)).json();
  if (Number(reread.version) !== Number(saved.version)) throw new Error("persisted version changed after stale write");
  const restore = await api.put(endpoint, { data: {
    selectedProjectId: before.selectedProjectId || "", keyword: before.keyword || "", status: before.status || "",
    site: before.site || "", sortCode: before.sortCode || "UPDATED_DESC", nextTaskCode: before.nextTaskCode || "",
    version: Number(saved.version),
  }});
  if (restore.status() !== 200) throw new Error(`preference restore failed status=${restore.status()}`);
  console.log(JSON.stringify({ status: "PASS", account, projectId, read: 1, write: 1, reread: 1, staleConflict: 1, restore: 1 }));
} finally {
  await api.dispose();
}
