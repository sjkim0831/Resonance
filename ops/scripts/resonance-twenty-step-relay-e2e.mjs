#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";

const root=path.resolve(process.env.RESONANCE_ROOT||path.join(import.meta.dirname,"../.."));
const require=createRequire(path.join(root,"projects/carbonet-frontend/source/package.json"));
const {request}=require("@playwright/test");
const baseURL=String(process.env.CARBONET_RUNTIME_BASE_URL||"http://127.0.0.1").replace(/\/$/,"");
const password=String(process.env.CARBONET_ACTOR_TEST_PASSWORD||"");
if(!password)throw new Error("CARBONET_ACTOR_TEST_PASSWORD is required");

const accountByActor={COMPANY_MANAGER:"qaowner26",SITE_DATA_OWNER:"qadata26",CALCULATOR:"qacalc26",VERIFIER:"qaverify26",APPROVER:"qaapprove26"};
const expectedProcesses=String(process.env.CARBONET_RELAY_EXPECTED_PROCESSES||"EMISSION_PROJECT_PORTFOLIO,EMISSION_PROJECT,ORGANIZATIONAL_BOUNDARY,ACTIVITY_DATA,EMISSION_CALCULATION")
  .split(",").map(value=>value.trim()).filter(Boolean);
const expectedStepCount=Number(process.env.CARBONET_RELAY_EXPECTED_STEP_COUNT||20);
const expectedTransitionCount=Number(process.env.CARBONET_RELAY_EXPECTED_TRANSITION_COUNT||21);
const expectedAccountCount=Number(process.env.CARBONET_RELAY_EXPECTED_ACCOUNT_COUNT||5);

async function call(api,method,url,data,expected=[200]){
  const response=await api[method](url,{...(data===undefined?{}:{data}),failOnStatusCode:false});
  const body=await response.json().catch(()=>({}));
  if(!expected.includes(response.status()))throw new Error(`${method.toUpperCase()} ${url} HTTP ${response.status()} ${body?.message||JSON.stringify(body)}`);
  return body;
}
async function login(account){
  const api=await request.newContext({baseURL,ignoreHTTPSErrors:true});
  const response=await api.post("/signin/actionLogin",{data:{userId:account,userPw:password,userSe:"USR"},failOnStatusCode:false});
  if(response.status()!==200)throw new Error(`login failed account=${account} HTTP ${response.status()}`);
  return api;
}
function fieldsOf(contract){
  const raw=typeof contract?.fieldContractJson==="string"?JSON.parse(contract.fieldContractJson||"[]"):contract?.fieldContractJson;
  return Array.isArray(raw)?raw:Array.isArray(raw?.fields)?raw.fields:[];
}
function sample(field,context){
  const code=String(field.fieldCode||field.code||"").toLowerCase();
  const type=String(field.dataType||"").toUpperCase();
  const control=String(field.controlType||field.control||"").toUpperCase();
  if(control==="PROJECT_SELECT"||code==="projectid")return context.projectId;
  if(control==="ACTOR_SELECT"||code.includes("actor"))return context.actorCode;
  if(code==="tenantid")return context.tenantId;
  if(control==="SCOPE_SELECT"||code.includes("scope"))return "SCOPE1";
  if(control==="SITE_SELECT"||code.includes("site"))return context.site;
  if(type==="BOOLEAN"||type==="BOOL")return true;
  if(["INTEGER","DECIMAL","NUMBER"].includes(type)||/(amount|quantity|value|count|rate|percent|page|year|version)/.test(code))return 1;
  if(code.includes("date")||code.includes("periodstart"))return context.periodStart;
  if(code.includes("periodend")||code.includes("deadline"))return context.periodEnd;
  if(code.includes("status"))return "CONFIRMED";
  return `QA ${context.sequence} ${field.fieldName||field.label||field.fieldCode||"value"}`;
}

