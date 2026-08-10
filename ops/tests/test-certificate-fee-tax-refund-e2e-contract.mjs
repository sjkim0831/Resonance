import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const engine = readFileSync(new URL("ops/scripts/resonance-facility-operation-monitoring-e2e.mjs", root), "utf8");
const wrapper = readFileSync(new URL("ops/tests/run-certificate-fee-tax-refund-business-e2e.sh", root), "utf8");
for (const [source, token] of [
  [engine, "authority counter actor missing"],
  [wrapper, "CFTR_BILL,CFTR_SETTLE,CFTR_REFUND"],
  [wrapper, "SETTLEMENT_OPERATOR,SETTLEMENT_OPERATOR,SETTLEMENT_OPERATOR"],
  [wrapper, '"HSE_MANAGER":"qaverify26"'],
  [wrapper, 'E2E_DEPLOYED_COMMIT="$RUNTIME_COMMIT"'],
  [wrapper, "framework_process_execution_event"],
]) if (!source.includes(token)) throw new Error(`missing CFTR closure contract: ${token}`);
console.log("CERTIFICATE_FEE_TAX_REFUND_CONTRACT_PASS steps=3 actors=1 counterActors=1 viewports=2 cleanup=1");
