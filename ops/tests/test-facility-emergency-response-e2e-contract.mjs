import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-facility-emergency-response-business-e2e.sh", root), "utf8");
for (const token of [
  "FER_DECLARE,FER_CONTROL,FER_RECOVER",
  "FACILITY_OPERATOR,HSE_MANAGER,HSE_MANAGER",
  '"FACILITY_OPERATOR":"qacalc26"',
  '"HSE_MANAGER":"qaverify26"',
  "/ccus/facility/facility-emergency-response",
  "run-declared-process-relay-e2e.sh",
]) if (!declared.includes(token)) throw new Error(`missing FER relay contract: ${token}`);
console.log("FACILITY_EMERGENCY_RESPONSE_CONTRACT_PASS steps=3 actors=2 cleanup=1");
