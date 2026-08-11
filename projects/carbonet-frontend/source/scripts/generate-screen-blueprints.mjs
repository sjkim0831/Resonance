import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, rename, rm } from "node:fs/promises";
import { availableParallelism, freemem, loadavg, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import {
  comparableRouteKey,
  findCanonicalRoute,
  registerCanonicalRoute,
} from "./route-path-canonicalization.mjs";

const startedAt = performance.now();
const args = Object.fromEntries(process.argv.slice(2).map((value,index,all)=>value.startsWith("--")?[value.slice(2),all[index+1]?.startsWith("--")?"true":all[index+1]]:null).filter(Boolean));
if (!args.input) throw new Error("Usage: node scripts/generate-screen-blueprints.mjs --input <batch-export.json> [--limit 5000] [--strict true]");
const input = JSON.parse(await readFile(resolve(args.input), "utf8"));
if (!["1.0.0","2.0.0"].includes(input.schemaVersion) || !Array.isArray(input.blueprints)) throw new Error("Unsupported or invalid blueprint export.");
const limit = Math.min(5000, Math.max(1, Number(args.limit || 5000)));
const strict = args.strict === "true";
async function collectReservedRoutes(directory, routes = new Map()) {
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory() && entry.name !== "generated") await collectReservedRoutes(path, routes);
      else if (/Family\.ts$/.test(entry.name)) {
        const source = await readFile(path, "utf8");
        for (const match of source.matchAll(/\b(?:koPath|enPath)\s*:\s*["'`]([^"'`]+)["'`]/g)) {
          registerCanonicalRoute(routes, match[1], path);
        }
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return routes;
}
const reservedRoutes = await collectReservedRoutes(resolve("src"));
try {
  const runtimeRoutes = await readFile(resolve("src/app/routes/runtime.ts"), "utf8");
  for (const match of runtimeRoutes.matchAll(/\[\s*["'`]([^"'`]+)["'`]\s*,/g)) {
    registerCanonicalRoute(reservedRoutes, match[1], "src/app/routes/runtime.ts");
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const validBlueprints = input.blueprints.filter((item) => item.validationStatus === "VALID");
const skippedReservedRoutes = validBlueprints
  .filter((item) => reservedRoutes.has(comparableRouteKey(item.routePath)))
  .map((item) => ({
    supplied: String(item.routePath || ""),
    canonical: findCanonicalRoute(reservedRoutes, item.routePath),
  }));
const blueprints = validBlueprints
  .filter((item) => !reservedRoutes.has(comparableRouteKey(item.routePath)))
  .slice(0, limit);
const seenIds = new Set(), seenRoutes = new Set();
const json = (value) => JSON.stringify(value,null,2);
const parse = (value, code) => { try { return typeof value === "string" ? JSON.parse(value || "{}") : value || {}; } catch { throw new Error(`Invalid JSON contract: ${code}`); } };
const strings = (value) => Array.isArray(value) ? value.map(item=>typeof item === "string" ? item : item?.name || item?.code || item?.label).filter(Boolean) : [];
const objects = (value, kind) => Array.isArray(value) ? value.map((item,index)=>typeof item === "string" ? { code:`${kind}_${index+1}`, label:item } : item).filter(Boolean) : [];
const requiredScenarioTypes = ["HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"];
const inferDomain = (item) => String(item.domainCode || item.projectCode || item.processCode || "COMMON").split(/[_:/.-]/)[0] || "COMMON";
const inferView = (item) => String(item.viewCode || item.screenType || "DETAIL").toUpperCase();
const coordinateOf = (item, specification) => ({
  domain: inferDomain(item),
  process: String(item.processCode),
  step: String(item.stepCode),
  state: String(specification.states[0] || specification.entryConditions[0] || "READY"),
  actor: String(item.actorCode),
  policy: String(item.policyCode || `${item.actorCode}:DEFAULT`),
  view: inferView(item),
  device: "ADAPTIVE",
  locale: "MULTI",
  variant: String(item.templateCode || "KRDS_DEFAULT")
});
const coordinateKey = (coordinate) => [
  coordinate.domain, coordinate.process, coordinate.step, coordinate.state, coordinate.actor,
  coordinate.policy, coordinate.view, coordinate.device, coordinate.locale, coordinate.variant
].map(value=>encodeURIComponent(value)).join("::");
const cpuCount=availableParallelism();
const memoryPressure=freemem()/Math.max(1,totalmem())<0.12;
const loadPressure=(loadavg()[0]/Math.max(1,cpuCount))>0.85;
const automaticConcurrency=Math.max(2,Math.min(memoryPressure||loadPressure?4:8,cpuCount));
const concurrency=Math.max(1,Math.min(32,args.concurrency&&args.concurrency!=="auto"?Number(args.concurrency):automaticConcurrency));
if(!Number.isFinite(concurrency)) throw new Error(`Invalid concurrency: ${args.concurrency}`);

async function mapConcurrent(values,worker){
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(concurrency,Math.max(1,values.length))},async()=>{
    while(cursor<values.length){const index=cursor++;await worker(values[index],index);}
  }));
}

async function atomicWriteIfChanged(file,content){
  try{if(await readFile(file,"utf8")===content)return false;}catch(error){if(error?.code!=="ENOENT")throw error;}
  await mkdir(dirname(file),{recursive:true});
  const temporary=`${file}.tmp-${process.pid}`;
  await writeFile(temporary,content);
  await rename(temporary,file);
  return true;
}

function normalizeSpecification(raw, item) {
  const fields=objects(raw.fields,"FIELD"), sections=objects(raw.sections,"SECTION"), actions=objects(raw.actions || raw.commands,"ACTION");
  return {
    schemaVersion:"2.0.0", designSystem:raw.designSystem || "KRDS_GOV", businessPurpose:raw.businessPurpose || item.pageName,
    actorResponsibilities:strings(raw.actorResponsibilities), entryConditions:strings(raw.entryConditions || [raw.entryCondition || raw.fromState]),
    exitConditions:strings(raw.exitConditions || [raw.exitCondition || raw.toState]), states:strings(raw.states), kpis:objects(raw.kpis,"KPI"),
    sections, fields, actions, apiContracts:objects(raw.apiContracts,"API"), dataContracts:objects(raw.dataContracts,"DATA"),
    permissions:objects(raw.permissions,"PERMISSION"), validations:objects(raw.validations,"VALIDATION"), errors:objects(raw.errors,"ERROR"),
    responsive:raw.responsive || { mobile:"single-column",tablet:"adaptive-grid",desktop:"task-and-context" },
    accessibility:raw.accessibility || { standard:"WCAG_2_1_AA",keyboard:true,labels:true,focusManagement:true },
    completionRule:raw.completionRule || "Required validation passes and the process transition is persisted.",
    extensions:raw.extensions || {}
  };
}

function completeness(spec, trace) {
  const checks={purpose:!!spec.businessPurpose,actor:spec.actorResponsibilities.length>0,entry:spec.entryConditions.length>0,exit:spec.exitConditions.length>0,
    sections:spec.sections.length>0,fields:spec.fields.length>0,actions:spec.actions.length>0,api:spec.apiContracts.length>0,data:spec.dataContracts.length>0,
    permissions:spec.permissions.length>0,validations:spec.validations.length>0,states:spec.states.length>0,errors:spec.errors.length>0,responsive:!!spec.responsive,
    accessibility:!!spec.accessibility,tests:requiredScenarioTypes.every(type=>(trace.requiredScenarioTypes||[]).includes(type))};
  const passed=Object.values(checks).filter(Boolean).length;
  return {score:Math.round(passed/Object.keys(checks).length*100),checks,complete:passed===Object.keys(checks).length};
}

const normalized = blueprints.map((item) => {
  const id = String(item.pageId).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const routePath = String(item.routePath || "");
  if (!id || seenIds.has(id)) throw new Error(`Duplicate/invalid page id: ${id}`);
  if (!routePath.startsWith("/")) throw new Error(`Invalid route: ${routePath}`);
  seenIds.add(id); seenRoutes.add(routePath);
  const traceability=parse(item.traceabilityJson,item.blueprintCode);
  traceability.requiredScenarioTypes=Array.from(new Set([...(traceability.requiredScenarioTypes||[])]));
  const specification=normalizeSpecification(parse(item.specificationJson,item.blueprintCode),item);
  const designCompleteness=completeness(specification,traceability);
  const screenCoordinate=coordinateOf(item,specification);
  if(strict && !designCompleteness.complete) throw new Error(`Incomplete detailed design: ${item.blueprintCode} (${designCompleteness.score}%)`);
  return { id, blueprintCode:item.blueprintCode, processCode:item.processCode, stepCode:item.stepCode, actorCode:item.actorCode, audience:item.audience,
    pageId:item.pageId, pageName:item.pageName, routePath, screenType:item.screenType, templateCode:item.templateCode,
    screenCoordinate, screenCoordinateKey:coordinateKey(screenCoordinate), specification, traceability, designCompleteness };
});

const outDir = resolve(args.outDir || "src/generated/screen-generation");
const definitionsDir=resolve(outDir,"definitions");
await mkdir(definitionsDir,{recursive:true});
const definitionImports=[];
let contractFilesChanged=0;
const expectedDefinitionFiles=new Set();
await mapConcurrent(normalized,async(screen) => {
  const symbol=`screen_${screen.id.replace(/-/g,"_")}`;
  definitionImports.push({symbol,file:`./definitions/${screen.id}`});
  const filename=`${screen.id}.ts`;
  expectedDefinitionFiles.add(filename);
  if(await atomicWriteIfChanged(resolve(definitionsDir,filename),`import type { GeneratedScreenDefinition } from "../generatedScreenTypes";\nexport const ${symbol} = ${json(screen)} as const satisfies GeneratedScreenDefinition;\n`))contractFilesChanged++;
});
definitionImports.sort((left,right)=>left.file.localeCompare(right.file));
const imports=definitionImports.map(x=>`import { ${x.symbol} } from ${JSON.stringify(x.file)};`).join("\n");
// Widen each imported const before constructing the catalog.  Without this,
// TypeScript attempts to form a 1,000+ member literal union and fails before
// normal application type checking can begin.
const symbols=definitionImports.map(x=>`${x.symbol} as GeneratedScreenDefinition`).join(",\n  ");
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenTypes.ts"),`export type DesignCompleteness={score:number;complete:boolean;checks:Record<string,boolean>};\nexport type ScreenCoordinate={domain:string;process:string;step:string;state:string;actor:string;policy:string;view:string;device:string;locale:string;variant:string};\nexport type GeneratedScreenDefinition = { id:string; blueprintCode:string; processCode:string; stepCode:string; actorCode:string; audience:"USER"|"ADMIN"; pageId:string; pageName:string; routePath:string; screenType:string; templateCode:string; screenCoordinate:ScreenCoordinate; screenCoordinateKey:string; specification:Record<string,any>; traceability:Record<string,any>; designCompleteness:DesignCompleteness; };\n`))contractFilesChanged++;
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenCatalog.ts"),`import type { GeneratedScreenDefinition } from "./generatedScreenTypes";\n${imports}\nexport type { GeneratedScreenDefinition } from "./generatedScreenTypes";\nexport const GENERATED_SCREEN_CATALOG: readonly GeneratedScreenDefinition[] = [\n  ${symbols}\n];\nexport type GeneratedScreenLookup={processCode?:string;stepCode?:string;audience?:string};
export function findGeneratedScreen(pathname:string,lookup:GeneratedScreenLookup={}){const parsed=new URL(pathname,"http://screen.local");const normalized=parsed.pathname.replace(/^\\/en(?=\\/)/,"")||"/";const processCode=(lookup.processCode||parsed.searchParams.get("processCode")||"").toUpperCase();const stepCode=(lookup.stepCode||parsed.searchParams.get("step")||parsed.searchParams.get("stepCode")||"").toUpperCase();const audience=(lookup.audience||(normalized.startsWith("/admin/")?"ADMIN":"USER")).toUpperCase();const candidates=GENERATED_SCREEN_CATALOG.filter(screen=>screen.routePath===normalized&&screen.audience===audience);return candidates.find(screen=>(!processCode||screen.processCode===processCode)&&(!stepCode||screen.stepCode===stepCode))||candidates.find(screen=>!processCode||screen.processCode===processCode)||candidates[0];}\n`))contractFilesChanged++;
const routeScreens=Array.from(new Map(normalized.map(x=>[x.routePath,x])).values());
const routes=routeScreens.map(x=>({id:x.id,label:x.pageName,group:x.audience==="ADMIN"?"admin":"home",koPath:x.routePath,enPath:`/en${x.routePath}`}));
const units=routeScreens.map(x=>`  { id: ${JSON.stringify(x.id)}, exportName: "GeneratedScreenPage", loader: () => import("../../features/generated-screen/GeneratedScreenPage") }`).join(",\n");
const familyTemplate=await readFile(new URL("../src/generated/screen-generation/generatedScreenFamily.ts",import.meta.url),"utf8");
const family=familyTemplate.replace(/const GENERATED_SCREEN_ROUTES = [\s\S]*? as const satisfies RouteDefinitionsOf;/,`const GENERATED_SCREEN_ROUTES = ${json(routes)} as const satisfies RouteDefinitionsOf;`).replace(/const GENERATED_SCREEN_PAGE_UNITS = [\s\S]*? as const satisfies PageUnitsOf<typeof GENERATED_SCREEN_ROUTES>;/,`const GENERATED_SCREEN_PAGE_UNITS = [\n${units}\n] as const satisfies PageUnitsOf<typeof GENERATED_SCREEN_ROUTES>;`);
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenFamily.ts"),family))contractFilesChanged++;
const tests=normalized.map(x=>({pageId:x.pageId,actorCode:x.actorCode,routePath:x.routePath,requiredScenarios:x.traceability.requiredScenarioTypes,designScore:x.designCompleteness.score}));
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenTests.ts"),`export type GeneratedScreenTestContract={pageId:string;actorCode:string;routePath:string;requiredScenarios:readonly string[];designScore:number};\nexport const GENERATED_SCREEN_TESTS=${json(tests)} as const satisfies readonly GeneratedScreenTestContract[];\n`))contractFilesChanged++;
const coordinateIndex=normalized.map(x=>({key:x.screenCoordinateKey,pageId:x.pageId,routePath:x.routePath,coordinate:x.screenCoordinate}));
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenSpaceIndex.ts"),`import type { ScreenCoordinate } from "./generatedScreenTypes";\nexport type GeneratedScreenCoordinateIndex={key:string;pageId:string;routePath:string;coordinate:ScreenCoordinate};\nexport const GENERATED_SCREEN_SPACE_INDEX=${json(coordinateIndex)} as const satisfies readonly GeneratedScreenCoordinateIndex[];\nexport function findScreenByCoordinate(key:string){return GENERATED_SCREEN_SPACE_INDEX.find(item=>item.key===key);}\n`))contractFilesChanged++;
const staleDefinitions=(await readdir(definitionsDir)).filter(file=>file.endsWith(".ts")&&!expectedDefinitionFiles.has(file));
await mapConcurrent(staleDefinitions,file=>rm(resolve(definitionsDir,file),{force:true}));
const contractHash=createHash("sha256").update(json(normalized)).digest("hex");
const contractFileCount=normalized.length+5;
const dimensionNames=["domain","process","step","state","actor","policy","view","device","locale","variant"];
const discoveredDimensionCounts=Object.fromEntries(dimensionNames.map(key=>[key,new Set(normalized.map(x=>x.screenCoordinate[key])).size]));
const declaredDimensionCounts=input.screenSpace?.dimensionCounts || {};
const dimensionCounts=Object.fromEntries(dimensionNames.map(key=>{
  const declared=Number(declaredDimensionCounts[key] || 0);
  if(declared<0 || !Number.isSafeInteger(declared)) throw new Error(`Invalid screen-space dimension count: ${key}=${declaredDimensionCounts[key]}`);
  return [key,Math.max(discoveredDimensionCounts[key],declared)];
}));
const declaredScreenSpace=Object.values(dimensionCounts).reduce((total,count)=>total*BigInt(Math.max(1,count)),1n).toString();
const report={schemaVersion:"2.0.0",batch:input.batch,screenCount:normalized.length,userScreens:normalized.filter(x=>x.audience==="USER").length,adminScreens:normalized.filter(x=>x.audience==="ADMIN").length,completeDesigns:normalized.filter(x=>x.designCompleteness.complete).length,incompleteDesigns:normalized.filter(x=>!x.designCompleteness.complete).length,coordinateCount:coordinateIndex.length,dimensionCounts,declaredScreenSpace,reservedRoutesSkipped:skippedReservedRoutes.length,reservedRouteExamples:skippedReservedRoutes.slice(0,20),contractHash,durationMs:Math.round(performance.now()-startedAt),concurrency,contractFileCount,contractFilesChanged,contractFilesUnchanged:contractFileCount-contractFilesChanged,staleFilesRemoved:staleDefinitions.length,filesGenerated:contractFileCount+1};
await atomicWriteIfChanged(resolve(outDir,"generation-report.json"),json(report));
console.log(JSON.stringify({success:true,outDir,...report},null,2));
