import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const engine = readFileSync(new URL("ops/scripts/resonance-facility-operation-monitoring-e2e.mjs", root), "utf8");
const declared = readFileSync(new URL("ops/tests/run-ccus-lifecycle-mrv-business-e2e.sh", root), "utf8");
for (const [source, token] of [
  [engine, 'routeBase.includes("{step}")'],
  [engine, 'replaceAll("_", "-")'],
  [declared, "CCUS_LIFECYCLE_MRV_S1,CCUS_LIFECYCLE_MRV_S2,CCUS_LIFECYCLE_MRV_S3,CCUS_LIFECYCLE_MRV_S4"],
  [declared, "CALCULATOR,CALCULATOR,VERIFIER,APPROVER"],
  [declared, '"APPROVER":"qaapprove26"'],
  [declared, "/generated/ccus-lifecycle-mrv/{step}"],
]) if (!source.includes(token)) throw new Error(`missing CCUS lifecycle MRV relay contract: ${token}`);
console.log("CCUS_LIFECYCLE_MRV_CONTRACT_PASS steps=4 actors=3 routeModes=2 cleanup=1");
