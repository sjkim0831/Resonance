import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, rename, rm } from "node:fs/promises";
import { availableParallelism, freemem, loadavg, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import {
  comparableRouteKey,
  findCanonicalRoute,
  registerCanonicalRoute,
} from "./route-path-canonicalization.mjs";
import { GENERATED_SCREEN_TYPES_SOURCE } from "./generated-screen-type-contract.mjs";
import { buildGeneratedScreenDefinitionClosure } from "./generated-screen-definition-closure.mjs";

const startedAt = performance.now();
const args = Object.fromEntries(process.argv.slice(2).map((value,index,all)=>value.startsWith("--")?[value.slice(2),all[index+1]?.startsWith("--")?"true":all[index+1]]:null).filter(Boolean));
if (!args.input) throw new Error("Usage: node scripts/generate-screen-blueprints.mjs --input <batch-export.json> [--limit 5000] [--strict true]");
const input = JSON.parse(await readFile(resolve(args.input), "utf8"));
const sourceRecord=(value)=>value&&typeof value==="object"&&!Array.isArray(value)?value:{};
const sourceLanePayload=(value)=>{const lane=sourceRecord(value);return Object.prototype.hasOwnProperty.call(lane,"payload")?lane.payload:value;};
const sourceArray=(value,...keys)=>{if(Array.isArray(value))return value;let row=sourceRecord(value);for(const key of keys){if(Array.isArray(row[key]))return row[key];row=sourceRecord(row[key]);}return [];};
const sourceContracts=(value)=>{const payload=sourceLanePayload(value);return sourceArray(payload,"contracts");};
const sourceText=(sources,keys,fallback="")=>{for(const source of sources){const row=sourceRecord(source);for(const key of keys){if(row[key]!=null&&String(row[key]).trim())return String(row[key]).trim();}}return fallback;};
const stableValue=(value)=>Array.isArray(value)?value.map(stableValue):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])])):value;
const stableJson=(value)=>JSON.stringify(stableValue(value));
const sha256=(value)=>createHash("sha256").update(typeof value==="string"?value:stableJson(value)).digest("hex");
const canonicalLaneKeys=["HELP","WORK_GUIDE","QA","DESIGN_CARD","FRONTEND","API","DATABASE"];
const requireRecord=(value,label)=>{const row=sourceRecord(value);if(!Object.keys(row).length)throw new Error(`Canonical ${label} must be a non-empty object.`);return row;};
const canonicalSupportItem=(value,index,kind)=>{
  const row=sourceRecord(value),code=String(row.code||row.id||`${kind}_${index+1}`);
  return {...row,code,label:String(row.label||row.title||row.name||row.code||row.id||`${kind} ${index+1}`),
    ...(row.description==null&&row.body!=null?{description:String(row.body)}:{})};
};
const requireText=(value,label)=>{if(value==null||!String(value).trim())throw new Error(`Canonical ${label} is required.`);return String(value).trim();};
function validateCanonicalScreen(screen,index){
  requireText(screen.screenKey,`screens[${index}].screenKey`);requireText(screen.processCode,`screens[${index}].processCode`);
  requireText(screen.stepCode,`screens[${index}].stepCode`);const audience=requireText(screen.audience,`screens[${index}].audience`).toUpperCase();
  if(!["USER","ADMIN"].includes(audience))throw new Error(`Canonical screens[${index}].audience is invalid.`);
  const routePath=requireText(screen.routePath,`screens[${index}].routePath`);if(!routePath.startsWith("/"))throw new Error(`Canonical screens[${index}].routePath is invalid.`);
  if(!/^[a-f0-9]{64}$/.test(String(screen.designHash||"")))throw new Error(`Canonical screens[${index}].designHash must be a SHA-256 hash.`);
  const canonicalText=requireText(screen.canonicalText,`screens[${index}].canonicalText`);
  if(sha256(canonicalText)!==screen.designHash)throw new Error(`Canonical screens[${index}].canonicalText hash mismatch.`);
  let parsedCanonical;
  try{parsedCanonical=JSON.parse(canonicalText);}catch{throw new Error(`Canonical screens[${index}].canonicalText is invalid JSON.`);}
  if(stableJson(parsedCanonical)!==stableJson(screen.canonicalDesign))throw new Error(`Canonical screens[${index}].canonicalText does not match canonicalDesign.`);
  screen.canonicalDesign=parsedCanonical;
  const canonical=requireRecord(parsedCanonical,`screens[${index}].canonicalDesign`),identity=requireRecord(canonical.identity,`screens[${index}].canonicalDesign.identity`);
  requireRecord(canonical.process,`screens[${index}].canonicalDesign.process`);requireRecord(canonical.step,`screens[${index}].canonicalDesign.step`);
  const lanes=requireRecord(canonical.lanes,`screens[${index}].canonicalDesign.lanes`);
  for(const key of ["HELP","WORK_GUIDE","QA","DESIGN_CARD","FRONTEND"])requireRecord(lanes[key],`screens[${index}].canonicalDesign.lanes.${key}`);
  for(const key of ["API","DATABASE"]){
    if(!Array.isArray(lanes[key])||!lanes[key].length)throw new Error(`Canonical screens[${index}].canonicalDesign.lanes.${key} must be a non-empty array.`);
  }
  if(Object.keys(lanes).some(key=>!canonicalLaneKeys.includes(key)))throw new Error(`Canonical screens[${index}].canonicalDesign.lanes contains an unsupported lane.`);
  const exactScreenKey=`${String(screen.processCode).toUpperCase()}|${String(screen.stepCode).toUpperCase()}|${audience}|${routePath.toLowerCase()}`;
  if(screen.screenKey!==exactScreenKey||identity.screenKey!==screen.screenKey)throw new Error(`Canonical screens[${index}].screenKey is not the normalized identity.`);
  for(const [key,expected] of [["processCode",screen.processCode],["stepCode",screen.stepCode],["audience",audience],["routePath",routePath]]){
    if(String(identity[key]||"").toUpperCase()!==String(expected).toUpperCase())throw new Error(`Canonical screens[${index}].identity.${key} mismatch.`);
  }
  if(!sourceContracts(lanes.API).length)throw new Error(`Canonical screens[${index}].API contracts are required.`);
  if(!sourceContracts(lanes.DATABASE).length)throw new Error(`Canonical screens[${index}].DATABASE contracts are required.`);
  const help=sourceRecord(sourceLanePayload(lanes.HELP));
  const helpItems=sourceArray(help.items);
  if(!requireText(help.title,`screens[${index}].HELP.title`)||!requireText(help.summary,`screens[${index}].HELP.summary`)||!helpItems.length)throw new Error(`Canonical screens[${index}].HELP is incomplete.`);
  if(helpItems.some(item=>!sourceRecord(item).id||!sourceRecord(item).anchorSelector||!sourceRecord(item).title||!sourceRecord(item).body))throw new Error(`Canonical screens[${index}].HELP.items require id, title, body and anchorSelector.`);
  const guide=sourceRecord(sourceLanePayload(lanes.WORK_GUIDE));
  const nextAction=requireRecord(guide.nextAction,`screens[${index}].WORK_GUIDE.nextAction`);
  if(!sourceArray(guide.steps).length||!requireText(nextAction.label,`screens[${index}].WORK_GUIDE.nextAction.label`)||!requireText(nextAction.routePath,`screens[${index}].WORK_GUIDE.nextAction.routePath`))throw new Error(`Canonical screens[${index}].WORK_GUIDE is incomplete.`);
  const qa=sourceRecord(sourceLanePayload(lanes.QA)),scenarios=sourceArray(qa.requiredScenarioTypes);
  if(!["HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"].every(type=>scenarios.includes(type))||!sourceArray(qa.checks).length)throw new Error(`Canonical screens[${index}].QA requires five scenarios and checks.`);
  const designCard=sourceRecord(sourceLanePayload(lanes.DESIGN_CARD));
  if(!sourceArray(designCard.assetBindings).length)throw new Error(`Canonical screens[${index}].DESIGN_CARD assetBindings are required.`);
  requireText(designCard.pageName,`screens[${index}].DESIGN_CARD.pageName`);
  requireText(designCard.screenType,`screens[${index}].DESIGN_CARD.screenType`);
  requireText(designCard.designSystem,`screens[${index}].DESIGN_CARD.designSystem`);
  requireText(designCard.templateCode,`screens[${index}].DESIGN_CARD.templateCode`);
}
function canonicalScreenToBlueprint(screen){
  const canonical=sourceRecord(screen.canonicalDesign),lanes=sourceRecord(canonical.lanes);
  const frontend=sourceRecord(sourceLanePayload(lanes.FRONTEND)),metadata=sourceRecord(frontend.metadata||frontend.screen);
  const identity=sourceRecord(canonical.identity),process=sourceRecord(canonical.process),step=sourceRecord(canonical.step),designCardLane=sourceRecord(sourceLanePayload(lanes.DESIGN_CARD));
  const apiContracts=sourceContracts(lanes.API),dataContracts=sourceContracts(lanes.DATABASE);
  const helpPayload=sourceLanePayload(lanes.HELP);
  const help=sourceRecord(sourceRecord(helpPayload).help||helpPayload),guide=sourceRecord(sourceLanePayload(lanes.WORK_GUIDE));
  const qa=sourceRecord(sourceLanePayload(lanes.QA)),designCard=designCardLane;
  const actorCode=requireText(identity.actorCode,"canonical identity.actorCode");
  const pageId=requireText(identity.pageId,"canonical identity.pageId");
  const baseSpecification={...sourceRecord(canonical.specification),...sourceRecord(designCard.specification),...sourceRecord(frontend.specification)};
  const frontendFields=sourceArray(frontend.fields,"fields"),frontendSections=sourceArray(frontend.sections,"sections"),frontendActions=sourceArray(frontend.actions,"commands","actions");
  const frontendStates=sourceArray(frontend.states,"states"),qaTrace=sourceRecord(qa.traceability);
  const normalizedHelp={...help,pageId:String(help.pageId||pageId)};
  const normalizedGuide={...guide,steps:sourceArray(guide.steps).map((entry,index)=>canonicalSupportItem(entry,index,"GUIDE"))};
  const normalizedQa={...qa,checks:sourceArray(qa.checks).map((entry,index)=>canonicalSupportItem(entry,index,"QA"))};
  const support={
    ...sourceRecord(canonical.support),
    help:normalizedHelp,workGuide:normalizedGuide,qa:normalizedQa,designCard,
    assetBindings:sourceArray(designCard.assetBindings)
  };
  const sources=[screen,identity,metadata,frontend,designCard,canonical];
  const processCode=String(screen.processCode),stepCode=String(screen.stepCode);
  const routePath=String(screen.routePath);
  const businessPurpose=sourceText([baseSpecification,help,process,step],["businessPurpose","summary","goal","requirement"],pageId);
  const entryConditions=sourceArray(baseSpecification.entryConditions).length?sourceArray(baseSpecification.entryConditions):[sourceText([help,process,step],["entryCondition","startCondition","fromState"],"Assigned actor and project context are valid.")];
  const exitConditions=sourceArray(baseSpecification.exitConditions).length?sourceArray(baseSpecification.exitConditions):[sourceText([help,process,step],["exitCondition","completionCondition","completionRule","toState"],"The step result and evidence are persisted.")];
  const states=sourceArray(baseSpecification.states).length?sourceArray(baseSpecification.states):(frontendStates.length?frontendStates:[step.fromState,step.toState].filter(Boolean));
  const actorResponsibilities=sourceArray(baseSpecification.actorResponsibilities).length?sourceArray(baseSpecification.actorResponsibilities):[sourceText([step,guide],["requirement","summary"],`${actorCode} executes ${stepCode}.`)];
  const permissions=sourceArray(baseSpecification.permissions).length?sourceArray(baseSpecification.permissions):[{code:`${actorCode}_EXECUTE`,scope:"TENANT_PROJECT",actorCode}];
  const validations=sourceArray(baseSpecification.validations).length?sourceArray(baseSpecification.validations):[{code:"CANONICAL_QA_GATE",type:"CONTRACT",requiredScenarioTypes:qa.requiredScenarioTypes||[]}];
  const exceptionStates=sourceArray(help.exceptionStates,"states");
  const errors=sourceArray(baseSpecification.errors).length?sourceArray(baseSpecification.errors):(exceptionStates.length?exceptionStates:[{code:"PROCESS_EXCEPTION",recovery:step.rollbackCommandCode||"Retry from the persisted process state."}]);
  const specification={...baseSpecification,businessPurpose,actorResponsibilities,entryConditions,exitConditions,states,
    sections:frontendSections.length?frontendSections:baseSpecification.sections,fields:frontendFields.length?frontendFields:baseSpecification.fields,
    actions:frontendActions.length?frontendActions:baseSpecification.actions,apiContracts:apiContracts.length?apiContracts:baseSpecification.apiContracts,
    dataContracts:dataContracts.length?dataContracts:baseSpecification.dataContracts,permissions,validations,errors,
    responsive:frontend.responsive||baseSpecification.responsive,accessibility:frontend.accessibility||baseSpecification.accessibility,
    completionRule:sourceText([baseSpecification,step,process],["completionRule","completionCondition"],exitConditions[0]),support};
  const requiredScenarioTypes=sourceArray(qa.requiredScenarioTypes).length?sourceArray(qa.requiredScenarioTypes):sourceArray(qaTrace.requiredScenarioTypes);
  return {
    blueprintCode:requireText(identity.blueprintCode,"canonical identity.blueprintCode"),processCode,stepCode,actorCode,
    audience:String(screen.audience).toUpperCase(),pageId,pageName:requireText(designCard.pageName,"canonical DESIGN_CARD.pageName"),routePath,
    screenType:requireText(designCard.screenType,"canonical DESIGN_CARD.screenType"),templateCode:requireText(designCard.templateCode,"canonical DESIGN_CARD.templateCode"),
    specificationJson:specification,
    traceabilityJson:{...qaTrace,...sourceRecord(canonical.traceability||frontend.traceability),requiredScenarioTypes},validationStatus:String(qa.validationStatus),
    designHash:String(screen.designHash),screenKey:String(screen.screenKey)
  };
}
const canonicalInput=input.schema==="carbonet.canonical-design/v1"&&Array.isArray(input.screens);
if(canonicalInput){
  if(!/^[a-f0-9]{64}$/.test(String(input.catalogHash||"")))throw new Error("Canonical design catalogHash must be a SHA-256 hash.");
  if(Number(input.screenCount)!==input.screens.length)throw new Error(`Canonical screenCount mismatch: ${input.screenCount} != ${input.screens.length}`);
  input.screens.forEach(validateCanonicalScreen);
  const expectedCatalogHash=sha256(input.screens.map(screen=>`${screen.screenKey}\u001f${screen.designHash}`).join("\n"));
  if(expectedCatalogHash!==input.catalogHash)throw new Error("Canonical design catalogHash does not match the ordered screen identities and design hashes.");
}
const sourceBlueprints=Array.isArray(input.blueprints)?input.blueprints:(canonicalInput?input.screens.map(canonicalScreenToBlueprint):null);
if(!sourceBlueprints||(!canonicalInput&&!["1.0.0","2.0.0","4.0.0"].includes(input.schemaVersion)))throw new Error("Unsupported or invalid blueprint export.");
const inputSchemaVersion=canonicalInput?"4.0.0":input.schemaVersion;
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
const validBlueprints = sourceBlueprints.filter((item) => (item.validationStatus||"VALID") === "VALID");
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
const record=(value)=>value&&typeof value==="object"&&!Array.isArray(value)?value:{};
const slug=(value)=>String(value||"").toLowerCase().replace(/[^a-z0-9가-힣]+/g,"-").replace(/^-|-$/g,"")||"item";
const supportItems=(value,kind)=>objects(value,kind).map((item,index)=>({
  ...item,code:String(item.code||item.id||`${kind}_${index+1}`),label:String(item.label||item.title||item.name||item.code||`${kind} ${index+1}`),
  description:item.description==null&&item.body!=null?String(item.body):item.description
}));
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

