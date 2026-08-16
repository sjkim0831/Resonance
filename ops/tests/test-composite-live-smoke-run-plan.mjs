import assert from "node:assert/strict";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deterministicUuid, runPlan, sha256 }
  from "../scripts/resonance-composite-live-smoke-e2e.mjs";

const STATUSES=["SUCCESS","VALIDATION_ERROR","FORBIDDEN","CONFLICT","RECOVERY"];
const HTTP={SUCCESS:200,VALIDATION_ERROR:400,FORBIDDEN:403,CONFLICT:409,RECOVERY:200};
const literal=value=>({source:"LITERAL",value});
const from=(source,path)=>({source,path});
const watermarkCells=runId=>Array.from(String(runId).replaceAll("-","")).flatMap(value=>{
  const nibble=Number.parseInt(value,16);return [3,2,1,0].map(shift=>(nibble>>shift)&1);
}).map(bit=>`<span data-watermark-bit="${bit}"></span>`).join("");
const statusBodies={
  SUCCESS:["success","idempotent","eventId","toState","name"],
  VALIDATION_ERROR:["success","code","message"],
  FORBIDDEN:["success","code","message"],
  CONFLICT:["success","code","message"],
  RECOVERY:["success","idempotent","eventId","toState","recovered","name"],
};
function expected(status){
  if(status==="VALIDATION_ERROR")return {success:literal(false),code:literal("INVALID_REQUEST"),message:literal("Request failed")};
  if(status==="FORBIDDEN")return {success:literal(false),code:literal("ACCESS_DENIED"),message:literal("Access denied")};
  if(status==="CONFLICT")return {success:literal(false),code:literal("CONFLICT"),message:literal("Request conflicts with the current state")};
  if(status==="RECOVERY")return {success:literal(true),idempotent:literal(true),eventId:from("REFERENCE_SCENARIO","eventId"),
    toState:from("REFERENCE_SCENARIO","toState"),recovered:literal(true),name:from("REFERENCE_SCENARIO","name")};
  return {success:literal(true),idempotent:literal(false),eventId:from("DATABASE_EVENT","eventId"),
    toState:from("DECLARED_STATE","toState"),name:from("REQUEST","name")};
}
const triggers={
  SUCCESS:{kind:"NEW_COMMAND"},
  VALIDATION_ERROR:{kind:"DECLARED_VALIDATION_FAILURE",fieldCode:"name",errorCode:"NAME_REQUIRED"},
  FORBIDDEN:{kind:"UNASSIGNED_ACTOR"},
  CONFLICT:{kind:"STALE_STATE",state:"DONE",referenceScenarioCode:"SAVE_SUCCESS"},
  RECOVERY:{kind:"IDEMPOTENT_REPLAY",referenceScenarioCode:"SAVE_SUCCESS"},
};
const scenarios=STATUSES.map(status=>({scenarioCode:`SAVE_${status}`,commandCode:"SAVE",
  inputValues:{name:status==="VALIDATION_ERROR"?"":"Alice"},expectedOutputFields:statusBodies[status],
  expectedOutputValues:expected(status),expectedStatus:status,expectedHttpStatus:HTTP[status],
  trigger:triggers[status],assertionCodes:["STATUS_MATCH","OUTPUT_FIELDS_MATCH"]}));
const authority={authorityId:11,authorityRevision:1,processCode:"PROC",stepCode:"STEP_A",stepOrder:1,
  directIdentity:true,routePath:"/work",audience:"USER",sourceHash:"1".repeat(64),authorityHash:"2".repeat(64),
  composite:{executableDesign:{
    PROCESS:{stepOrder:1,commandCode:"SAVE",commands:[{commandCode:"SAVE",actorCode:"ACTOR",primary:true}]},
    STATE:{states:[{commandCode:"SAVE",fromState:"DRAFT",toState:"DONE"}]},
    API:{operations:[{method:"POST",path:"/api/work/{executionId}/save",commandCode:"SAVE",
      requestFields:["name"],responseFields:["name"],permissionCodes:["PERM_SAVE"],
      responseProjection:[{fieldCode:"name",source:"REQUEST",sourcePath:"name"}],
      statusResponses:STATUSES.map(status=>({statusCase:status,httpStatus:HTTP[status],bodyFields:statusBodies[status]}))}]},
    TEST:{scenarios},
  }}};
