#!/usr/bin/env node

import { readFileSync } from "node:fs";

const [logPath, summaryPath] = process.argv.slice(2);
if (!logPath || !summaryPath) process.exit(2);

try {
  const log = readFileSync(logPath, "utf8");
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const transportClosed =
    /Target page, context or browser has been closed/.test(log) ||
    /Object with guid .* was not bound in the connection/.test(log);
  const deterministicFailures = Math.max(
    Array.isArray(summary.failures) ? summary.failures.length : 0,
    Number(summary.failedRouteCount || 0),
  );
  process.exit(transportClosed && deterministicFailures === 0 ? 0 : 1);
} catch {
  process.exit(1);
}
