import { FormEvent, useEffect, useMemo, useState } from "react";
import { findGeneratedScreen, type GeneratedScreenDefinition } from "../../generated/screen-generation/generatedScreenCatalog";
import { isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

const list = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const inputClass = "krds-control h-11 w-full rounded-lg border border-slate-300 bg-white px-3 focus:border-[#246beb] focus:outline-none focus:ring-2 focus:ring-blue-100";

function GeneratedContent({ screen }: { screen: GeneratedScreenDefinition }) {
  const en = isEnglish();
  const spec = screen.specification;
  const scenarios = list(screen.traceability.requiredScenarioTypes);
  const kpis = list(spec.kpis), sections = list(spec.sections), fields = list(spec.fields), commands = list(spec.commands), states = list(spec.states);
  const commandCode = text(spec.commandCode) || commands[0] || "COMPLETE";
  const [tenantId, setTenantId] = useState("DEFAULT"), [projectId, setProjectId] = useState(""), [executionId, setExecutionId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const apiBase = en ? "/en/home/api/process-executions" : "/home/api/process-executions";
  const fieldEntries = useMemo(() => fields.length ? fields : [en ? "Work note" : "업무 메모"], [en, fields]);

  async function request(url: string, body: Record<string, unknown>) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || (en ? "The request failed." : "업무 요청에 실패했습니다."));
      if (result.executionId) setExecutionId(String(result.executionId));
      setMessage(en ? "The process state was saved successfully." : "프로세스 상태와 업무 증적을 저장했습니다.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  async function start(event: FormEvent) { event.preventDefault(); await request(`${apiBase}/start`, { tenantId, projectId, processCode: screen.processCode, actorCode: screen.actorCode }); }
  async function execute(command: string) {
    if (!executionId) { setError(en ? "Start or load a process first." : "먼저 프로세스를 시작하거나 실행 ID를 입력하세요."); return; }
    await request(`${apiBase}/${executionId}/commands`, { tenantId, projectId, processCode: screen.processCode, stepCode: screen.stepCode, actorCode: screen.actorCode, commandCode: command, idempotencyKey: crypto.randomUUID(), requestJson: JSON.stringify(values) });
  }

  return <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="gov-text-label font-black text-[#246beb]">{screen.processCode} · {screen.stepCode}</p><h1 className="gov-text-heading-lg mt-2 font-black text-[#052b57]">{screen.pageName}</h1><p className="gov-text-body mt-2 max-w-3xl text-slate-600">{text(spec.businessPurpose) || `${screen.actorCode} · ${screen.screenType}`}</p></div><a className="krds-control inline-flex items-center justify-center rounded-lg border border-[#246beb] bg-white px-4 font-bold text-[#246beb]" href={en ? "/en/emission/my-tasks" : "/emission/my-tasks"}>{en ? "Back to my tasks" : "내 업무로 돌아가기"}</a></header>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[en ? "Actor" : "담당 액터", screen.actorCode],[en ? "Entry state" : "진입 상태", text(spec.fromState) || text(spec.entryCondition)],[en ? "Target state" : "완료 상태", text(spec.toState) || text(spec.exitCondition)],[en ? "Template" : "화면 템플릿", screen.templateCode]].map(([label,value])=><article className="krds-component rounded-xl border bg-white" key={label}><span className="gov-text-label font-bold text-slate-500">{label}</span><strong className="gov-text-heading-sm mt-2 block break-words text-[#052b57]">{value || "-"}</strong></article>)}</section>
    {(message || error) && <p className={`mt-5 rounded-xl border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</p>}
    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]"><div className="space-y-6">
      {kpis.length > 0 && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{kpis.map(item=><article className="krds-component rounded-xl border bg-white" key={item}><span className="gov-text-label font-bold text-slate-500">{item}</span><strong className="gov-text-heading-md mt-2 block text-[#052b57]">-</strong></article>)}</section>}
      <section className="krds-component rounded-xl border bg-white"><h2 className="gov-text-heading-md font-black text-[#052b57]">{en ? "Work data" : "업무 데이터"}</h2><p className="gov-text-body-sm mt-2 text-slate-600">{text(spec.completionRule)}</p><div className="mt-5 grid gap-4 md:grid-cols-2">{fieldEntries.map(field=><label className="gov-text-label font-bold text-slate-700" key={field}>{field}<input className={`${inputClass} mt-2`} value={values[field] || ""} onChange={event=>setValues(current=>({...current,[field]:event.target.value}))}/></label>)}</div></section>
      {sections.length > 0 && <section className="grid gap-4 md:grid-cols-2">{sections.map(section=><article className="krds-component min-h-36 rounded-xl border bg-white" key={section}><h2 className="gov-text-heading-sm font-black text-[#052b57]">{section}</h2><p className="gov-text-body-sm mt-3 text-slate-600">{en ? "This section uses the registered shared component and data contract." : "등록된 공통 컴포넌트와 데이터 계약을 사용하는 영역입니다."}</p></article>)}</section>}
    </div><aside className="space-y-5">
      <form className="krds-component rounded-xl border bg-white" onSubmit={start}><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Process context" : "프로세스 실행 문맥"}</h2><div className="mt-4 space-y-3"><label className="gov-text-label font-bold">Tenant<input className={`${inputClass} mt-2`} value={tenantId} onChange={event=>setTenantId(event.target.value)} required/></label><label className="gov-text-label font-bold">{en ? "Project ID" : "프로젝트 ID"}<input className={`${inputClass} mt-2`} value={projectId} onChange={event=>setProjectId(event.target.value)} required/></label><label className="gov-text-label font-bold">{en ? "Execution ID" : "실행 ID"}<input className={`${inputClass} mt-2`} value={executionId} onChange={event=>setExecutionId(event.target.value)}/></label></div><button className="krds-control mt-4 w-full rounded-lg bg-[#052b57] font-black text-white disabled:opacity-50" disabled={busy} type="submit">{en ? "Start process" : "프로세스 시작"}</button></form>
      <section className="krds-component rounded-xl border bg-white"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Commands" : "업무 명령"}</h2><div className="mt-4 grid gap-2">{(commands.length ? commands : [commandCode]).map((command,index)=><button className={`krds-control rounded-lg font-black ${index===0 ? "bg-[#246beb] text-white" : "border border-[#246beb] bg-white text-[#246beb]"}`} disabled={busy} key={command} onClick={()=>void execute(index===0 ? commandCode : command)} type="button">{command}</button>)}</div></section>
      <section className="krds-component rounded-xl border bg-white"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Required states and tests" : "필수 상태·테스트"}</h2><div className="mt-3 flex flex-wrap gap-2">{[...states,...scenarios].map(item=><span className="gov-text-label rounded-full bg-slate-100 px-3 py-2 font-bold text-slate-700" key={item}>{item}</span>)}</div></section>
    </aside></section>
  </main>;
}

export function GeneratedScreenPage() {
  const en = isEnglish(), staticScreen = findGeneratedScreen(location.pathname);
  const [screen,setScreen]=useState<GeneratedScreenDefinition|undefined>(staticScreen),[loading,setLoading]=useState(!staticScreen);
  useEffect(()=>{let cancelled=false;setLoading(!staticScreen);fetch(`${en?"/en":""}/home/api/process-executions/screen-contract?routePath=${encodeURIComponent(location.pathname)}`,{credentials:"include"}).then(async response=>{const row=await response.json();if(!response.ok||!row.enabled)return;if(cancelled)return;const parse=(value:unknown)=>{if(typeof value!=="string")return (value||{}) as Record<string,unknown>;try{return JSON.parse(value) as Record<string,unknown>}catch{return {}}};setScreen({id:String(row.pageId||row.blueprintCode).toLowerCase(),blueprintCode:String(row.blueprintCode),processCode:String(row.processCode),stepCode:String(row.stepCode),actorCode:String(row.actorCode),audience:String(row.audience)==="ADMIN"?"ADMIN":"USER",pageId:String(row.pageId),pageName:String(row.pageName),routePath:String(row.routePath),screenType:String(row.screenType),templateCode:String(row.templateCode),specification:parse(row.specificationJson),traceability:parse(row.traceabilityJson)});}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[en,staticScreen]);
  if(loading) return <main className="mx-auto max-w-7xl px-4 py-12 lg:px-8"><p className="gov-text-body font-bold">{en?"Loading the latest design...":"최신 화면 설계를 불러오는 중입니다."}</p></main>;
  if (!screen) return <main className="mx-auto max-w-7xl px-4 py-12 lg:px-8"><h1 className="gov-text-heading-lg font-black">{en ? "Screen contract not found" : "화면 설계 계약을 찾을 수 없습니다."}</h1></main>;
  if (screen.audience === "ADMIN") return <AdminPageShell breadcrumbs={[{label:en ? "System" : "시스템 관리",href:en?"/en/admin":"/admin"},{label:en ? "Generated screen" : "자동 생성 화면"}]} title={screen.pageName}><GeneratedContent screen={screen}/></AdminPageShell>;
  return <GeneratedContent screen={screen}/>;
}