function normalizeSupport(rawSupport,item,specification,traceability){
  const supplied=record(rawSupport),pageSlug=slug(item.pageId),sections=supportItems(specification.sections,"SECTION"),actions=supportItems(specification.actions,"ACTION");
  const suppliedHelp=record(supplied.help),suppliedHelpItems=Array.isArray(suppliedHelp.items)?suppliedHelp.items:[];
  const helpItems=(suppliedHelpItems.length?suppliedHelpItems:sections).map((entry,index)=>{
    const row=record(entry),id=String(row.id||row.code||`section-${index+1}`);
    return {...row,id,title:String(row.title||row.label||row.name||id),body:String(row.body||row.description||`${row.label||row.title||id} 영역의 업무 정보와 처리 상태를 확인합니다.`),
      anchorSelector:String(row.anchorSelector||`[data-help-id="generated-${pageSlug}-${slug(id)}"]`),placement:row.placement||"top",highlightStyle:row.highlightStyle||"neutral"};
  });
  const help={...suppliedHelp,pageId:String(suppliedHelp.pageId||item.pageId),title:String(suppliedHelp.title||`${item.pageName} 도움말`),
    summary:String(suppliedHelp.summary||specification.businessPurpose),items:helpItems};
  const suppliedGuide=record(supplied.workGuide),guideSteps=supportItems(suppliedGuide.steps,"GUIDE");
  const workGuide={...suppliedGuide,title:String(suppliedGuide.title||`${item.pageName} 업무 길잡이`),summary:String(suppliedGuide.summary||specification.businessPurpose),
    steps:guideSteps.length?guideSteps:[
      {code:"ENTRY",label:"진입 조건 확인",description:specification.entryConditions.join(" · ")},
      {code:"WORK",label:"업무 정보 작성",description:sections.map(section=>section.label).join(" · "),path:item.routePath},
      {code:"COMPLETE",label:"검증 후 완료",description:specification.completionRule}
    ],commands:supportItems(suppliedGuide.commands,"COMMAND").length?supportItems(suppliedGuide.commands,"COMMAND"):actions,
    nextAction:sourceRecord(suppliedGuide.nextAction).routePath?sourceRecord(suppliedGuide.nextAction):{label:"다음 업무 진행",routePath:item.routePath,completionRule:specification.completionRule}};
  const suppliedQa=record(supplied.qa),qaChecks=supportItems(suppliedQa.checks,"QA"),requiredScenarioTypes=Array.from(new Set(strings(suppliedQa.requiredScenarioTypes).length?strings(suppliedQa.requiredScenarioTypes):(strings(suppliedQa.requiredScenarios).length?strings(suppliedQa.requiredScenarios):traceability.requiredScenarioTypes||[])));
  const qa={...suppliedQa,title:String(suppliedQa.title||`${item.pageName} QA`),summary:String(suppliedQa.summary||"페이지와 프로세스 계약의 자동 검증 기준입니다."),requiredScenarioTypes,
    checks:qaChecks.length?qaChecks:[...supportItems(specification.validations,"VALIDATION"),...supportItems(specification.errors,"ERROR")],
    acceptanceCriteria:strings(suppliedQa.acceptanceCriteria).length?strings(suppliedQa.acceptanceCriteria):specification.exitConditions};
  const suppliedCard=record(supplied.designCard);
  const designCard={...suppliedCard,pageName:String(suppliedCard.pageName||item.pageName),title:String(suppliedCard.title||item.pageName),summary:String(suppliedCard.summary||specification.businessPurpose),
    designSystem:String(suppliedCard.designSystem||specification.designSystem),screenType:String(suppliedCard.screenType||item.screenType),templateCode:String(suppliedCard.templateCode||item.templateCode),
    sectionCount:Number(suppliedCard.sectionCount??specification.sections.length),fieldCount:Number(suppliedCard.fieldCount??specification.fields.length),actionCount:Number(suppliedCard.actionCount??specification.actions.length)};
  const suppliedAssets=Array.isArray(supplied.assetBindings)?supplied.assetBindings:[];
  const assetBindings=(suppliedAssets.length?suppliedAssets:sections.map(section=>({assetType:"SECTION",assetCode:String(section.assetCode||section.code),slot:String(section.slot||section.code)}))).map((entry,index)=>{
    const row=record(entry);return {...row,assetType:String(row.assetType||row.type||"COMPONENT"),assetCode:String(row.assetCode||row.code||`ASSET_${index+1}`)};
  });
  return {help,workGuide,qa,designCard,assetBindings};
}

