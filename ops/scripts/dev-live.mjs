#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const BACKEND_WATCH_DIRS = [
  path.join(ROOT, "src", "main", "java"),
  path.join(ROOT, "src", "main", "resources")
];
const BACKEND_PORT = process.env.DEV_BACKEND_PORT || "18001";
const DB_URL = process.env.DEV_DB_URL || "jdbc:cubrid:localhost:33000:carbonet:::?charset=UTF-8";
const POLL_INTERVAL_MS = 1500;

let backendProcess = null;
let frontendWatchProcess = null;
let compileProcess = null;
let rerunCompile = false;
let lastBackendFingerprint = "";
let shuttingDown = false;

function log(message) {
  process.stdout.write(`[dev-live] ${message}\n`);
}

function warn(message) {
  process.stderr.write(`[dev-live] ${message}\n`);
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "target" || entry.name === ".git") {
        continue;
      }
      files.push(...listFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function buildFingerprint(directories) {
  const rows = [];
  for (const directory of directories) {
    for (const file of listFiles(directory)) {
      try {
        const stats = fs.statSync(file);
        rows.push(`${file}:${stats.mtimeMs}:${stats.size}`);
      } catch {
        // Ignore transient file access while editors write.
      }
    }
  }
  rows.sort();
  return rows.join("|");
}

function killPortIfOccupied(port) {
  const lookup = spawnSync("bash", ["-lc", `ss -ltnp '( sport = :${port} )' | sed -n '2p'`], {
    cwd: ROOT,
    encoding: "utf-8"
  });
  const line = lookup.stdout.trim();
  if (!line) {
    return;
  }
  const match = line.match(/pid=(\d+)/);
  if (!match) {
    warn(`port ${port} is in use but pid could not be parsed`);
    return;
  }
  const pid = match[1];
  log(`stopping process on port ${port} (pid ${pid})`);
  spawnSync("kill", ["-9", pid], { cwd: ROOT, stdio: "inherit" });
}

function startFrontendWatcher() {
  log("starting frontend build watcher -> target/classes/static/react-migration");
  frontendWatchProcess = spawn("npm", ["run", "build", "--", "--watch"], {
    cwd: FRONTEND_DIR,
    env: {
      ...process.env,
      VITE_BUILD_TARGET: "classes"
    },
    stdio: "inherit"
  });
  frontendWatchProcess.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    warn(`frontend watcher exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
  });
}

function startBackend() {
  killPortIfOccupied(BACKEND_PORT);
  log(`starting spring-boot:run on port ${BACKEND_PORT}`);
  backendProcess = spawn(
    "mvn",
    ["spring-boot:run"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SERVER_PORT: BACKEND_PORT,
        SPRING_DATASOURCE_URL: DB_URL
      },
      stdio: "inherit"
    }
  );
  backendProcess.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    warn(`spring-boot:run exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
  });
}

function queueCompile() {
  if (compileProcess) {
    rerunCompile = true;
    return;
  }
  log("backend source change detected -> mvn compile");
  compileProcess = spawn("mvn", ["-q", "-DskipTests", "compile"], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit"
  });
  compileProcess.on("exit", (code) => {
    compileProcess = null;
    if (code !== 0) {
      warn(`mvn compile failed with code ${code}`);
    }
    if (rerunCompile) {
      rerunCompile = false;
      queueCompile();
    }
  });
}

function startBackendPoller() {
  lastBackendFingerprint = buildFingerprint(BACKEND_WATCH_DIRS);
  setInterval(() => {
    if (shuttingDown) {
      return;
    }
    const nextFingerprint = buildFingerprint(BACKEND_WATCH_DIRS);
    if (nextFingerprint === lastBackendFingerprint) {
      return;
    }
    lastBackendFingerprint = nextFingerprint;
    queueCompile();
  }, POLL_INTERVAL_MS);
}

function shutdown() {
  shuttingDown = true;
  log("shutting down dev-live");
  if (compileProcess && compileProcess.pid) {
    compileProcess.kill("SIGTERM");
  }
  if (frontendWatchProcess && frontendWatchProcess.pid) {
    frontendWatchProcess.kill("SIGTERM");
  }
  if (backendProcess && backendProcess.pid) {
    backendProcess.kill("SIGTERM");
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

log(`backend port: ${BACKEND_PORT}`);
log("tip: keep carbonet.service off while using this dev runner");
startFrontendWatcher();
startBackend();
startBackendPoller();