const plan={schema:"carbonet.composite-live-smoke-plan/v1",dispatchId:91,jobId:55,processCode:"PROC",
  leaseToken:"99999999-9999-4999-8999-999999999999",
  authorityRevisionSetHash:"3".repeat(64),artifactManifestHash:"4".repeat(64),expectedEvidenceCount:15,
  observedAt:new Date().toISOString(),authorities:[authority],existingEvidenceKeys:[],existingScenarioContexts:[],
  eligibleAssignments:[
    {authorityId:11,actorCode:"ACTOR",tenantId:"TENANT",projectId:"PROJECT",accountId:"positive",assignmentCount:1},
    {authorityId:11,actorCode:"ACTOR",tenantId:"TENANT",projectId:"PROJECT",accountId:"denied",assignmentCount:0},
  ]};
const manifest={schema:"carbonet.composite-live-smoke-runner/v1",evidenceDirectory:"evidence",
  evidenceEndpoint:"/ops/api/composite-live-smoke/evidence",timeouts:{requestSeconds:2,databaseSeconds:2,browserSeconds:2}};

function response(status,body,route="/",method="GET"){
  const raw=Buffer.from(JSON.stringify(body));return {
    status:()=>status,body:async()=>raw,headers:()=>({"content-type":"application/json"}),
    url:()=>new URL(route,"http://fixture.invalid").toString(),request:()=>({method:()=>method}),
  };
}
async function verifyArtifact(root,reference,expectedHash,suffix){
  if(!new RegExp(`^[1-9][0-9]*/[0-9a-f-]{36}/[0-9a-f]{64}\\.${suffix.replaceAll(".","\\.")}$`).test(reference))
    throw new Error("ARTIFACT_REFERENCE_INVALID");
  const evidenceRoot=path.resolve(root,manifest.evidenceDirectory),relative=reference.split("/");
  const candidate=path.resolve(evidenceRoot,...relative);
  if(!candidate.startsWith(`${evidenceRoot}${path.sep}`))throw new Error("ARTIFACT_OUTSIDE_ALLOWLIST");
  let cursor=evidenceRoot;
  for(const part of relative){cursor=path.join(cursor,part);const stat=await lstat(cursor);
    if(stat.isSymbolicLink())throw new Error("ARTIFACT_SYMLINK_FORBIDDEN");}
  const bytes=await readFile(candidate),observed=sha256(bytes);
  if(observed!==expectedHash||path.basename(candidate)!==`${observed}.${suffix}`)
    throw new Error("ARTIFACT_HASH_MISMATCH");
}
async function mutateArtifact(root,data,kind){
  if(kind==="traversal")data.laneDetails.domArtifactRef="91/../outside";
  else if(kind==="missing")await unlink(path.resolve(root,manifest.evidenceDirectory,
    ...data.laneDetails.screenshotArtifactRef.split("/")));
  else if(kind==="tamper"){
    const target=path.resolve(root,manifest.evidenceDirectory,...data.laneDetails.domArtifactRef.split("/"));
    await chmod(target,0o600).catch(()=>{});await writeFile(target,"tampered");
  }else if(kind==="symlink"){
    const source=path.resolve(root,"outside-artifacts"),runId="22222222-2222-4222-8222-222222222222";
    await mkdir(source,{recursive:true});
    const original=await readFile(path.resolve(root,manifest.evidenceDirectory,
      ...data.laneDetails.domArtifactRef.split("/")));
    await writeFile(path.join(source,`${data.laneDetails.domHash}.dom.html`),original);
    const dispatch=path.resolve(root,manifest.evidenceDirectory,"91");await mkdir(dispatch,{recursive:true});
    await symlink(source,path.join(dispatch,runId),process.platform==="win32"?"junction":"dir");
    data.laneDetails.domArtifactRef=`91/${runId}/${data.laneDetails.domHash}.dom.html`;
  }
}
function fixture(root,{mutantHttp=false,artifactMutant="",wrongCommand=false}={}){
  let sequence=0,mutated=false;
  const executions=new Map(),drafts=new Map(),submissions=[],uiActions=[];
  const apiFor=account=>({
    async fetch(route,{method,data}){
      if(route==="/home/api/process-executions/start"&&method==="POST"){
        const executionId=deterministicUuid(`fixture-execution-${++sequence}`);
        executions.set(executionId,{executionId,currentStepCode:"STEP_A",currentState:"DRAFT",events:[]});
        return response(200,{execution:{executionId,currentStepCode:"STEP_A"}},route,method);
      }
      if(route.startsWith("/home/api/process-executions/draft?")&&method==="GET"){
        const draft=drafts.get(account)||{draftVersion:0,draftStatus:"NOT_SAVED",payloadJson:"{}"};
        return response(200,{found:Boolean(drafts.get(account)),draft},route,method);
      }
      if(route==="/home/api/process-executions/draft"&&method==="PUT"){
        const draft={draftStatus:"DRAFT",draftVersion:Number(drafts.get(account)?.draftVersion||0)+1,
          payloadJson:data.payloadJson||JSON.stringify(data.values||{})};drafts.set(account,draft);
        return response(200,{draft},route,method);
      }
      const match=route.match(/^\/api\/work\/([0-9a-f-]{36})\/save$/);
      if(!match)throw new Error(`UNEXPECTED_FIXTURE_ROUTE:${method}:${route}`);
      const execution=executions.get(match[1]);if(!execution)throw new Error("FIXTURE_EXECUTION_MISSING");
      if(account==="denied")return response(403,{success:false,code:"ACCESS_DENIED",message:"Access denied"},route,method);
      if(data.name==="")return response(mutantHttp?422:400,{success:false,code:"INVALID_REQUEST",message:"Request failed"},route,method);
      const existing=execution.events.find(row=>row.idempotency_key===data.idempotencyKey);
      if(existing)return response(200,{success:true,idempotent:true,eventId:existing.event_id,
        toState:"DONE",recovered:true,name:data.name},route,method);
      if(execution.currentState!=="DRAFT")return response(409,{success:false,code:"CONFLICT",
        message:"Request conflicts with the current state"},route,method);
      const event={event_id:101,execution_id:execution.executionId,step_code:"STEP_A",actor_code:"ACTOR",
        command_code:"SAVE",from_state:"DRAFT",to_state:"DONE",idempotency_key:data.idempotencyKey,
        request_json:data,result_json:{name:data.name},executed_by:account};
      execution.events.push(event);execution.currentState="DONE";
      return response(200,{success:true,idempotent:false,eventId:101,toState:"DONE",name:data.name},route,method);
    },
    async post(route,{data}){
      assert.equal(route,manifest.evidenceEndpoint);const submitted=structuredClone(data);
      if(submitted.lane==="BROWSER"){
        if(artifactMutant&&!mutated){mutated=true;await mutateArtifact(root,submitted,artifactMutant);}
        try{
          await verifyArtifact(root,submitted.laneDetails.domArtifactRef,submitted.laneDetails.domHash,"dom.html");
          await verifyArtifact(root,submitted.laneDetails.screenshotArtifactRef,
            submitted.laneDetails.screenshotHash,"screenshot.png");
        }catch(error){return response(422,{message:error.message},route,"POST");}
      }
      submissions.push(submitted);return response(200,{evidenceHash:sha256(JSON.stringify(submitted))},route,"POST");
    },
  });
  const runtimeFactory=async()=>({
    apiFor,
    async pageFor(account){
      let current,values={},observation=null,runtimeObserved=false,accessDenied=false,currentState="",execution;
      const waiters=[];
      const emit=value=>{const index=waiters.findIndex(waiter=>waiter.predicate(value));
        if(index>=0)waiters.splice(index,1)[0].resolve(value);};
      const render=()=>`<html><body><main data-process-code="PROC" data-step-code="STEP_A" data-route-path="/work" data-audience="USER" data-live-smoke-run-id="${current.searchParams.get("liveSmokeRunId")}" data-tenant-id="TENANT" data-project-id="PROJECT" data-execution-id="${execution.executionId}" data-current-state="${currentState}" data-runtime-observed="${runtimeObserved}" data-access-denied="${accessDenied}" data-last-command-code="${observation?.commandCode||""}" data-last-http-status="${observation?.httpStatus||""}" data-last-status-case="${observation?.statusCase||""}" data-last-idempotency-key="${observation?.idempotencyKey||""}" data-last-output-json='${JSON.stringify(observation?.output||{}).replaceAll("'","&#39;")}'><input name="name" value="${values.name||""}"><button data-command-code="SAVE">SAVE</button></main>${observation?'<section data-live-smoke-result="true">result</section>':""}<div data-live-smoke-watermark="${current.searchParams.get("liveSmokeRunId")}">${watermarkCells(current.searchParams.get("liveSmokeRunId"))}</div></body></html>`;
      const page={
        async goto(url){current=new URL(url);execution=executions.get(current.searchParams.get("executionId"));
          runtimeObserved=account!=="denied";accessDenied=account==="denied";
          currentState=execution?.currentState||current.searchParams.get("currentState")||"";},
        async waitForFunction(){},
        waitForResponse(predicate){return new Promise(resolve=>waiters.push({predicate,resolve}));},
        locator(selector){
          const field=selector.match(/^\[name="([A-Za-z][A-Za-z0-9_]*)"\]$/)?.[1];
          const command=selector.match(/^\[data-command-code="([A-Z][A-Z0-9_]*)"\]$/)?.[1];
          return {
            async count(){return field==="name"||command==="SAVE"||selector.startsWith("[data-live-smoke-action=")?1:0;},
            async evaluate(){return selector==="html"?render():{tag:"INPUT",type:"text"};},
            async fill(value){values[field]=value;uiActions.push(`fill:${account}:${field}:${value}`);},
            async selectOption(value){values[field]=value;},async check(){values[field]="true";},async uncheck(){values[field]="false";},
            async click(){
              if(selector==='[data-live-smoke-action="load-draft"]'){
                uiActions.push(`load-draft:${account}`);const value=await apiFor(account).fetch(
                  "/home/api/process-executions/draft?tenantId=TENANT",{method:"GET"});emit(value);return;
              }
              if(selector==='[data-live-smoke-action="save-draft"]'){
                uiActions.push(`save-draft:${account}`);const value=await apiFor(account).fetch(
                  "/home/api/process-executions/draft",{method:"PUT",data:{values,payloadJson:JSON.stringify(values)}});emit(value);return;
              }
              if(command){
                uiActions.push(`command:${account}:${command}`);const route=`/api/work/${execution.executionId}/save`;
                const value=await apiFor(account).fetch(route,{method:"POST",data:{...values,tenantId:"TENANT",
                  projectId:"PROJECT",actorCode:"ACTOR",idempotencyKey:current.searchParams.get("idempotencyKey")}});
                const output=JSON.parse((await value.body()).toString("utf8"));
                const statusCase=value.status()===200?(output.recovered?"RECOVERY":"SUCCESS"):
                  value.status()===400?"VALIDATION_ERROR":value.status()===403?"FORBIDDEN":value.status()===409?"CONFLICT":"UNKNOWN";
                observation={commandCode:wrongCommand?"WRONG":command,httpStatus:value.status(),statusCase,output,
                  idempotencyKey:current.searchParams.get("idempotencyKey")};
                if(output.toState)currentState=output.toState;if(value.status()===403)accessDenied=true;emit(value);
              }
            },
          };
        },
        async evaluate(){return {path:current.pathname,processCode:"PROC",stepCode:"STEP_A",audience:"USER",
          routePath:"/work",runId:current.searchParams.get("liveSmokeRunId"),tenantId:"TENANT",projectId:"PROJECT",
          executionId:execution.executionId,currentState,
          runtimeObserved,accessDenied,commandCode:observation?.commandCode||"",httpStatus:observation?.httpStatus||0,
          statusCase:observation?.statusCase||"",outputJson:JSON.stringify(observation?.output||{}),
          idempotencyKey:observation?.idempotencyKey||"",fatal:false};},
        async screenshot(){return Buffer.from(`PNG:${account}:${current.searchParams.get("statusCase")}:${observation?.commandCode}`);},
      };
      return {context:{close:async()=>{}},page};
    },
    async close(){},
  });
  const dbProbe=(_root,selector)=>{
    const execution=executions.get(selector.executionId);
    const body={schema:"carbonet.composite-db-reread/v1",readOnly:true,
      execution:execution?{execution_id:execution.executionId,tenant_id:"TENANT",project_id:"PROJECT",
        process_code:"PROC",current_step_code:"STEP_A",execution_status:"RUNNING",current_state:execution.currentState}:null,
      events:execution?execution.events.map(row=>structuredClone(row)):[],
      draft:selector.accountId==="positive"?{draft_id:1,tenant_id:"TENANT",project_id:"PROJECT",
        process_code:"PROC",step_code:"STEP_A",account_id:"positive",actor_code:"ACTOR",
        draft_version:1,draft_status:"DRAFT",payload_json:{},evidence_json:{}}:null};
    const raw=Buffer.from(JSON.stringify(body));return {body,raw,hash:sha256(raw)};
  };
  return {runtimeFactory,dbProbe,submissions,uiActions};
}

