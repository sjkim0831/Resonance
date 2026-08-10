#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.env.RESONANCE_ROOT || process.cwd());
const file = path.join(root, "apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260810130000__separate_planned_design_routes_from_runtime.sql");
const sql = fs.readFileSync(file, "utf8");
const required = [
  "framework_guard_planned_screen_resource",
  "framework_guard_planned_step_binding",
  "NEW.implementation_status := 'DESIGN_ONLY'",
  "NEW.binding_status := 'DRAFT'",
  "NEW.contract_status := 'DESIGNED'",
  "PLANNED_RUNTIME_SEPARATION_FAILED",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`missing planned/runtime guard: ${token}`);
}
if (!sql.includes("BEFORE INSERT OR UPDATE OF route_key,implementation_status")) {
  throw new Error("screen resource recurrence guard is missing");
}
if (!sql.includes("BEFORE INSERT OR UPDATE OF screen_resource_id,binding_status,contract_status")) {
  throw new Error("step binding recurrence guard is missing");
}
console.log("PLANNED_RUNTIME_SEPARATION_CONTRACT_PASS guards=2 states=2");
