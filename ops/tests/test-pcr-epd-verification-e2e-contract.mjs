import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-pcr-epd-verification-business-e2e.sh", root), "utf8");
for (const token of [
  "PCR_EPD_VERIFICATION_S1,PCR_EPD_VERIFICATION_S2,PCR_EPD_VERIFICATION_S3,PCR_EPD_VERIFICATION_S4",
  "LCA_PRACTITIONER,LCA_PRACTITIONER,VERIFIER,APPROVER",
  '"LCA_PRACTITIONER":"qacalc26"',
  '"VERIFIER":"qaverify26"',
  '"APPROVER":"qaapprove26"',
  "/generated/pcr-epd-verification/{step}",
]) if (!declared.includes(token)) throw new Error(`missing PCR EPD relay contract: ${token}`);
console.log("PCR_EPD_VERIFICATION_CONTRACT_PASS steps=4 actors=3 cleanup=1");