function normalizeSpecification(raw, item, traceability) {
  const fields=objects(raw.fields,"FIELD"), sections=objects(raw.sections,"SECTION"), actions=objects(raw.actions || raw.commands,"ACTION");
  const specification={
    schemaVersion:inputSchemaVersion, designSystem:raw.designSystem || "KRDS_GOV", businessPurpose:raw.businessPurpose || item.pageName,
    actorResponsibilities:strings(raw.actorResponsibilities), entryConditions:strings(raw.entryConditions || [raw.entryCondition || raw.fromState]),
    exitConditions:strings(raw.exitConditions || [raw.exitCondition || raw.toState]), states:strings(raw.states), kpis:objects(raw.kpis,"KPI"),
    sections, fields, actions, apiContracts:objects(raw.apiContracts,"API"), dataContracts:objects(raw.dataContracts,"DATA"),
    permissions:objects(raw.permissions,"PERMISSION"), validations:objects(raw.validations,"VALIDATION"), errors:objects(raw.errors,"ERROR"),
    responsive:raw.responsive || { mobile:"single-column",tablet:"adaptive-grid",desktop:"task-and-context" },
    accessibility:raw.accessibility || { standard:"WCAG_2_1_AA",keyboard:true,labels:true,focusManagement:true },
    completionRule:raw.completionRule || "Required validation passes and the process transition is persisted.",
    extensions:raw.extensions || {}
  };
  const supportSource=raw.support||record(raw.extensions).support||(item.supportJson?parse(item.supportJson,item.blueprintCode):{});
  const support=canonicalInput?supportSource:normalizeSupport(supportSource,item,specification,traceability);
  return {...specification,support};
}

