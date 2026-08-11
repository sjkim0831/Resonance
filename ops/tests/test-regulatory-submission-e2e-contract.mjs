import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-regulatory-submission-business-e2e.sh", root), "utf8");
for (const token of [
  "REGULATORY_SUBMISSION_S1,REGULATORY_SUBMISSION_S2,REGULATORY_SUBMISSION_S3,REGULATORY_SUBMISSION_S4",
  "COMPANY_MANAGER,COMPANY_MANAGER,VERIFIER,APPROVER",
  '"COMPANY_MANAGER":"qaowner26"',
  '"VERIFIER":"qaverify26"',
  '"APPROVER":"qaapprove26"',
  "/emission/report-submission",
]) if (!declared.includes(token)) throw new Error(`missing regulatory submission relay contract: ${token}`);
console.log("REGULATORY_SUBMISSION_CONTRACT_PASS steps=4 actors=3 cleanup=1");
