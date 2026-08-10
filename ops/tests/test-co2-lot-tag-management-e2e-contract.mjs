import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-co2-lot-tag-management-business-e2e.sh", root), "utf8");
for (const token of [
  "CLT_CREATE,CLT_RECONCILE,CLT_APPROVE",
  "TRADE_OPERATOR,TRADE_OPERATOR,AUDITOR",
  '"TRADE_OPERATOR":"qacalc26"',
  '"AUDITOR":"qaverify26"',
  "/work/co2-lot-tag-management",
  "run-declared-process-relay-e2e.sh",
]) if (!declared.includes(token)) throw new Error(`missing CLT relay contract: ${token}`);
console.log("CO2_LOT_TAG_MANAGEMENT_CONTRACT_PASS steps=3 actors=2 cleanup=1");
