#!/usr/bin/env node
import { chmod, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { request } from "@playwright/test";

const output = process.env.FULL_SCREEN_SMOKE_STORAGE_STATE;
const baseURL = String(process.env.FULL_SCREEN_SMOKE_BASE_URL || "http://172.16.1.232").replace(/\/$/, "");
const userId = String(process.env.FULL_SCREEN_SMOKE_ADMIN_USER || "");
const userPw = String(process.env.FULL_SCREEN_SMOKE_ADMIN_PASSWORD || "");
if (!output || !userId || !userPw) {
  console.error("[full-screen-auth] output and admin credentials are required");
  process.exit(2);
}

await mkdir(path.dirname(output), { recursive: true });
const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
try {
  let result;
  for (const userSe of ["USR", "ENT"]) {
    const response = await api.post("/admin/login/actionLogin", {
      data: { userId, userPw, userSe },
      failOnStatusCode: false,
      timeout: 10_000,
    });
    if (!response.ok()) throw new Error(`login HTTP ${response.status()}`);
    result = await response.json();
    if (result?.status !== "loginFailure") break;
  }
  if (result?.status === "loginFailure") throw new Error("admin login rejected");
  const state = await api.storageState({ path: output });
  if (!state.cookies.length) throw new Error("login did not issue session cookies");
  await chmod(output, 0o600);
  process.stdout.write(`[full-screen-auth] prepared cookies=${state.cookies.length}\n`);
} finally {
  await api.dispose();
}
