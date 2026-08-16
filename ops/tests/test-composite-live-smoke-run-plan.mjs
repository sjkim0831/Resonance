import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deterministicUuid, runPlan, sha256 }
  from "../scripts/resonance-composite-live-smoke-e2e.mjs";

const STATUSES=["SUCCESS","VALIDATION_ERROR","FORBIDDEN","CONFLICT","RECOVERY"];
const HTTP={SUCCESS:200,VALIDATION_ERROR:400,FORBIDDEN:403,CONFLICT:409,RECOVERY:200};
const literal=value=>({source:"LITERAL",value});
const from=(source,path)=>({source,path});
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
  authorityRevisionSetHash:"3".repeat(64),artifactManifestHash:"4".repeat(64),expectedEvidenceCount:15,
  observedAt:new Date().toISOString(),authorities:[authority],existingEvidenceKeys:[],existingScenarioContexts:[],
  eligibleAssignments:[
    {authorityId:11,actorCode:"ACTOR",tenantId:"TENANT",projectId:"PROJECT",accountId:"positive",assignmentCount:1},
    {authorityId:11,actorCode:"ACTOR",tenantId:"TENANT",projectId:"PROJECT",accountId:"denied",assignmentCount:0},
  ]};
const manifest={schema:"carbonet.composite-live-smoke-runner/v1",evidenceDirectory:"evidence",
  evidenceEndpoint:"/ops/api/composite-live-smoke/evidence",timeouts:{requestSeconds:2,databaseSeconds:2,browserSeconds:2}};

function response(status,body){const raw=Buffer.from(JSON.stringify(body));return {
  status:()=>status,body:async()=>raw,headers:()=>({"content-type":"application/json"}),
};}
function fixture({mutantHttp=false}={}){
  let sequence=0,latestExecution="";
  const executions=new Map(),submissions=[];
  const apiFor=account=>({
    async fetch(route,{method,data}){
      if(route==="/home/api/process-executions/start"&&method==="POST"){
        latestExecution=deterministicUuid(`fixture-execution-${++sequence}`);
        executions.set(latestExecution,{executionId:latestExecution,currentStepCode:"STEP_A",currentState:"DRAFT",events:[]});
        return response(200,{execution:{executionId:latestExecution,currentStepCode:"STEP_A"}});
      }
      if(route.startsWith("/home/api/process-executions/draft?")&&method==="GET")
        return response(200,{draft:{draftVersion:0}});
      if(route==="/home/api/process-executions/draft"&&method==="PUT")
        return response(200,{draft:{draftStatus:"DRAFT",draftVersion:1}});
      const match=route.match(/^\/api\/work\/([0-9a-f-]{36})\/save$/);
      if(!match)throw new Error(`UNEXPECTED_FIXTURE_ROUTE:${method}:${route}`);
      const execution=executions.get(match[1]);
      if(!execution)throw new Error("FIXTURE_EXECUTION_MISSING");
      if(account==="denied")return response(403,{success:false,code:"ACCESS_DENIED",message:"Access denied"});
      if(data.name==="")return response(mutantHttp?422:400,{success:false,code:"INVALID_REQUEST",message:"Request failed"});
      const existing=execution.events.find(row=>row.idempotency_key===data.idempotencyKey);
      if(existing)return response(200,{success:true,idempotent:true,eventId:existing.event_id,
        toState:"DONE",recovered:true,name:data.name});
      if(execution.currentState!=="DRAFT")return response(409,{success:false,code:"CONFLICT",
        message:"Request conflicts with the current state"});
      const event={event_id:101,execution_id:execution.executionId,step_code:"STEP_A",actor_code:"ACTOR",
        command_code:"SAVE",from_state:"DRAFT",to_state:"DONE",idempotency_key:data.idempotencyKey,
        request_json:data,result_json:{name:data.name},executed_by:account};
      execution.events.push(event);execution.currentState="DONE";
      return response(200,{success:true,idempotent:false,eventId:101,toState:"DONE",name:data.name});
    },
    async post(route,{data}){
      assert.equal(route,manifest.evidenceEndpoint);submissions.push(structuredClone(data));
      return response(200,{evidenceHash:sha256(JSON.stringify(data))});
    },
  });
  const runtimeFactory=async()=>({
    apiFor,
    async pageFor(account){let current;
      const context={close:async()=>{}};
      const page={
        async goto(url){current=new URL(url);},
        async waitForFunction(){},
        locator(){return {evaluate:async()=>`<html><main data-execution-id="${current.searchParams.get("executionId")}"></main></html>`};},
        async evaluate(){
          const denied=account==="denied",execution=executions.get(current.searchParams.get("executionId"));
          return {path:current.pathname,processCode:"PROC",stepCode:"STEP_A",audience:"USER",
            tenantId:denied?"":"TENANT",projectId:denied?"":"PROJECT",executionId:denied?"":execution.executionId,
            currentState:denied?"":execution.currentState,runtimeObserved:!denied,accessDenied:denied,fatal:false};
        },
        async screenshot(){return Buffer.from(`PNG:${account}:${current.searchParams.get("statusCase")}`);},
      };
      return {context,page};
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
  return {runtimeFactory,dbProbe,submissions};
}

const root=await mkdtemp(path.join(os.tmpdir(),"composite-live-smoke-plan-"));
try{
  const fake=fixture();
  const result=await runPlan({root,plan,manifest,credentials:{ACTOR:"positive","FORBIDDEN:ACTOR":"denied"},
    password:"fixture-secret",opsToken:"fixture-token",baseURL:"http://fixture.invalid",
    runtimeFactory:fake.runtimeFactory,dbProbe:fake.dbProbe});
  assert.equal(result.expectedEvidenceCount,15);assert.equal(result.submittedEvidenceCount,15);
  assert.equal(fake.submissions.length,15);
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
  const mutant=fixture({mutantHttp:true});
  await assert.rejects(()=>runPlan({root,plan:{...plan,dispatchId:92},manifest,
    credentials:{ACTOR:"positive","FORBIDDEN:ACTOR":"denied"},password:"fixture-secret",
    opsToken:"fixture-token",baseURL:"http://fixture.invalid",runtimeFactory:mutant.runtimeFactory,
    dbProbe:mutant.dbProbe}),/FIXTURE_API_STATUS_INVALID/);
  assert.equal(mutant.submissions.length,0);
  console.log("COMPOSITE_LIVE_SMOKE_RUN_PLAN_PASS commands=1 statuses=5 lanes=3 submissions=15 http=200,400,403,409,200 recoveryReplay=1 mutantHttp=1");
}finally{await rm(root,{recursive:true,force:true});}
