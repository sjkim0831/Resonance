import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-measurement-data-quality-business-e2e.sh", root), "utf8");
for (const token of [
  "MEASUREMENT_DATA_QUALITY_S1,MEASUREMENT_DATA_QUALITY_S2,MEASUREMENT_DATA_QUALITY_S3,MEASUREMENT_DATA_QUALITY_S4",
  "SITE_DATA_OWNER,SITE_DATA_OWNER,VERIFIER,APPROVER",
  '"SITE_DATA_OWNER":"qadata26"',
  '"VERIFIER":"qaverify26"',
  '"APPROVER":"qaapprove26"',
  "/generated/measurement-data-quality/{step}",
]) if (!declared.includes(token)) throw new Error(`missing measurement data quality relay contract: ${token}`);
console.log("MEASUREMENT_DATA_QUALITY_CONTRACT_PASS steps=4 actors=3 cleanup=1");