function completeness(spec, trace) {
  const checks={purpose:!!spec.businessPurpose,actor:spec.actorResponsibilities.length>0,entry:spec.entryConditions.length>0,exit:spec.exitConditions.length>0,
    sections:spec.sections.length>0,fields:spec.fields.length>0,actions:spec.actions.length>0,api:spec.apiContracts.length>0,data:spec.dataContracts.length>0,
    permissions:spec.permissions.length>0,validations:spec.validations.length>0,states:spec.states.length>0,errors:spec.errors.length>0,responsive:!!spec.responsive,
    accessibility:!!spec.accessibility,tests:requiredScenarioTypes.every(type=>(trace.requiredScenarioTypes||[]).includes(type)),
    help:!!spec.support.help.title&&!!spec.support.help.summary&&spec.support.help.items.length>0,
    workGuide:spec.support.workGuide.steps.length>0&&!!spec.support.workGuide.nextAction,
    qa:requiredScenarioTypes.every(type=>spec.support.qa.requiredScenarioTypes.includes(type))&&spec.support.qa.checks.length>0,
    designCard:!!spec.support.designCard.pageName&&!!spec.support.designCard.designSystem,
    assetBindings:spec.support.assetBindings.length>0};
  const passed=Object.values(checks).filter(Boolean).length;
  return {score:Math.round(passed/Object.keys(checks).length*100),checks,complete:passed===Object.keys(checks).length};
}

