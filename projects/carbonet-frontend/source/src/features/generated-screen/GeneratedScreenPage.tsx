import { FormEvent, useEffect, useMemo, useState } from "react";
import { findGeneratedScreen, type GeneratedScreenDefinition } from "../../generated/screen-generation/generatedScreenCatalog";
import { isEnglish } from "../../lib/navigation/runtime";
import { runtimeUuid } from "../../lib/runtime-id";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ContractFieldControl } from "./ContractFieldControl";
import { materializeScreen, resolveScreenCoordinate } from "./screenSpaceRuntime";

type ContractItem = { code: string; label: string; [key: string]: unknown };
type NextTask = { stepCode: string; actorCode: string; path: string };
const list = (value: unknown) => Array.isArray(value) ? value.map(item=>typeof item === "string" ? item : String((item as Record<string,unknown>)?.label || (item as Record<string,unknown>)?.name || (item as Record<string,unknown>)?.code || "")).filter(Boolean) : [];
const items = (value: unknown, prefix: string): ContractItem[] => Array.isArray(value) ? value.map((item,index)=>typeof item === "string" ? {code:item||`${prefix}_${index+1}`,label:item} : {...(item as Record<string,unknown>),code:String((item as Record<string,unknown>)?.code||`${prefix}_${index+1}`),label:String((item as Record<string,unknown>)?.label||(item as Record<string,unknown>)?.name||(item as Record<string,unknown>)?.code||`${prefix} ${index+1}`)}).filter(item=>item.label) : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const inputClass = "krds-control h-11 w-full rounded-lg border border-slate-300 bg-white px-3 focus:border-[#246beb] focus:outline-none focus:ring-2 focus:ring-blue-100";

