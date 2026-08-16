import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { deterministicUuid, directStepChain, httpObservationExact, selectAccounts, sha256 }
  from "../scripts/resonance-composite-live-smoke-e2e.mjs";
import { relayDeclaredProcessPrerequisites } from "../scripts/lib/declared-process-relay-runtime.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=relative=>readFileSync(path.join(root,relative),"utf8");
const runner=read("ops/scripts/resonance-composite-live-smoke-e2e.mjs");
const queue=read("ops/scripts/run-composite-live-smoke.sh");
const probe=read("ops/scripts/composite-live-smoke-db-probe.sh");
const migration=read("apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816154000__compile_composite_executable_design_authority.sql");
const worker=read("modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeDesignOperationalWorker.java");
const deploy=read("ops/scripts/auto-deploy-main.sh");
const processWorker=read("ops/scripts/run-process-development-worker.sh");
const page=read("projects/carbonet-frontend/source/src/features/generated-screen/GeneratedScreenPage.tsx");
const shared=read("ops/scripts/lib/declared-process-relay-runtime.mjs");
const generator=read("ops/scripts/generate-spring-api-from-design.py");
const evidenceService=read("modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeLiveSmokeEvidenceService.java");
const physicalEvidence=read("modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositePhysicalEvidenceService.java");
const runnerManifest=JSON.parse(read("ops/runtime-metadata/composite-live-smoke-runner.json"));
const runnerService=read("ops/systemd/resonance-composite-live-smoke.service");
const runtimeDeploy=read("ops/scripts/resonance-k8s-build-deploy-80-v2.sh");