if(canonicalInput){
  const actualCatalogHash=sha256(input.screens.map(screen=>`${screen.screenKey}\u001f${screen.designHash}`).join("\n"));
  if(actualCatalogHash!==input.catalogHash)throw new Error(`Canonical catalogHash mismatch: ${input.catalogHash} != ${actualCatalogHash}`);
}

const normalized = blueprints.map((item) => {
  const id = String(item.pageId).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const routePath = String(item.routePath || "");
  if (!id || seenIds.has(id)) throw new Error(`Duplicate/invalid page id: ${id}`);
  if (!routePath.startsWith("/")) throw new Error(`Invalid route: ${routePath}`);
  seenIds.add(id); seenRoutes.add(routePath);
  const traceability=parse(item.traceabilityJson,item.blueprintCode);
  traceability.requiredScenarioTypes=Array.from(new Set([...(traceability.requiredScenarioTypes||[])]));
  const specification=normalizeSpecification(parse(item.specificationJson,item.blueprintCode),item,traceability);
  const designCompleteness=completeness(specification,traceability);
  const screenCoordinate=coordinateOf(item,specification);
  if(strict && !designCompleteness.complete) throw new Error(`Incomplete detailed design: ${item.blueprintCode} (${designCompleteness.score}%)`);
  const hashSource={id,blueprintCode:item.blueprintCode,processCode:item.processCode,stepCode:item.stepCode,actorCode:item.actorCode,audience:item.audience,
    pageId:item.pageId,pageName:item.pageName,routePath,screenType:item.screenType,templateCode:item.templateCode,
    screenCoordinate,screenCoordinateKey:coordinateKey(screenCoordinate),specification,traceability,designCompleteness};
  const suppliedHash=String(item.designHash||"").trim().toLowerCase();
  if(suppliedHash&&!/^[a-f0-9]{64}$/.test(suppliedHash))throw new Error(`Invalid designHash: ${item.blueprintCode}`);
  const designHash=suppliedHash||sha256(hashSource);
  return { id, blueprintCode:item.blueprintCode, processCode:item.processCode, stepCode:item.stepCode, actorCode:item.actorCode, audience:item.audience,
    pageId:item.pageId, pageName:item.pageName, routePath, screenType:item.screenType, templateCode:item.templateCode,
    screenCoordinate, screenCoordinateKey:coordinateKey(screenCoordinate), specification, traceability, designCompleteness, designHash, support:specification.support };
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
const generationCatalogHash=canonicalInput?String(input.catalogHash):sha256(normalized);
// Widen each imported const before constructing the catalog.  Without this,
// TypeScript attempts to form a 1,000+ member literal union and fails before
// normal application type checking can begin.
const symbols=definitionImports.map(x=>`${x.symbol} as GeneratedScreenDefinition`).join(",\n  ");
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenTypes.ts"),GENERATED_SCREEN_TYPES_SOURCE))contractFilesChanged++;
const catalogContent=`import type { GeneratedScreenDefinition } from "./generatedScreenTypes";\n${imports}\nexport type { GeneratedScreenDefinition } from "./generatedScreenTypes";\nexport const GENERATED_SCREEN_CATALOG: readonly GeneratedScreenDefinition[] = [\n  ${symbols}\n];\nexport const GENERATED_SCREEN_CATALOG_HASH=${JSON.stringify(generationCatalogHash)};\nexport const GENERATED_SCREEN_CATALOG_DESIGN_HASHES=${json(Object.fromEntries(normalized.map(screen=>[screen.pageId,screen.designHash])))} as const;\nexport type GeneratedScreenLookup={processCode?:string;stepCode?:string;audience?:string};
export function findGeneratedScreen(pathname:string,lookup:GeneratedScreenLookup={}){const parsed=new URL(pathname,"http://screen.local");const normalized=parsed.pathname.replace(/^\\/en(?=\\/)/,"")||"/";const processCode=(lookup.processCode||parsed.searchParams.get("processCode")||"").toUpperCase();const stepCode=(lookup.stepCode||parsed.searchParams.get("step")||parsed.searchParams.get("stepCode")||"").toUpperCase();const audience=(lookup.audience||(normalized.startsWith("/admin/")?"ADMIN":"USER")).toUpperCase();const candidates=GENERATED_SCREEN_CATALOG.filter(screen=>screen.routePath===normalized&&screen.audience===audience);return candidates.find(screen=>(!processCode||screen.processCode===processCode)&&(!stepCode||screen.stepCode===stepCode))||candidates.find(screen=>!processCode||screen.processCode===processCode)||candidates[0];}\n`;
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenCatalog.ts"),catalogContent))contractFilesChanged++;
const routeScreens=Array.from(new Map(normalized.map(x=>[x.routePath,x])).values());
const routes=routeScreens.map(x=>({id:x.id,label:x.pageName,group:x.audience==="ADMIN"?"admin":"home",koPath:x.routePath,enPath:`/en${x.routePath}`}));
const routeDesignHashes=Object.fromEntries(routeScreens.map(x=>[x.id,x.designHash]));
const units=routeScreens.map(x=>`  { id: ${JSON.stringify(x.id)}, exportName: "GeneratedScreenPage", loader: () => import("../../features/generated-screen/GeneratedScreenPage") }`).join(",\n");
const familyTemplate=await readFile(new URL("../src/generated/screen-generation/generatedScreenFamily.ts",import.meta.url),"utf8");
const familyBase=familyTemplate.replace(/\nexport const GENERATED_SCREEN_DESIGN_HASHES = [\s\S]*? as const;\n/,"\n");
const family=familyBase.replace(/const GENERATED_SCREEN_ROUTES = [\s\S]*? as const satisfies RouteDefinitionsOf;/,`const GENERATED_SCREEN_ROUTES = ${json(routes)} as const satisfies RouteDefinitionsOf;\nexport const GENERATED_SCREEN_DESIGN_HASHES = ${json(routeDesignHashes)} as const;`).replace(/const GENERATED_SCREEN_PAGE_UNITS = [\s\S]*? as const satisfies PageUnitsOf<typeof GENERATED_SCREEN_ROUTES>;/,`const GENERATED_SCREEN_PAGE_UNITS = [\n${units}\n] as const satisfies PageUnitsOf<typeof GENERATED_SCREEN_ROUTES>;`);
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenFamily.ts"),family))contractFilesChanged++;
const tests=normalized.map(x=>({pageId:x.pageId,actorCode:x.actorCode,routePath:x.routePath,designHash:x.designHash,requiredScenarios:x.traceability.requiredScenarioTypes,designScore:x.designCompleteness.score}));
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenTests.ts"),`export type GeneratedScreenTestContract={pageId:string;actorCode:string;routePath:string;designHash:string;requiredScenarios:readonly string[];designScore:number};\nexport const GENERATED_SCREEN_TESTS=${json(tests)} as const satisfies readonly GeneratedScreenTestContract[];\n`))contractFilesChanged++;
const coordinateIndex=normalized.map(x=>({key:x.screenCoordinateKey,pageId:x.pageId,routePath:x.routePath,designHash:x.designHash,coordinate:x.screenCoordinate}));
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenSpaceIndex.ts"),`import type { ScreenCoordinate } from "./generatedScreenTypes";\nexport type GeneratedScreenCoordinateIndex={key:string;pageId:string;routePath:string;designHash:string;coordinate:ScreenCoordinate};\nexport const GENERATED_SCREEN_SPACE_INDEX=${json(coordinateIndex)} as const satisfies readonly GeneratedScreenCoordinateIndex[];\nexport function findScreenByCoordinate(key:string){return GENERATED_SCREEN_SPACE_INDEX.find(item=>item.key===key);}\n`))contractFilesChanged++;
const supportCatalog=normalized.map(x=>({pageId:x.pageId,routePath:x.routePath,designHash:x.designHash,support:x.support}));
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenSupportCatalog.ts"),`import type { GeneratedScreenSupportCatalogEntry } from "./generatedScreenTypes";\nexport const GENERATED_SCREEN_SUPPORT_CATALOG=${json(supportCatalog)} as const satisfies readonly GeneratedScreenSupportCatalogEntry[];\nconst supportKey=(value:string)=>String(value||"").replace(/^\\/en(?=\\/)/,"").replace(/\\?.*$/,"").toLowerCase().replace(/[^a-z0-9가-힣/]+/g,"-");\nexport function findGeneratedScreenSupport(pageIdOrPath:string){const key=supportKey(pageIdOrPath);return GENERATED_SCREEN_SUPPORT_CATALOG.find(entry=>supportKey(entry.pageId)===key||supportKey(entry.routePath)===key);}\n`))contractFilesChanged++;
const makeLane=(designHash,payload)=>{const core={designHash,payload};return {...core,laneHash:sha256(core)};};
const manifestScreens=normalized.map(screen=>{
  const {support:omittedSupport,...frontendSpecification}=screen.specification;
  const frontendPayload={id:screen.id,blueprintCode:screen.blueprintCode,processCode:screen.processCode,stepCode:screen.stepCode,actorCode:screen.actorCode,audience:screen.audience,pageId:screen.pageId,pageName:screen.pageName,routePath:screen.routePath,screenType:screen.screenType,templateCode:screen.templateCode,screenCoordinate:screen.screenCoordinate,screenCoordinateKey:screen.screenCoordinateKey,designCompleteness:screen.designCompleteness,specification:frontendSpecification,traceability:screen.traceability};
  const lanes={FRONTEND:makeLane(screen.designHash,frontendPayload),API:makeLane(screen.designHash,screen.specification.apiContracts),DATABASE:makeLane(screen.designHash,screen.specification.dataContracts),HELP:makeLane(screen.designHash,screen.support.help),CARDS:makeLane(screen.designHash,{workGuide:screen.support.workGuide,qa:screen.support.qa,designCard:screen.support.designCard,assetBindings:screen.support.assetBindings})};
  const core={pageId:screen.pageId,routePath:screen.routePath,designHash:screen.designHash,lanes};return {...core,bundleHash:sha256(core)};
});
const contractHash=generationCatalogHash,manifestCore={schema:"carbonet.generated-screen-bundle/v1",catalogHash:contractHash,screenCount:manifestScreens.length,screens:manifestScreens};
const bundleManifest={...manifestCore,bundleHash:sha256(manifestCore)};
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenBundleManifest.json"),json(bundleManifest)))contractFilesChanged++;
const staleDefinitions=(await readdir(definitionsDir)).filter(file=>file.endsWith(".ts")&&!expectedDefinitionFiles.has(file));
await mapConcurrent(staleDefinitions,file=>rm(resolve(definitionsDir,file),{force:true}));
// This manifest is the publication commit marker. Consumers reject an old or
// partially written catalog/definition set, so an interrupted or concurrent
// generation can fail closed but can never enter TypeScript as a mixed bundle.
const definitionClosure=await buildGeneratedScreenDefinitionClosure({
  catalogSource:catalogContent,
  typeContractSource:GENERATED_SCREEN_TYPES_SOURCE,
  definitionsRoot:definitionsDir,
});
if(definitionClosure.definitionSet.actualFileCount!==normalized.length||definitionClosure.definitionSet.extraFiles.length){
  throw new Error("Generated definition directory is not an exact catalog closure.");
}
if(await atomicWriteIfChanged(resolve(outDir,"generatedScreenDefinitionClosure.json"),`${json(definitionClosure.manifest)}\n`))contractFilesChanged++;
const contractFileCount=normalized.length+8;
const dimensionNames=["domain","process","step","state","actor","policy","view","device","locale","variant"];
const discoveredDimensionCounts=Object.fromEntries(dimensionNames.map(key=>[key,new Set(normalized.map(x=>x.screenCoordinate[key])).size]));
const declaredDimensionCounts=input.screenSpace?.dimensionCounts || {};
const dimensionCounts=Object.fromEntries(dimensionNames.map(key=>{
  const declared=Number(declaredDimensionCounts[key] || 0);
  if(declared<0 || !Number.isSafeInteger(declared)) throw new Error(`Invalid screen-space dimension count: ${key}=${declaredDimensionCounts[key]}`);
  return [key,Math.max(discoveredDimensionCounts[key],declared)];
}));
const declaredScreenSpace=Object.values(dimensionCounts).reduce((total,count)=>total*BigInt(Math.max(1,count)),1n).toString();
const report={schemaVersion:inputSchemaVersion,sourceSchema:canonicalInput?input.schema:input.schemaVersion,batch:input.batch,screenCount:normalized.length,userScreens:normalized.filter(x=>x.audience==="USER").length,adminScreens:normalized.filter(x=>x.audience==="ADMIN").length,completeDesigns:normalized.filter(x=>x.designCompleteness.complete).length,incompleteDesigns:normalized.filter(x=>!x.designCompleteness.complete).length,coordinateCount:coordinateIndex.length,dimensionCounts,declaredScreenSpace,reservedRoutesSkipped:skippedReservedRoutes.length,reservedRouteExamples:skippedReservedRoutes.slice(0,20),contractHash,bundleHash:bundleManifest.bundleHash,designHashes:normalized.map(x=>({pageId:x.pageId,designHash:x.designHash})),durationMs:Math.round(performance.now()-startedAt),concurrency,contractFileCount,contractFilesChanged,contractFilesUnchanged:contractFileCount-contractFilesChanged,staleFilesRemoved:staleDefinitions.length,filesGenerated:contractFileCount+1};
await atomicWriteIfChanged(resolve(outDir,"generation-report.json"),json(report));
console.log(JSON.stringify({success:true,outDir,...report},null,2));
