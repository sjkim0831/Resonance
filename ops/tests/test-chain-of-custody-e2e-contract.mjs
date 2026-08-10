import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-chain-of-custody-business-e2e.sh", root), "utf8");
for (const token of [
  "CHAIN_OF_CUSTODY_S1,CHAIN_OF_CUSTODY_S2,CHAIN_OF_CUSTODY_S3,CHAIN_OF_CUSTODY_S4",
  "SYSTEM_INTEGRATOR,SYSTEM_INTEGRATOR,VERIFIER,APPROVER",
  '"SYSTEM_INTEGRATOR":"qacalc26"',
  '"VERIFIER":"qaverify26"',
  '"APPROVER":"qaapprove26"',
  "/generated/chain-of-custody/{step}",
]) if (!declared.includes(token)) throw new Error(`missing chain of custody relay contract: ${token}`);
console.log("CHAIN_OF_CUSTODY_CONTRACT_PASS steps=4 actors=3 cleanup=1");
