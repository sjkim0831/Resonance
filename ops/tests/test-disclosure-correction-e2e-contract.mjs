import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-disclosure-correction-business-e2e.sh", root), "utf8");
for (const token of [
  "DISCLOSURE_CORRECTION_S1,DISCLOSURE_CORRECTION_S2,DISCLOSURE_CORRECTION_S3,DISCLOSURE_CORRECTION_S4",
  "CALCULATOR,CALCULATOR,VERIFIER,APPROVER",
  '"CALCULATOR":"qacalc26"',
  '"VERIFIER":"qaverify26"',
  '"APPROVER":"qaapprove26"',
  "/generated/disclosure-correction/{step}",
]) if (!declared.includes(token)) throw new Error(`missing disclosure correction relay contract: ${token}`);
console.log("DISCLOSURE_CORRECTION_CONTRACT_PASS steps=4 actors=3 cleanup=1");
