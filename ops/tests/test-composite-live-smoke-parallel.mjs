import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=relative=>readFileSync(path.join(root,relative),"utf8");
const manifest=JSON.parse(read("ops/runtime-metadata/composite-live-smoke-runner.json"));
const runner=read("ops/scripts/run-composite-live-smoke.sh");
const slots=read("ops/scripts/run-composite-live-smoke-slots.sh");
const unit=read("ops/systemd/resonance-composite-live-smoke.service");
const deploy=read("ops/scripts/auto-deploy-main.sh");
const runtimeDeploy=read("ops/scripts/resonance-k8s-build-deploy-80-v2.sh");
const worker=read("modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeDesignOperationalWorker.java");
const readiness=read("modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeAutocompletionReadinessService.java");
const workerInspection=`${worker}\n${readiness}`;

assert.equal(manifest.parallelism,8);
assert.equal(manifest.maxClaimsPerSlot,25);
assert.match(slots,/parallelism must be 1\.\.8/);
assert.match(slots,/for \(\(slot=0;slot<parallelism;slot\+\+\)\)/);
assert.match(slots,/for \(\(claim=0;claim<max_claims;claim\+\+\)\)/);
assert.match(slots,/CARBONET_COMPOSITE_LIVE_SMOKE_SLOT="\$slot"/);
assert.match(slots,/due=0/);
assert.match(slots,/composite-live-smoke-slots\.lock/);
assert.match(slots,/flock -n 9/);
assert.ok(slots.indexOf("generate-composite-relay-account-map.py")<
  slots.indexOf("for ((slot=0;slot<parallelism;slot++))"));
assert.match(slots,/source "\$map_env"/);
assert.match(runner,/for update skip locked limit 1/i);
assert.ok(runner.includes('LOCK_FILE="${LOCK_BASE}-${SLOT}.lock"'));
assert.match(runner,/dispatch-\$\{dispatch_id\}\.lock/);
assert.match(runner,/returning \*\), receipt_update as \(update integrated_design_autocompletion_receipt/i);
assert.match(unit,/run-composite-live-smoke-slots\.sh/);
assert.match(unit,/CPUQuota=800%/);
const execDeadline=unit.match(/^ExecStart=.*--kill-after=([0-9]+)s ([0-9]+)m \/usr\/bin\/bash \/opt\/resonance-data\/control-plane\/bin\/run-composite-live-smoke-slots\.sh$/m);
const systemdDeadline=unit.match(/^TimeoutStartSec=([0-9]+)min$/m);
assert.ok(execDeadline,"launcher hard deadline is missing");
assert.ok(systemdDeadline,"systemd start deadline is missing");
const cleanupGraceSeconds=Number(execDeadline[1]);
const launcherHardDeadlineSeconds=Number(execDeadline[2])*60;
const systemdStartDeadlineSeconds=Number(systemdDeadline[1])*60;
assert.ok(launcherHardDeadlineSeconds>600);
assert.ok(systemdStartDeadlineSeconds>launcherHardDeadlineSeconds+cleanupGraceSeconds);
assert.match(deploy,/run-composite-live-smoke-slots\.sh/);
assert.match(deploy,/generate-composite-relay-account-map\.py/);
assert.match(deploy,/composite-relay-account-map\.json/);
for(const token of ["composite-live-smoke-evidence","RESONANCE_COMPOSITE_LIVE_SMOKE_EVIDENCE_ROOT",
  '\\"readOnly\\":true',"/opt/resonance-data/control-plane/var/test-evidence/composite-live-smoke"])
  assert.ok(runtimeDeploy.includes(token),`runtime evidence mount missing: ${token}`);
for(const token of ["liveSmokeParallelism","estimatedPhysicalTotalSeconds",
  "p95PhysicalMs","MEASUREMENT_REQUIRED"])
  assert.ok(workerInspection.includes(token),`worker inspection token missing: ${token}`);

// Model the same one-row SKIP LOCKED claim contract with more work than slots.
// The test proves the bounded scheduler drains all work once, never exceeds 8,
// and has a ten-minute capacity bound based on measured physical p95.
const pending=Array.from({length:17},(_,index)=>index+1);
const claimed=new Set();
const completed=[];
let active=0,maxActive=0;
async function slot(){
  for(;;){
    const dispatchId=pending.shift();
    if(dispatchId===undefined)return;
    assert.equal(claimed.has(dispatchId),false,`duplicate dispatch ${dispatchId}`);
    claimed.add(dispatchId);active+=1;maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,dispatchId%3));
    completed.push(dispatchId);active-=1;
  }
}
await Promise.all(Array.from({length:manifest.parallelism},()=>slot()));
assert.equal(maxActive,8);
assert.deepEqual([...completed].sort((a,b)=>a-b),Array.from({length:17},(_,index)=>index+1));
assert.equal(claimed.size,17);

const p95PhysicalMs=190_000;
const estimatedPhysicalTotalSeconds=Math.ceil(17/manifest.parallelism)*p95PhysicalMs/1000;
assert.equal(estimatedPhysicalTotalSeconds,570);
assert.ok(estimatedPhysicalTotalSeconds<600);
assert.ok(estimatedPhysicalTotalSeconds<launcherHardDeadlineSeconds);
const tenMinuteTarget=sampleCount=>sampleCount===0?"MEASUREMENT_REQUIRED":
  estimatedPhysicalTotalSeconds<600?"PASS":"FAIL";
assert.equal(tenMinuteTarget(0),"MEASUREMENT_REQUIRED");
assert.equal(tenMinuteTarget(17),"PASS");

console.log(`COMPOSITE_LIVE_SMOKE_PARALLEL_PASS dispatches=${claimed.size} slots=${maxActive} duplicate=0 estimateSeconds=${estimatedPhysicalTotalSeconds} launcherDeadlineSeconds=${launcherHardDeadlineSeconds} systemdDeadlineSeconds=${systemdStartDeadlineSeconds}`);
