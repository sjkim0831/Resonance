import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-comparative-assertion-review-business-e2e.sh", root), "utf8");
for (const token of [
  "COMPARATIVE_ASSERTION_REVIEW_S1,COMPARATIVE_ASSERTION_REVIEW_S2,COMPARATIVE_ASSERTION_REVIEW_S3,COMPARATIVE_ASSERTION_REVIEW_S4",
  "LCA_PRACTITIONER,LCA_PRACTITIONER,VERIFIER,APPROVER",
  '"LCA_PRACTITIONER":"qacalc26"',
  '"VERIFIER":"qaverify26"',
  '"APPROVER":"qaapprove26"',
  "/generated/comparative-assertion-review/{step}",
]) if (!declared.includes(token)) throw new Error(`missing comparative assertion relay contract: ${token}`);
console.log("COMPARATIVE_ASSERTION_REVIEW_CONTRACT_PASS steps=4 actors=3 cleanup=1");
