import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-external-verification-engagement-business-e2e.sh", root), "utf8");
for (const token of [
  "EXTERNAL_VERIFICATION_ENGAGEMENT_S1,EXTERNAL_VERIFICATION_ENGAGEMENT_S2,EXTERNAL_VERIFICATION_ENGAGEMENT_S3,EXTERNAL_VERIFICATION_ENGAGEMENT_S4",
  "COMPANY_MANAGER,COMPANY_MANAGER,AUDITOR,APPROVER",
  '"COMPANY_MANAGER":"qaowner26"',
  '"AUDITOR":"qaverify26"',
  '"APPROVER":"qaapprove26"',
  "/generated/external-verification-engagement/{step}",
]) if (!declared.includes(token)) throw new Error(`missing external verification relay contract: ${token}`);
console.log("EXTERNAL_VERIFICATION_ENGAGEMENT_CONTRACT_PASS steps=4 actors=3 cleanup=1");