const root=await mkdtemp(path.join(os.tmpdir(),"composite-live-smoke-plan-"));
const credentials={ACTOR:"positive","FORBIDDEN:ACTOR":"denied"};
async function execute(dispatchId,options={}){
  const fake=fixture(root,options);
  const result=await runPlan({root,plan:{...plan,dispatchId},manifest,credentials,
    password:"fixture-secret",opsToken:"fixture-token",baseURL:"http://fixture.invalid",
    runtimeFactory:fake.runtimeFactory,dbProbe:fake.dbProbe});
  return {fake,result};
}
try{
  const {fake,result}=await execute(91);
  assert.equal(result.expectedEvidenceCount,15);assert.equal(result.submittedEvidenceCount,15);
  assert.ok(!JSON.stringify(result).includes(plan.leaseToken),"runner summary must not retain raw lease token");
  assert.equal(fake.submissions.length,15);
  assert.deepEqual([...new Set(fake.submissions.map(row=>row.dispatchId))],[91]);
  assert.deepEqual([...new Set(fake.submissions.map(row=>row.leaseToken))],[plan.leaseToken]);
  assert.deepEqual([...new Set(fake.submissions.map(row=>row.statusCase))].sort(),[...STATUSES].sort());
  assert.deepEqual(Object.fromEntries(STATUSES.map(status=>[status,[...new Set(fake.submissions
    .filter(row=>row.statusCase===status).map(row=>row.observedHttpStatus))]])),
    Object.fromEntries(STATUSES.map(status=>[status,[HTTP[status]]])));
  for(const status of STATUSES)assert.deepEqual(fake.submissions.filter(row=>row.statusCase===status)
    .map(row=>row.lane).sort(),["API","BROWSER","DATABASE"]);
  const one=status=>fake.submissions.find(row=>row.statusCase===status&&row.lane==="API");
  assert.equal(one("SUCCESS").executionId,one("CONFLICT").executionId);
  assert.equal(one("SUCCESS").executionId,one("RECOVERY").executionId);
  assert.notEqual(one("SUCCESS").idempotencyKey,one("CONFLICT").idempotencyKey);
  assert.equal(one("SUCCESS").idempotencyKey,one("RECOVERY").idempotencyKey);
  assert.notEqual(one("VALIDATION_ERROR").executionId,one("FORBIDDEN").executionId);
  assert.equal(one("RECOVERY").output.recovered,true);
  assert.equal(fake.uiActions.filter(value=>value.startsWith("command:")).length,5);
  assert.ok(fake.uiActions.filter(value=>value.startsWith("fill:")).length>=8);
  assert.equal(fake.uiActions.filter(value=>value==="load-draft:positive").length,3);
  assert.equal(fake.uiActions.filter(value=>value==="save-draft:positive").length,3);
  assert.ok(fake.uiActions.some(value=>value==="command:denied:SAVE"));
  for(const row of fake.submissions.filter(value=>value.lane==="BROWSER")){
    assert.deepEqual(row.laneDetails.domArtifactRef.split("/").slice(0,2),["91",row.runId]);
    assert.deepEqual(row.laneDetails.screenshotArtifactRef.split("/").slice(0,2),["91",row.runId]);
    await verifyArtifact(root,row.laneDetails.domArtifactRef,row.laneDetails.domHash,"dom.html");
    await verifyArtifact(root,row.laneDetails.screenshotArtifactRef,row.laneDetails.screenshotHash,"screenshot.png");
  }
  await assert.rejects(()=>execute(92,{mutantHttp:true}),/API_STATUS_OBSERVATION_MISMATCH/);
  await assert.rejects(()=>execute(93,{artifactMutant:"tamper"}),/EVIDENCE_SUBMISSION_REJECTED/);
  await assert.rejects(()=>execute(94,{artifactMutant:"traversal"}),/EVIDENCE_SUBMISSION_REJECTED/);
  await assert.rejects(()=>execute(95,{artifactMutant:"missing"}),/EVIDENCE_SUBMISSION_REJECTED/);
  await assert.rejects(()=>execute(96,{artifactMutant:"symlink"}),/EVIDENCE_SUBMISSION_REJECTED/);
  await assert.rejects(()=>execute(97,{wrongCommand:true}),/BROWSER_CONTEXT_OBSERVATION_MISMATCH/);
  await assert.rejects(()=>runPlan({root,plan:{...plan,leaseToken:"not-a-uuid"},manifest,credentials,
    password:"fixture-secret",opsToken:"fixture-token",baseURL:"http://fixture.invalid",
    runtimeFactory:fixture(root).runtimeFactory,dbProbe:fixture(root).dbProbe}),/LIVE_SMOKE_LEASE_TOKEN_INVALID/);
  console.log("COMPOSITE_LIVE_SMOKE_RUN_PLAN_PASS commands=1 statuses=5 lanes=3 submissions=15 browserFill>=8 draftLoadSave=3/3 commandClicks=5 artifactRehash=10 mutants=http,tamper,traversal,missing,symlink,wrong-command");
}finally{await rm(root,{recursive:true,force:true});}