function GeneratedContent({ screen }: { screen: GeneratedScreenDefinition }) {
  const en = isEnglish();
  const spec = screen.specification;
  const materialized = useMemo(() => materializeScreen(screen, {
    actorCode: screen.actorCode,
    locale: en ? "EN" : "KO",
  }), [en, screen]);
  const scenarios = list(screen.traceability.requiredScenarioTypes);
  const kpis = items(spec.kpis,"KPI"), sections = materialized.sections as ContractItem[], fields = materialized.fields as ContractItem[], actions = materialized.actions as ContractItem[], states = list(spec.states);
  const commandCode = text(spec.commandCode) || actions[0]?.code || "COMPLETE";
  const initialProjectId = useMemo(() => new URLSearchParams(location.search).get("projectId") || "", []);
  const [tenantId, setTenantId] = useState("DEFAULT"), [projectId, setProjectId] = useState(initialProjectId), [executionId, setExecutionId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({}), [draftVersion, setDraftVersion] = useState(0), [draftStatus, setDraftStatus] = useState("NOT_SAVED"), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [currentState,setCurrentState]=useState(text(spec.fromState)),[nextTask,setNextTask]=useState<NextTask|null>(null);
  const [optionSets,setOptionSets]=useState<Record<string,Array<{value:string;label:string}>>>({});
  const apiBase = en ? "/en/home/api/process-executions" : "/home/api/process-executions";
  const fieldEntries = useMemo<ContractItem[]>(() => fields.length ? fields : [{code:"WORK_NOTE",label:en ? "Work note" : "업무 메모"}], [en, fields]);
  const resolvedFieldEntries=useMemo(()=>fieldEntries.map(field=>({...field,options:optionSets[field.code]||field.options})),[fieldEntries,optionSets]);

  useEffect(()=>{
    if(!tenantId.trim()||!projectId.trim())return;
    const controller=new AbortController();
    const query=new URLSearchParams({tenantId,projectId,processCode:screen.processCode,stepCode:screen.stepCode});
    fetch(`${apiBase}/field-options?${query}`,{credentials:"include",signal:controller.signal})
      .then(async response=>{
        const result=await response.json() as Record<string,unknown>;
        if(!response.ok)throw new Error(String(result.message||"Failed to load field options."));
        setOptionSets((result.optionSets||{}) as Record<string,Array<{value:string;label:string}>>);
      })
      .catch(reason=>{if((reason as Error).name!=="AbortError")setError(reason instanceof Error?reason.message:String(reason));});
    return()=>controller.abort();
  },[apiBase,projectId,screen.processCode,screen.stepCode,tenantId]);

  async function request(url: string, body: Record<string, unknown>): Promise<Record<string,unknown>|undefined> {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || (en ? "The request failed." : "업무 요청에 실패했습니다."));
      const execution=(result.execution||result) as Record<string,unknown>;
      if (execution.executionId) setExecutionId(String(execution.executionId));
      if (execution.currentState) setCurrentState(String(execution.currentState));
      setMessage(en ? "The process state was saved successfully." : "프로세스 상태와 업무 증적을 저장했습니다.");
      return result as Record<string,unknown>;
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  async function start(event: FormEvent) { event.preventDefault(); await request(`${apiBase}/start`, { tenantId, projectId, processCode: screen.processCode, actorCode: screen.actorCode }); }
  async function loadExecution() {
    if (!requireDraftContext()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const query=new URLSearchParams({tenantId,projectId,processCode:screen.processCode});
      const response=await fetch(`${apiBase}?${query}`,{credentials:"include"});
      const result=await response.json() as Record<string,unknown>;
      if(!response.ok) throw new Error(String(result.message||(en?"Failed to load the process.":"프로세스 실행 정보를 불러오지 못했습니다.")));
      const execution=((result.execution||result) as Record<string,unknown>);
      if(!execution.executionId) throw new Error(en?"No running process exists.":"진행 중인 프로세스가 없습니다.");
      setExecutionId(String(execution.executionId)); setCurrentState(String(execution.currentState||""));
      setMessage(en?"The running process was loaded.":"진행 중인 프로세스를 불러왔습니다.");
    } catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
    finally{setBusy(false);}
  }
  async function execute(command: string) {
    if (!executionId) { setError(en ? "Start or load a process first." : "먼저 프로세스를 시작하거나 실행 ID를 입력하세요."); return; }
    const missing=fieldEntries.filter(field=>field.required===true&&!String(values[field.code]||"").trim());
    if(missing.length){setError(`${en?"Complete required fields":"필수 항목을 입력하세요"}: ${missing.map(field=>field.label).join(", ")}`);return;}
    if(draftStatus!=="DRAFT"){setError(en?"Save the work draft before completing this step.":"단계를 완료하기 전에 업무 데이터를 임시저장하세요.");return;}
    const result=await request(`${apiBase}/${executionId}/commands`, { tenantId, projectId, processCode: screen.processCode, stepCode: screen.stepCode, actorCode: screen.actorCode, commandCode: command, idempotencyKey: runtimeUuid(), requestJson: JSON.stringify(values), requireDraft:true });
    if(!result)return;
    setDraftStatus("SUBMITTED"); setCurrentState(String(result.toState||currentState));
    const nextStepCode=String(result.nextStepCode||"");
    if(nextStepCode){
      const path=String((screen.audience==="ADMIN"?result.nextAdminPath:result.nextUserPath)||result.nextUserPath||result.nextAdminPath||"");
      setNextTask({stepCode:nextStepCode,actorCode:String(result.nextActorCode||""),path});
      setMessage(en?"Step completed. Continue with the next task.":"현재 단계가 완료되었습니다. 다음 업무를 진행하세요.");
    }else{
      setNextTask(null); setMessage(en?"The process is complete.":"프로세스가 완료되었습니다.");
    }
  }
  function requireDraftContext() {
    if (tenantId.trim() && projectId.trim()) return true;
    setError(en ? "Enter the tenant and project ID first." : "테넌트와 프로젝트 ID를 먼저 입력하세요.");
    return false;
  }
  async function loadDraft() {
    if (!requireDraftContext()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const query = new URLSearchParams({tenantId,projectId,processCode:screen.processCode,stepCode:screen.stepCode});
      const response = await fetch(`${apiBase}/draft?${query}`, {credentials:"include"});
      const result = await response.json();
      if(!response.ok) throw new Error(result.message||(en?"Failed to load the draft.":"임시저장을 불러오지 못했습니다."));
      const draft=(result.draft||{}) as Record<string,unknown>;
      if(result.found&&typeof draft.payloadJson==="string"){
        const loaded=JSON.parse(draft.payloadJson) as Record<string,unknown>;
        setValues(Object.fromEntries(Object.entries(loaded).map(([key,value])=>[key,value==null?"":String(value)])));
      }
      setDraftVersion(Number(draft.draftVersion||0)); setDraftStatus(String(draft.draftStatus||"NOT_SAVED"));
      setMessage(result.found?(en?"The latest draft was loaded.":"최신 임시저장을 불러왔습니다."):(en?"No saved draft exists.":"저장된 임시저장이 없습니다."));
    } catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
    finally{setBusy(false);}
  }
  async function saveDraft() {
    if (!requireDraftContext()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response=await fetch(`${apiBase}/draft`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId,projectId,processCode:screen.processCode,stepCode:screen.stepCode,actorCode:screen.actorCode,payloadJson:JSON.stringify(values),evidenceJson:"{}",expectedVersion:draftVersion})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.message||(en?"Failed to save the draft.":"임시저장에 실패했습니다."));
      const draft=(result.draft||{}) as Record<string,unknown>;
      setDraftVersion(Number(draft.draftVersion||draftVersion+1)); setDraftStatus(String(draft.draftStatus||"DRAFT"));
      setMessage(en?"The draft was saved transactionally.":"업무 데이터가 트랜잭션으로 임시저장되었습니다.");
    } catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
    finally{setBusy(false);}
  }

  return <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="gov-text-label font-black text-[#246beb]">{screen.processCode} · {screen.stepCode}</p><h1 className="gov-text-heading-lg mt-2 font-black text-[#052b57]">{screen.pageName}</h1><p className="gov-text-body mt-2 max-w-3xl text-slate-600">{text(spec.businessPurpose) || `${screen.actorCode} · ${screen.screenType}`}</p></div><a className="krds-control inline-flex items-center justify-center rounded-lg border border-[#246beb] bg-white px-4 font-bold text-[#246beb]" href={en ? "/en/emission/my-tasks" : "/emission/my-tasks"}>{en ? "Back to my tasks" : "내 업무로 돌아가기"}</a></header>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{([
      [en ? "Actor" : "담당 액터", screen.actorCode],
      [en ? "Entry state" : "진입 상태", text(spec.fromState) || text(spec.entryCondition)],
      [en ? "Target state" : "완료 상태", text(spec.toState) || text(spec.exitCondition)],
      [en ? "Template" : "화면 템플릿", screen.templateCode]
    ] as Array<[string, string]>).map(([label,value])=><article className="krds-component rounded-xl border bg-white" key={label}><span className="gov-text-label font-bold text-slate-500">{label}</span><strong className="gov-text-heading-sm mt-2 block break-words text-[#052b57]">{value || "-"}</strong></article>)}</section>
    <section className="krds-component mt-5 rounded-xl border border-blue-200 bg-blue-50">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="gov-text-label font-black text-blue-700">SCREEN COORDINATE</p><p className="gov-text-body-sm mt-1 break-all text-slate-700">{materialized.coordinateKey}</p></div>
        <span className={`rounded-full px-3 py-2 text-sm font-black ${materialized.valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{materialized.valid ? (en ? "Contract valid" : "계약 정상") : (en ? "Contract incomplete" : "계약 보완 필요")}</span>
      </div>
    </section>
    {(message || error) && <p className={`mt-5 rounded-xl border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</p>}
    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]"><div className="space-y-6">
      {kpis.length > 0 && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{kpis.map(item=><article className="krds-component rounded-xl border bg-white" key={item.code}><span className="gov-text-label font-bold text-slate-500">{item.label}</span><strong className="gov-text-heading-md mt-2 block text-[#052b57]">-</strong></article>)}</section>}
      <section className="krds-component rounded-xl border bg-white"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="gov-text-heading-md font-black text-[#052b57]">{en ? "Work data" : "업무 데이터"}</h2><p className="gov-text-body-sm mt-2 text-slate-600">{text(spec.completionRule)}</p></div><span className="gov-text-label rounded-full bg-slate-100 px-3 py-2 font-bold text-slate-700">{draftStatus} · v{draftVersion}</span></div><div className="mt-5 grid gap-4 md:grid-cols-2">{resolvedFieldEntries.map(field=><ContractFieldControl field={field} key={field.code} value={values[field.code] || ""} onChange={value=>setValues(current=>({...current,[field.code]:value}))}/>)}</div><div className="mt-5 flex flex-wrap justify-end gap-2"><button className="krds-control rounded-lg border border-[#246beb] bg-white px-4 font-black text-[#246beb] disabled:opacity-50" disabled={busy} onClick={()=>void loadDraft()} type="button">{en ? "Load draft" : "임시저장 불러오기"}</button><button className="krds-control rounded-lg bg-[#246beb] px-4 font-black text-white disabled:opacity-50" disabled={busy} onClick={()=>void saveDraft()} type="button">{en ? "Save draft" : "임시저장"}</button></div></section>
      {sections.length > 0 && <section className="grid gap-4 md:grid-cols-2">{sections.map(section=><article className="krds-component min-h-36 rounded-xl border bg-white" key={section.code}><h2 className="gov-text-heading-sm font-black text-[#052b57]">{section.label}</h2><p className="gov-text-body-sm mt-3 text-slate-600">{en ? "This section uses the registered shared component and data contract." : "등록된 공통 컴포넌트와 데이터 계약을 사용하는 영역입니다."}</p></article>)}</section>}
    </div><aside className="space-y-5">
      <section className="krds-component rounded-xl border bg-white">
        <h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Runtime status" : "실행 상태"}</h2>
        <p className="gov-text-body-sm mt-2 text-slate-700">{en ? "Current state" : "현재 상태"}: <strong>{currentState || "-"}</strong></p>
        <button className="krds-control mt-4 w-full rounded-lg border border-[#052b57] bg-white font-black text-[#052b57] disabled:opacity-50" disabled={busy} onClick={()=>void loadExecution()} type="button">{en ? "Load running process" : "진행 중 프로세스 불러오기"}</button>
      </section>
      <form className="krds-component rounded-xl border bg-white" onSubmit={start}><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Process context" : "프로세스 실행 문맥"}</h2><div className="mt-4 space-y-3"><label className="gov-text-label font-bold">Tenant<input className={`${inputClass} mt-2`} value={tenantId} onChange={event=>setTenantId(event.target.value)} required/></label><label className="gov-text-label font-bold">{en ? "Project ID" : "프로젝트 ID"}<input className={`${inputClass} mt-2`} value={projectId} onChange={event=>setProjectId(event.target.value)} required/></label><label className="gov-text-label font-bold">{en ? "Execution ID" : "실행 ID"}<input className={`${inputClass} mt-2`} value={executionId} onChange={event=>setExecutionId(event.target.value)}/></label></div><button className="krds-control mt-4 w-full rounded-lg bg-[#052b57] font-black text-white disabled:opacity-50" disabled={busy} type="submit">{en ? "Start process" : "프로세스 시작"}</button></form>
      <section className="krds-component rounded-xl border bg-white"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Complete step" : "단계 완료"}</h2><p className="gov-text-body-sm mt-2 text-slate-600">{en ? "Required fields and a saved draft are validated before transition." : "필수 항목과 임시저장을 검증한 뒤 다음 상태로 전환합니다."}</p><div className="mt-4 grid gap-2">{(actions.length ? actions : [{code:commandCode,label:commandCode}]).slice(0,1).map(action=><button className="krds-control rounded-lg bg-[#246beb] font-black text-white disabled:opacity-50" disabled={busy||draftStatus!=="DRAFT"} key={action.code} onClick={()=>void execute(commandCode)} type="button">{en ? "Complete and continue" : `${action.label} 완료`}</button>)}</div></section>
      <section className="krds-component rounded-xl border bg-white"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Required states and tests" : "필수 상태·테스트"}</h2><div className="mt-3 flex flex-wrap gap-2">{[...states,...scenarios].map(item=><span className="gov-text-label rounded-full bg-slate-100 px-3 py-2 font-bold text-slate-700" key={item}>{item}</span>)}</div></section>
      <section className="krds-component rounded-xl border bg-white"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Contract validation" : "계약 자동 검증"}</h2>{materialized.issues.length ? <ul className="mt-3 space-y-2">{materialized.issues.map(issue=><li className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700" key={issue.code}>{issue.message}</li>)}</ul> : <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{en ? "Screen, data, policy and test contracts are connected." : "화면·데이터·권한·테스트 계약이 모두 연결되었습니다."}</p>}</section>
      {nextTask&&<section className="krds-component rounded-xl border border-emerald-300 bg-emerald-50"><h2 className="gov-text-heading-sm font-black text-emerald-900">{en ? "Next task" : "다음 업무"}</h2><p className="gov-text-body-sm mt-2 text-emerald-900">{nextTask.stepCode} · {nextTask.actorCode}</p>{nextTask.path&&<a className="krds-control mt-4 inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 font-black text-white" href={`${nextTask.path}${nextTask.path.includes("?")?"&":"?"}projectId=${encodeURIComponent(projectId)}`}>{en ? "Open next task" : "다음 업무 화면 열기"}</a>}</section>}
    </aside></section>
  </main>;
}

function parseGeneratedRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return (value || {}) as Record<string, unknown>;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toGeneratedScreen(row: Record<string, unknown>): GeneratedScreenDefinition {
  const specification = parseGeneratedRecord(row.specificationJson);
  const traceability = parseGeneratedRecord(row.traceabilityJson);
  const coordinate = resolveScreenCoordinate({
    pageId: String(row.pageId),
    processCode: String(row.processCode),
    stepCode: String(row.stepCode),
    actorCode: String(row.actorCode),
    screenType: String(row.screenType),
    templateCode: String(row.templateCode),
    specification,
    traceability,
  });
  return {
    id: String(row.pageId || row.blueprintCode).toLowerCase(),
    blueprintCode: String(row.blueprintCode),
    processCode: String(row.processCode),
    stepCode: String(row.stepCode),
    actorCode: String(row.actorCode),
    audience: String(row.audience) === "ADMIN" ? "ADMIN" : "USER",
    pageId: String(row.pageId),
    pageName: String(row.pageName),
    routePath: String(row.routePath),
    screenType: String(row.screenType),
    templateCode: String(row.templateCode),
    screenCoordinate: coordinate,
    screenCoordinateKey: Object.values(coordinate).map(value => encodeURIComponent(value)).join("::"),
    specification,
    traceability,
    designCompleteness: {
      score: Number(row.designScore || 0),
      complete: Boolean(row.designComplete),
      checks: {}
    }
  } as GeneratedScreenDefinition;
}

