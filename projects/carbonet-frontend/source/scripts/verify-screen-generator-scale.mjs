import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root=resolve(".cache/screen-generator-scale");
const inputPath=resolve(root,"screen-blueprints-1732.json");
const permutedInputPath=resolve(root,"screen-blueprints-1732-permuted.json");
const blankInputPath=resolve(root,"screen-blueprint-blank-json.json");
const whitespaceInputPath=resolve(root,"screen-blueprint-whitespace-json.json");
const outDir=resolve(root,"generated");
const permutedOutDir=resolve(root,"generated-permuted");
const blankOutDir=resolve(root,"generated-blank-json");
const whitespaceOutDir=resolve(root,"generated-whitespace-json");
const requiredScenarioTypes=["HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"];
const specification={designSystem:"KRDS_GOV",businessPurpose:"대량 화면 생성 성능과 상세 설계 계약을 검증한다.",actorResponsibilities:["업무 수행"],entryConditions:["접근 권한 보유"],exitConditions:["처리 결과 저장"],states:["READY","DONE"],kpis:[{code:"LATENCY",label:"처리 시간"}],sections:[{code:"MAIN",label:"주요 업무"}],fields:[{code:"NAME",label:"이름",required:true}],actions:[{code:"SAVE",label:"저장"}],apiContracts:[{code:"SAVE",method:"POST",path:"/home/api/generated"}],dataContracts:[{code:"ENTITY",entity:"generated_entity",tenantScoped:true}],permissions:[{code:"WRITE",scope:"TENANT"}],validations:[{code:"REQUIRED",type:"REQUIRED"}],errors:[{code:"SAVE_FAILED",recovery:"재시도"}],responsive:{mobile:"single-column",tablet:"adaptive-grid",desktop:"task-and-context"},accessibility:{standard:"WCAG_2_1_AA",keyboard:true,labels:true,focusManagement:true}};
const blueprints=Array.from({length:1732},(_,index)=>({blueprintCode:`BP_SCALE_${String(index+1).padStart(4,"0")}`,processCode:`PROCESS_${Math.floor(index/10)+1}`,stepCode:`STEP_${index+1}`,actorCode:index%2===0?"USER_ACTOR":"ADMIN_ACTOR",audience:index%2===0?"USER":"ADMIN",pageId:`SCALE_PAGE_${index+1}`,pageName:`대량 검증 화면 ${index+1}`,routePath:`/generated/scale/${index+1}`,screenType:index%3===0?"FORM":"LIST",templateCode:index%3===0?"KRDS_TASK_FORM":"KRDS_DATA_LIST",specificationJson:specification,traceabilityJson:{requirementIds:[`SCALE-${index+1}`],requiredScenarioTypes},validationStatus:"VALID"}));
const reverseKeys=(value)=>Array.isArray(value)?value.map(reverseKeys):value&&typeof value==="object"
  ?Object.fromEntries(Object.keys(value).reverse().map(key=>[key,reverseKeys(value[key])])):value;

await rm(root,{recursive:true,force:true});
await mkdir(root,{recursive:true});
await writeFile(inputPath,JSON.stringify({
  schemaVersion:"2.0.0",
  generator:"scale-verifier",
  batch:{batchId:1732,batchCode:"SCALE_1732",batchStatus:"COMPILED"},
  screenSpace:{dimensionCounts:{domain:10000,process:1000,step:1,state:50,actor:20,policy:1,view:7,device:1,locale:1,variant:1}},
  blueprints
}));
await writeFile(permutedInputPath,JSON.stringify({
  schemaVersion:"2.0.0",
  generator:"scale-verifier",
  batch:{batchId:1732,batchCode:"SCALE_1732",batchStatus:"COMPILED"},
  screenSpace:{dimensionCounts:{domain:10000,process:1000,step:1,state:50,actor:20,policy:1,view:7,device:1,locale:1,variant:1}},
  blueprints:[...blueprints].reverse().map(reverseKeys)
}));
const blankBlueprint={...blueprints[0],specificationJson:"{}",traceabilityJson:""};
const minimalInput=(blueprint)=>({schemaVersion:"2.0.0",generator:"blank-json-verifier",
  batch:{batchId:1,batchCode:"BLANK_JSON",batchStatus:"COMPILED"},blueprints:[blueprint]});
await writeFile(blankInputPath,JSON.stringify(minimalInput(blankBlueprint)));
await writeFile(whitespaceInputPath,JSON.stringify(minimalInput({
  ...blankBlueprint,specificationJson:"   ",traceabilityJson:"\t"
})));

function generate(source=inputPath,target=outDir,strict="true"){
  const result=spawnSync(process.execPath,["scripts/generate-screen-blueprints.mjs","--input",source,"--outDir",target,"--strict",strict,"--concurrency","auto"],{encoding:"utf8"});
  if(result.status!==0)throw new Error(result.stderr||result.stdout||`generator exited ${result.status}`);
  return JSON.parse(result.stdout);
}

const first=generate();
const second=generate();
const permuted=generate(permutedInputPath,permutedOutDir);
generate(blankInputPath,blankOutDir,"false");
generate(whitespaceInputPath,whitespaceOutDir,"false");
const report=JSON.parse(await readFile(resolve(outDir,"generation-report.json"),"utf8"));
const generatedFiles=(directory)=>{const values=[];const visit=async(current)=>{for(const entry of await readdir(current,{withFileTypes:true})){const path=resolve(current,entry.name);if(entry.isDirectory())await visit(path);else if(entry.name!=="generation-report.json")values.push([path.slice(directory.length),await readFile(path,"utf8")]);}};return visit(directory).then(()=>values.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0));};
if(first.screenCount!==1732||report.screenCount!==1732)throw new Error(`Expected 1732 screens, got ${report.screenCount}`);
if(first.completeDesigns!==1732)throw new Error(`Expected 1732 complete designs, got ${first.completeDesigns}`);
if(first.coordinateCount!==1732)throw new Error(`Expected 1732 screen coordinates, got ${first.coordinateCount}`);
if(BigInt(first.declaredScreenSpace)<70000000000n)throw new Error(`Expected at least 70 billion virtual combinations, got ${first.declaredScreenSpace}`);
if(second.contractFilesChanged!==0)throw new Error(`Incremental rerun rewrote ${second.contractFilesChanged} contract files`);
if(JSON.stringify(await generatedFiles(outDir))!==JSON.stringify(await generatedFiles(permutedOutDir)))throw new Error("Source order or nested JSON key order changed generated bytes");
if(JSON.stringify(await generatedFiles(blankOutDir))!==JSON.stringify(await generatedFiles(whitespaceOutDir)))throw new Error("Blank JSON whitespace changed generated bytes");
if(first.durationMs>300000||second.durationMs>300000||permuted.durationMs>300000)throw new Error(`Five-minute target exceeded: ${first.durationMs}ms / ${second.durationMs}ms / ${permuted.durationMs}ms`);
console.log(JSON.stringify({success:true,screenCount:report.screenCount,coordinateCount:report.coordinateCount,declaredScreenSpace:report.declaredScreenSpace,dimensionCounts:report.dimensionCounts,firstDurationMs:first.durationMs,incrementalDurationMs:second.durationMs,permutedDurationMs:permuted.durationMs,concurrency:report.concurrency,rewrittenOnIncrementalRun:second.contractFilesChanged,sourceOrderAndJsonKeysStable:true,blankJsonNormalized:true,contractHash:report.contractHash},null,2));
await rm(root,{recursive:true,force:true});