assert.notEqual(sha256(Buffer.from("HTTP 200\nactual-body")),sha256(Buffer.from("HTTP 200\nsynthetic-body")));
assert.notEqual(sha256(Buffer.from("postgres-reread-a")),sha256(Buffer.from("postgres-reread-b")));
assert.notEqual(sha256(Buffer.from("png-actual")),sha256(Buffer.from("png-mutant")));
assert.match(deterministicUuid("dispatch|scenario"),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const relayCalls=[];
const relayed=await relayDeclaredProcessPrerequisites({
  steps:[{stepOrder:3,stepCode:"STEP_C"},{stepOrder:1,stepCode:"STEP_A"},{stepOrder:2,stepCode:"STEP_B"}],
  targetStepCode:"STEP_C",
  startExecution:async step=>({executionId:"00000000-0000-4000-8000-000000000001",currentStepCode:step.stepCode}),
  executeStep:async ({step,next})=>{ relayCalls.push(step.stepCode); return {
    nextStepCode:next.stepCode,setupReceiptHash:sha256(`${step.stepCode}|${next.stepCode}`) }; },
});
assert.deepEqual(relayCalls,["STEP_A","STEP_B"]);
assert.equal(relayed.currentStepCode,"STEP_C");
assert.equal(relayed.setupTransitions.length,2);
await assert.rejects(()=>relayDeclaredProcessPrerequisites({
  steps:[{stepOrder:1,stepCode:"STEP_A"},{stepOrder:2,stepCode:"STEP_B"}],targetStepCode:"STEP_B",
  startExecution:async()=>({executionId:"00000000-0000-4000-8000-000000000001",currentStepCode:"STEP_A"}),
  executeStep:async()=>({nextStepCode:"STALE_STEP"}),
}),/DECLARED_RELAY_NEXT_STEP_MISMATCH/);
const accountPlan={eligibleAssignments:[
  {authorityId:7,actorCode:"ACTOR",tenantId:"T",projectId:"P1",accountId:"alpha",assignmentCount:1},
  {authorityId:7,actorCode:"ACTOR",tenantId:"T",projectId:"P1",accountId:"chosen",assignmentCount:1},
  {authorityId:7,actorCode:"ACTOR",tenantId:"T",projectId:"P2",accountId:"chosen",assignmentCount:1},
  {authorityId:7,actorCode:"ACTOR",tenantId:"T",projectId:"P1",accountId:"denied",assignmentCount:0},
]};
const chosen=selectAccounts(accountPlan,{ACTOR:"chosen","FORBIDDEN:ACTOR":"denied"},
  {authorityId:7},"ACTOR","FORBIDDEN",{tenantId:"T",projectId:"P1"});
assert.equal(chosen.preparation.accountId,"chosen");
assert.equal(chosen.command.accountId,"denied");
const directAuthorities=[
  {authorityId:1,processCode:"PROC",stepCode:"S1",stepOrder:1,audience:"USER",directIdentity:true},
  {authorityId:2,processCode:"PROC",stepCode:"S1",stepOrder:1,audience:"ADMIN",directIdentity:true},
  {authorityId:3,processCode:"PROC",stepCode:"S2",stepOrder:2,audience:"USER",directIdentity:true},
  {authorityId:4,processCode:"PROC",stepCode:"S2",stepOrder:2,audience:"ADMIN",directIdentity:true},
];
assert.deepEqual(directStepChain(directAuthorities,directAuthorities[2]).map(row=>row.authorityId),[1,3]);
assert.throws(()=>directStepChain([...directAuthorities,
  {authorityId:5,processCode:"PROC",stepCode:"S1",stepOrder:1,audience:"USER",directIdentity:true}],
  directAuthorities[2]),/DIRECT_STEP_IDENTITY_NOT_EXACT/);
for(const [status,http,body,expected] of [
  ["SUCCESS",200,{success:true,idempotent:false},true],
  ["SUCCESS",201,{success:true,idempotent:false},false],
  ["VALIDATION_ERROR",400,{success:false,code:"INVALID_REQUEST",message:"Request failed"},true],
  ["VALIDATION_ERROR",422,{success:false,code:"INVALID_REQUEST",message:"Request failed"},false],
  ["FORBIDDEN",403,{success:false,code:"ACCESS_DENIED",message:"Access denied"},true],
  ["FORBIDDEN",401,{success:false,code:"ACCESS_DENIED",message:"Access denied"},false],
  ["CONFLICT",409,{success:false,code:"CONFLICT",message:"conflict"},true],
  ["RECOVERY",200,{success:true,idempotent:true,recovered:true},true],
  ["RECOVERY",200,{success:true,idempotent:true,recovered:false},false],
]) assert.equal(httpObservationExact(status,http,body),expected,`${status}/${http}`);

for(const token of ["integrated_design_live_smoke_dispatch","authority_revision_set_hash",
  "runtime_commit","runtime_identity_hash",
  "UNIQUE(job_id,authority_revision_set_hash,runtime_identity_hash,canary_attempt)",
  "BEFORE UPDATE OR DELETE",
  "COMPOSITE_LIVE_SMOKE_DISPATCH_DELETE_FORBIDDEN","ix_integrated_design_live_smoke_dispatch_due"])
  assert.ok(migration.includes(token),`migration token missing ${token}`);
for(const token of ["for update skip locked","lease_token='$lease_token'::uuid",
  "'leaseToken',dispatch.lease_token::text",
  "status='EVIDENCE_SUBMITTED'","status='RETRY_WAIT'","DEAD_LETTER",
  "framework_composite_authority_revision_set_hash(job_id)"])
  assert.ok(queue.toLowerCase().includes(token.toLowerCase()),`queue token missing ${token}`);
assert.ok(!queue.includes("password="));
assert.ok(probe.includes("repeatable read read only"));
assert.ok(probe.includes("execution_status,current_state"));
assert.ok(!probe.includes("event_status"));
assert.ok(!probe.includes("framework_process_work_draft where execution_id"));
assert.ok(!probe.includes("string_agg(md5(to_jsonb"),"whole-table hashing is forbidden");
assert.ok(runner.includes("DB_POSTCONDITION_MAPPING_REQUIRED"));
assert.ok(runner.includes('"/home/api/process-executions/start"'));
assert.ok(runner.includes('"/home/api/process-executions/draft"'));
assert.ok(runner.includes("relayDeclaredProcessPrerequisites"));
assert.ok(queue.includes("'directIdentity',direct_identity"));
assert.ok(queue.includes("'stepOrder',step_order"));
assert.ok(runner.includes("EXECUTION_ORDER"));
assert.ok(runner.includes('targetRef: "entity:framework_process_execution"'));
for(const token of ["dispatchId: Number(plan.dispatchId)", "leaseToken, jobId", "executionId: execution.executionId", "idempotencyKey,",
  "observedHttpStatus: response.status()", "runtimeObserved: browser.state.runtimeObserved",
  "accessDenied: browser.state.accessDenied", "page.waitForResponse", "fillScenarioInputs",
  "domArtifactRef", "screenshotArtifactRef", "writeImmutableArtifact"])
  assert.ok(runner.includes(token),`runner observation missing ${token}`);
assert.ok(runner.includes("BROWSER_CONTEXT_OBSERVATION_MISMATCH"));
assert.ok(runner.includes("page.screenshot({ fullPage: true })"));
assert.ok(runner.includes('headers: { "X-Resonance-Token": opsToken }'));
assert.ok(page.includes("data-runtime-observed={runtimeObserved?\"true\":\"false\"}"));
assert.ok(page.includes("data-access-denied={accessDenied?\"true\":\"false\"}"));
for(const attribute of ["data-execution-id","data-current-state","data-tenant-id","data-project-id",
  "data-live-smoke-run-id","data-route-path","data-live-smoke-watermark","data-watermark-bit"])
  assert.ok(page.includes(attribute),`browser authority attribute missing ${attribute}`);
for(const attribute of ["data-last-command-code","data-last-http-status","data-last-status-case",
  "data-last-output-json","data-last-idempotency-key","data-live-smoke-action","data-command-code",
  "apiMethod","apiPath"])
  assert.ok(page.includes(attribute),`browser command observation missing ${attribute}`);
for(const token of ["LinkOption.NOFOLLOW_LINKS","LIVE_SMOKE_ARTIFACT_SYMLINK_FORBIDDEN",
  "LIVE_SMOKE_ARTIFACT_HASH_MISMATCH","LIVE_SMOKE_ARTIFACT_WRITABLE_FORBIDDEN",
  "LIVE_SMOKE_RUN_DISPATCH_BINDING_NOT_EXACT","verifyDomArtifact","verifyPngArtifact",
  "SecureDirectoryStream","LIVE_SMOKE_SECURE_DIRECTORY_STREAM_REQUIRED",
  "sameFileAttributes","pinned.attributes()",
  "LIVE_SMOKE_SCREENSHOT_PNG_SIGNATURE_INVALID","LIVE_SMOKE_SCREENSHOT_WATERMARK_NOT_EXACT",
  "domArtifactRef","screenshotArtifactRef",
  "MessageDigest.getInstance(\"SHA-256\")"])
  assert.ok(evidenceService.includes(token),`server artifact verifier missing ${token}`);
for(const token of ["verifyArtifact(evidenceRoot","verifyDomArtifact(dom","verifyPngArtifact(screenshot",
  "dispatch.status='EVIDENCE_SUBMITTED'","LIVE_SMOKE_TEST_PENDING"])
  assert.ok(physicalEvidence.includes(token),`finalizer browser reverify missing ${token}`);
const exactEvidenceRoot=`/opt/resonance-data/control-plane/${runnerManifest.evidenceDirectory}`;
assert.ok(evidenceService.includes(exactEvidenceRoot),"server/runner evidence root diverges");
assert.ok(runnerService.includes("Environment=RESONANCE_ROOT=/opt/Resonance"),"systemd runner root diverges");
assert.ok(runner.includes("CARBONET_COMPOSITE_LIVE_SMOKE_EVIDENCE_ROOT"),
  "runner controlled evidence-root override missing");
assert.ok(queue.includes(`STATE_ROOT="\${CARBONET_COMPOSITE_LIVE_SMOKE_STATE_ROOT:-${exactEvidenceRoot}}"`),
  "queue state root diverges");
assert.ok(queue.includes('CARBONET_COMPOSITE_LIVE_SMOKE_EVIDENCE_ROOT="$STATE_ROOT"'),
  "queue does not bind runner artifact root");
for(const token of [exactEvidenceRoot,'composite-live-smoke-evidence',
  'RESONANCE_COMPOSITE_LIVE_SMOKE_EVIDENCE_ROOT','readOnly\\":true',
  'install -d -m 0750 -o 1000 -g 1000'])
  assert.ok(runtimeDeploy.includes(token),`runtime evidence mount missing ${token}`);
for(const token of ["domArtifactRef","screenshotArtifactRef","artifactReferenceExact"])
  assert.ok(physicalEvidence.includes(token),`physical artifact reconciliation missing ${token}`);
assert.ok(shared.includes('body?.status !== "loginSuccess"'));
assert.ok(shared.includes("body?.userId"));
assert.ok(generator.includes("catch(IllegalStateException conflict)"));
assert.ok(generator.includes("ResponseEntity.status(409)"));
assert.ok(worker.includes("current_authority.authority_revision=smoke.authority_revision"));
assert.ok(worker.includes("status='COMPLETED'"));
assert.ok(processWorker.indexOf("wake_composite_live_smoke_postdeploy") < processWorker.lastIndexOf("finalize_canonical_generation"));
for(const token of ["run-composite-live-smoke.sh","resonance-composite-live-smoke.service",
  "resonance-composite-live-smoke.timer","systemctl enable --now"])
  assert.ok(deploy.includes(token),`deploy hook missing ${token}`);

console.log("COMPOSITE_LIVE_SMOKE_RUNNER_PASS statuses=5 lanes=3 prerequisiteSteps=2 explicitAccounts=2 durableQueue=1 browserCommand=1 artifactServerRehash=1 browserContextAxes=11 deployHook=1");