type VersionedContractEnvelope = {
  contract?: Record<string, unknown>;
  versionId?: number;
  versionNo?: number;
  contractHash?: string;
  screenKey?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function contractArray(value: unknown, nestedKey?: string): Array<Record<string, unknown>> {
  const candidate = nestedKey ? record(value)[nestedKey] : value;
  return Array.isArray(candidate) ? candidate.filter(item => item && typeof item === "object") as Array<Record<string, unknown>> : [];
}

function applyVersionedContract(base: GeneratedScreenDefinition, envelope: VersionedContractEnvelope): GeneratedScreenDefinition {
  const contract = record(envelope.contract);
  const screenLayer = record(contract.screen);
  const dataLayer = record(contract.data);
  const uiLayer = record(contract.ui);
  const actionLayer = record(contract.action);
  const processLayer = record(contract.process);
  const permissionLayer = record(contract.permission);
  const operationLayer = record(contract.operations);
  const rawFields = contractArray(dataLayer.fields, "fields").length
    ? contractArray(dataLayer.fields, "fields")
    : contractArray(dataLayer.fields);
  const rawSections = contractArray(uiLayer.sections, "sections").length
    ? contractArray(uiLayer.sections, "sections")
    : contractArray(uiLayer.sections);
  const rawCommands = contractArray(actionLayer.commands, "commands").length
    ? contractArray(actionLayer.commands, "commands")
    : contractArray(actionLayer.commands);
  const fields = rawFields.map((field, index) => ({
    code: String(field.fieldCode || field.code || `FIELD_${index + 1}`),
    label: String(field.fieldName || field.label || field.name || field.fieldCode || field.code || `Field ${index + 1}`),
    dataType: String(field.dataType || "STRING"),
    control: String(field.controlType || field.control || "TEXT"),
    required: field.required === true,
    validation: record(field.validation),
    group: String(field.fieldGroup || field.group || "WORK"),
  }));
  const sections = rawSections.map((section, index) => ({
    code: String(section.sectionCode || section.code || `SECTION_${index + 1}`),
    label: String(section.sectionName || section.label || section.name || section.sectionCode || section.code || `Section ${index + 1}`),
  }));
  const commands = rawCommands.map((command, index) => ({
    code: String(command.commandCode || command.code || `COMMAND_${index + 1}`),
    label: String(command.commandName || command.label || command.name || command.commandCode || command.code || `Command ${index + 1}`),
  }));
  const specification = {
    ...base.specification,
    businessPurpose: String(screenLayer.purpose || screenLayer.description || base.specification.businessPurpose || ""),
    entryCondition: String(processLayer.entryCondition || base.specification.entryCondition || ""),
    exitCondition: String(processLayer.exitCondition || base.specification.exitCondition || ""),
    states: Array.isArray(processLayer.states) ? processLayer.states : base.specification.states,
    fields: fields.length ? fields : base.specification.fields,
    sections: sections.length ? sections : base.specification.sections,
    actions: commands.length ? commands : base.specification.actions,
    commandCode: commands[0]?.code || base.specification.commandCode,
    runtimeContract: {
      source: "DB_VERSIONED_CONTRACT",
      screenKey: envelope.screenKey,
      versionId: envelope.versionId,
      versionNo: envelope.versionNo,
      contractHash: envelope.contractHash,
      updatedAt: operationLayer.updatedAt,
    },
  };
  return {
    ...base,
    pageName: String(screenLayer.name || base.pageName),
    routePath: String(screenLayer.route || base.routePath),
    processCode: String(processLayer.processCode || base.processCode),
    stepCode: String(processLayer.stepCode || base.stepCode),
    actorCode: String(permissionLayer.actorCode || base.actorCode),
    audience: String(screenLayer.audience || permissionLayer.audience || base.audience) === "ADMIN" ? "ADMIN" : "USER",
    specification,
  } as GeneratedScreenDefinition;
}

async function loadVersionedContract(base: GeneratedScreenDefinition): Promise<GeneratedScreenDefinition> {
  const query = new URLSearchParams({
    routePath: location.pathname,
    processCode: base.processCode,
    stepCode: base.stepCode,
    audience: base.audience,
  });
  const response = await fetch(`/runtime/screens/resolve?${query}`, { credentials: "include", headers: { Accept: "application/json" } });
  if (!response.ok) return base;
  return applyVersionedContract(base, await response.json() as VersionedContractEnvelope);
}

export function GeneratedScreenPage() {
  const en = isEnglish();
  const staticScreen: GeneratedScreenDefinition | undefined =
    findGeneratedScreen(location.pathname) as GeneratedScreenDefinition | undefined;
  const [screen,setScreen]=useState<GeneratedScreenDefinition|undefined>(staticScreen),[loading,setLoading]=useState(!staticScreen);
  useEffect(() => {
    let cancelled = false;
    setLoading(!staticScreen);
    const basePromise = staticScreen
      ? Promise.resolve(staticScreen)
      : fetch(`${en ? "/en" : ""}/home/api/process-executions/screen-contract?routePath=${encodeURIComponent(location.pathname)}`, { credentials: "include" })
          .then(async response => {
            const row = await response.json() as Record<string, unknown>;
            return response.ok && row.enabled ? toGeneratedScreen(row) : undefined;
          });
    basePromise.then(async base => {
      if (!base || cancelled) return;
      const resolved = await loadVersionedContract(base).catch(() => base);
      if (!cancelled) setScreen(resolved);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [en, staticScreen]);
  if(loading) return <main className="mx-auto max-w-7xl px-4 py-12 lg:px-8"><p className="gov-text-body font-bold">{en?"Loading the latest design...":"최신 화면 설계를 불러오는 중입니다."}</p></main>;
  if (!screen) return <main className="mx-auto max-w-7xl px-4 py-12 lg:px-8"><h1 className="gov-text-heading-lg font-black">{en ? "Screen contract not found" : "화면 설계 계약을 찾을 수 없습니다."}</h1></main>;
  if (screen.audience === "ADMIN") return <AdminPageShell breadcrumbs={[{label:en ? "System" : "시스템 관리",href:en?"/en/admin":"/admin"},{label:en ? "Generated screen" : "자동 생성 화면"}]} title={screen.pageName}><GeneratedContent screen={screen}/></AdminPageShell>;
  return <GeneratedContent screen={screen}/>;
}
