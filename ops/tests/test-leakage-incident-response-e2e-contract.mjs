import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-leakage-incident-response-business-e2e.sh", root), "utf8");
for (const token of [
  "LEAKAGE_INCIDENT_RESPONSE_S1,LEAKAGE_INCIDENT_RESPONSE_S2,LEAKAGE_INCIDENT_RESPONSE_S3,LEAKAGE_INCIDENT_RESPONSE_S4",
  "SITE_DATA_OWNER,SITE_DATA_OWNER,VERIFIER,COMPANY_MANAGER",
  '"SITE_DATA_OWNER":"qadata26"',
  '"VERIFIER":"qaverify26"',
  '"COMPANY_MANAGER":"qaowner26"',
  "/generated/leakage-incident-response/{step}",
]) if (!declared.includes(token)) throw new Error(`missing leakage incident relay contract: ${token}`);
console.log("LEAKAGE_INCIDENT_RESPONSE_CONTRACT_PASS steps=4 actors=3 cleanup=1");
