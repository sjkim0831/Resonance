#!/usr/bin/env node
import { stat } from "node:fs/promises";
import process from "node:process";
import { request } from "@playwright/test";

const storageState = String(process.env.FULL_SCREEN_SMOKE_STORAGE_STATE || "");
const baseURL = String(process.env.FULL_SCREEN_SMOKE_BASE_URL || "http://172.16.1.232").replace(/\/$/, "");
if (!storageState) throw new Error("full-screen storage state is required for logout");
const metadata = await stat(storageState);
if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
  throw new Error("full-screen storage state must be a private regular file");
}

const api = await request.newContext({ baseURL, storageState, ignoreHTTPSErrors: true });
try {
  const response = await api.post("/signin/actionLogout", { failOnStatusCode: false, timeout: 10_000 });
  const result = await response.json().catch(() => ({}));
  if (!response.ok() || result?.status !== "success") {
    throw new Error(`full-screen logout failed with HTTP ${response.status()}`);
  }
  process.stdout.write("[full-screen-auth] logout PASS\n");
} finally {
  await api.dispose();
}