const contexts=new Map();
const startedAt=Date.now();
let projectId="";
try{
  for(const account of Object.values(accountByActor))contexts.set(account,await login(account));
  const ownerApi=contexts.get(accountByActor.COMPANY_MANAGER);
  const options=await call(ownerApi,"get","/home/api/emission-projects/options");
  if(!options?.readiness?.ready||!options?.sites?.length)throw new Error("project creation readiness is incomplete");
  const year=String(new Date().getUTCFullYear()),marker=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const periodStart=`${year}-01-01`,periodEnd=`${year}-12-31`,site=String(options.sites[0]);
  const created=await call(ownerApi,"post","/home/api/emission-projects",{clientRequestId:`twenty-step-${marker}`,name:`QA twenty-step relay ${marker}`,site,owner:accountByActor.COMPANY_MANAGER,dataOwner:accountByActor.SITE_DATA_OWNER,calculator:accountByActor.CALCULATOR,verifier:accountByActor.VERIFIER,approver:accountByActor.APPROVER,reportingYear:year,periodStart,periodEnd,dueDate:periodEnd,scopes:["Scope 1","Scope 2"],organizationBoundary:"OPERATIONAL_CONTROL",emissionStandard:"ISO_14064_1",methodologyVersion:"2018",verificationLevel:"LIMITED",collectionCycle:"MONTHLY",materialityThreshold:"5"});
  projectId=String(created.id||"");
  const tenantId=String(created.tenantId||options.tenantId||"DEFAULT");
  if(!projectId)throw new Error("project id missing");
  // Project registration completes the setup task through the domain API. For
  // a deterministic QA relay we rewind only the generated process runtime so
  // all seven EMISSION_PROJECT steps are exercised by their assigned accounts.
  const resetResponse=await ownerApi.post("/home/api/process-executions/qa-instance",{
    headers:{"X-Carbonet-Test-Mode":"1"},
    data:{action:"RESET",projectId,processCode:"EMISSION_PROJECT"},
    failOnStatusCode:false
  });
  const resetBody=await resetResponse.json().catch(()=>({}));
  if(resetResponse.status()!==200)throw new Error(`QA reset failed HTTP ${resetResponse.status()} ${resetBody?.message||JSON.stringify(resetBody)}`);
  let processCode=expectedProcesses[0],stepCode="",executionId="",sequence=0;
  const transitions=[];
  let correctionRequested=false;
  const started=await call(ownerApi,"post","/home/api/process-executions/start",{tenantId,projectId,processCode,actorCode:"COMPANY_MANAGER",cycleType:"ONCE",siteScopeJson:JSON.stringify([site]),methodologyVersion:"ISO_14064_1_2018",boundaryVersion:"OPERATIONAL_CONTROL_V1",executionVersion:1});
  executionId=String(started.executionId||started.execution?.executionId||"");stepCode=String(started.currentStepCode||started.execution?.currentStepCode||"");
  while(processCode&&stepCode&&sequence<30){
    sequence+=1;
    const probe=await call(ownerApi,"get",`/home/api/process-executions/screen-contract?routePath=${encodeURIComponent("/work/execution")}`);
    void probe;
    let contractBody,actorCode,api,account;
    for(const [candidateActor,candidateAccount] of Object.entries(accountByActor)){
      const candidateApi=contexts.get(candidateAccount);
      const query=new URLSearchParams({tenantId,projectId,processCode,stepCode});
      const candidate=await call(candidateApi,"get",`/home/api/process-executions/draft?${query}`,undefined,[200,403]);
      if(candidate?.contract?.actorCode===candidateActor){contractBody=candidate;actorCode=candidateActor;api=candidateApi;account=candidateAccount;break;}
    }
    if(!contractBody||!actorCode)throw new Error(`assigned actor contract unavailable ${processCode}/${stepCode}`);
    const fields=fieldsOf(contractBody.contract).filter(field=>field.editable!==false&&String(field.fieldCode||field.code||""));
    const payload=Object.fromEntries(fields.map(field=>[String(field.fieldCode||field.code),sample(field,{tenantId,projectId,actorCode,site,periodStart,periodEnd,sequence})]));
    Object.assign(payload,{workSummary:`${sequence}단계 업무 처리 완료`,decisionBasis:`프로세스·액터·필드 계약과 증빙을 검증했습니다.`,resultValue:1,resultUnit:"case"});
    const expectedVersion=Number(contractBody.draft?.draftVersion||0);
    const saved=await call(api,"put","/home/api/process-executions/draft",{tenantId,projectId,processCode,stepCode,actorCode,expectedVersion,payloadJson:JSON.stringify(payload),evidenceJson:JSON.stringify({documentId:`QA-20STEP-${String(sequence).padStart(2,"0")}`,sourceUrl:`/work/execution?projectId=${projectId}&processCode=${processCode}&stepCode=${stepCode}`})});
    const commandPayload={tenantId,projectId,processCode,stepCode,actorCode,commandCode:String(contractBody.contract.commandCode),idempotencyKey:randomUUID(),requireDraft:true,requestJson:JSON.stringify(payload),resultJson:JSON.stringify({completed:true,draftVersion:saved.draft?.draftVersion}),snapshotRef:`qa:${projectId}:${processCode}:${stepCode}:${sequence}`};
    if(processCode==="EMISSION_PROJECT"&&stepCode==="EMISSION_PROJECT_VALIDATE"&&!correctionRequested){
      commandPayload.requestedToState="CORRECTION_REQUIRED";
      correctionRequested=true;
    }
    const command=await call(api,"post",`/home/api/process-executions/${executionId}/commands`,commandPayload);
    transitions.push({sequence,processCode,stepCode,actorCode,account,fieldCount:fields.length,eventId:command.eventId,toState:command.toState,nextProcessCode:command.nextProcessCode||"",nextStepCode:command.nextProcessStepCode||command.nextStepCode||""});
    if(command.nextProcessCode){processCode=String(command.nextProcessCode);executionId=String(command.nextProcessExecutionId);stepCode=String(command.nextProcessStepCode);}
    else if(command.nextStepCode){stepCode=String(command.nextStepCode);}
    else{processCode="";stepCode="";}
  }
  const observed=[...new Set(transitions.map(item=>item.processCode))];
  const uniqueSteps=new Set(transitions.map(item=>`${item.processCode}/${item.stepCode}`));
  console.log(JSON.stringify({projectId,observed,uniqueStepCount:uniqueSteps.size,transitionCount:transitions.length,transitions},null,2));
  if(uniqueSteps.size!==expectedStepCount)throw new Error(`expected ${expectedStepCount} unique steps, observed ${uniqueSteps.size}`);
  if(transitions.length!==expectedTransitionCount)throw new Error(`expected ${expectedTransitionCount} transitions, observed ${transitions.length}`);
  if(JSON.stringify(observed)!==JSON.stringify(expectedProcesses))throw new Error(`process order mismatch ${JSON.stringify(observed)}`);
  const evidence={schemaVersion:1,status:"PASSED",completedAt:new Date().toISOString(),durationMs:Date.now()-startedAt,projectId,tenantId,processCount:observed.length,stepCount:uniqueSteps.size,transitionCount:transitions.length,correctionReplayCount:transitions.length-uniqueSteps.size,accountCount:new Set(transitions.map(item=>item.account)).size,processes:observed,transitions};
  if(evidence.accountCount!==expectedAccountCount)throw new Error(`expected ${expectedAccountCount} accounts, observed ${evidence.accountCount}`);
  const outputDir=path.join(root,"var/test-evidence");await mkdir(outputDir,{recursive:true});await writeFile(path.join(outputDir,"twenty-step-relay-e2e-latest.json"),`${JSON.stringify(evidence,null,2)}\n`);
  console.log(`TWENTY_STEP_RELAY_PASS project=${projectId} processes=${observed.length} uniqueSteps=${evidence.stepCount} transitions=${evidence.transitionCount} accounts=${evidence.accountCount} durationMs=${evidence.durationMs}`);
}finally{for(const api of contexts.values())await api.dispose();}
