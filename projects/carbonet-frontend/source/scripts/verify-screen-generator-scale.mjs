import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root=resolve(".cache/screen-generator-scale");
const inputPath=resolve(root,"screen-blueprints-1000.json");
const outDir=resolve(root,"generated");
const requiredScenarioTypes=["HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"];
const specification={designSystem:"KRDS_GOV",businessPurpose:"대량 화면 생성 성능과 상세 설계 계약을 검증한다.",actorResponsibilities:["업무 수행"],entryConditions:["접근 권한 보유"],exitConditions:["처리 결과 저장"],states:["READY","DONE"],kpis:[{code:"LATENCY",label:"처리 시간"}],sections:[{code:"MAIN",label:"주요 업무"}],fields:[{code:"NAME",label:"이름",required:true}],actions:[{code:"SAVE",label:"저장"}],apiContracts:[{code:"SAVE",method:"POST",path:"/home/api/generated"}],dataContracts:[{code:"ENTITY",entity:"generated_entity",tenantScoped:true}],permissions:[{code:"WRITE",scope:"TENANT"}],validations:[{code:"REQUIRED",type:"REQUIRED"}],errors:[{code:"SAVE_FAILED",recovery:"재시도"}],responsive:{mobile:"single-column",tablet:"adaptive-grid",desktop:"task-and-context"},accessibility:{standard:"WCAG_2_1_AA",keyboard:true,labels:true,focusManagement:true}};
const blueprints=Array.from({length:1000},(_,index)=>({blueprintCode:`BP_SCALE_${String(index+1).padStart(4,"0")}`,processCode:`PROCESS_${Math.floor(index/10)+1}`,stepCode:`STEP_${index+1}`,actorCode:index%2===0?"USER_ACTOR":"ADMIN_ACTOR",audience:index%2===0?"USER":"ADMIN",pageId:`SCALE_PAGE_${index+1}`,pageName:`대량 검증 화면 ${index+1}`,routePath:`/generated/scale/${index+1}`,screenType:index%3===0?"FORM":"LIST",templateCode:index%3===0?"KRDS_TASK_FORM":"KRDS_DATA_LIST",specificationJson:specification,traceabilityJson:{requirementIds:[`SCALE-${index+1}`],requiredScenarioTypes},validationStatus:"VALID"}));

await rm(root,{recursive:true,force:true});
await mkdir(root,{recursive:true});
await writeFile(inputPath,JSON.stringify({schemaVersion:"2.0.0",generator:"scale-verifier",batch:{batchId:1000,batchCode:"SCALE_1000",batchStatus:"COMPILED"},blueprints}));

function generate(){
  const result=spawnSync(process.execPath,["scripts/generate-screen-blueprints.mjs","--input",inputPath,"--outDir",outDir,"--strict","true","--concurrency","auto"],{encoding:"utf8"});
  if(result.status!==0)throw new Error(result.stderr||result.stdout||`generator exited ${result.status}`);
  return JSON.parse(result.stdout);
}

const first=generate();
const second=generate();
const report=JSON.parse(await readFile(resolve(outDir,"generation-report.json"),"utf8"));
if(first.screenCount!==1000||report.screenCount!==1000)throw new Error(`Expected 1000 screens, got ${report.screenCount}`);
if(first.completeDesigns!==1000)throw new Error(`Expected 1000 complete designs, got ${first.completeDesigns}`);
if(second.contractFilesChanged!==0)throw new Error(`Incremental rerun rewrote ${second.contractFilesChanged} contract files`);
if(first.durationMs>300000||second.durationMs>300000)throw new Error(`Five-minute target exceeded: ${first.durationMs}ms / ${second.durationMs}ms`);
console.log(JSON.stringify({success:true,screenCount:report.screenCount,firstDurationMs:first.durationMs,incrementalDurationMs:second.durationMs,concurrency:report.concurrency,rewrittenOnIncrementalRun:second.contractFilesChanged,contractHash:report.contractHash},null,2));
await rm(root,{recursive:true,force:true});
