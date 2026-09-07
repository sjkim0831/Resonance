import { ReactNode, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type DetailTab = "design" | "data" | "screen" | "test" | "task";
type Props = {
  actors: Row[]; artifacts: Row[]; cases: Row[]; executions: Row[]; jobs: Row[];
  base: string;
  onOpen: (tab: string) => void; onProcessChange: (code: string) => void;
  processCode: string; processes: Row[]; runs: Row[]; steps: Row[];
};
const text = (row: Row, key: string) => String(row[key] ?? "");
const done = (status: string) => ["APPROVED", "COMPLETED", "PASSED", "VERIFIED"].includes(status);
const running = (status: string) => ["IN_PROGRESS", "RUNNING"].includes(status);
const badge = (status: string) => done(status) ? "bg-emerald-100 text-emerald-800" : running(status) ? "bg-blue-100 text-blue-800" : status === "BLOCKED" || status === "FAILED" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600";

export function IntegratedWorkOperationsMap(props: Props) {
  const selectedCode = props.processCode || text(props.processes[0] || {}, "processCode");
  const [stepCode, setStepCode] = useState("");
  const [actorCode, setActorCode] = useState("");
  const [workType, setWorkType] = useState("");
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("data");
  const [designWorkbenchOpen, setDesignWorkbenchOpen] = useState(false);
  const processRows = useMemo(() => props.processes.filter(row => {
    const actorMatch = !actorCode || props.steps.some(step => text(step, "processCode") === text(row, "processCode") && text(step, "actorCode") === actorCode);
    const projectMatch = !projectId || props.executions.some(execution => (text(execution, "projectId") || text(execution, "executionId")) === projectId && text(execution, "processCode") === text(row, "processCode"));
    const type = text(row, "workTypeCode") || text(row, "processGroup") || text(row, "domainCode") || "COMMON";
    const keyword = `${text(row, "processName")} ${text(row, "processCode")}`.toLowerCase();
    return actorMatch && projectMatch && (!workType || type === workType) && (!query.trim() || keyword.includes(query.trim().toLowerCase()));
  }), [actorCode, projectId, props.executions, props.processes, props.steps, query, workType]);
  const selectedProcess = props.processes.find(row => text(row, "processCode") === selectedCode) || {};
  const selectedSteps = useMemo(() => props.steps.filter(row => text(row, "processCode") === selectedCode).sort((a, b) => Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0)), [props.steps, selectedCode]);
  const selectedStep = selectedSteps.find(row => text(row, "stepCode") === stepCode) || selectedSteps.find(row => !done(text(row, "automationStatus"))) || selectedSteps[0] || {};
  const selectedCases = props.cases.filter(row => text(row, "processCode") === selectedCode);
  const selectedJobs = props.jobs.filter(row => text(row, "processCode") === selectedCode && (!stepCode || !text(row, "stepCode") || text(row, "stepCode") === text(selectedStep, "stepCode")));
  const selectedArtifacts = props.artifacts.filter(row => text(row, "processCode") === selectedCode && (!stepCode || !text(row, "stepCode") || text(row, "stepCode") === text(selectedStep, "stepCode")));
  const selectedActor = props.actors.find(row => text(row, "actorCode") === text(selectedStep, "actorCode")) || {};
  const route = text(selectedStep, "userPath") || text(selectedStep, "adminPath");
  useEffect(() => {
    if (selectedSteps.length && !selectedSteps.some(row => text(row, "stepCode") === stepCode)) setStepCode(text(selectedSteps[0], "stepCode"));
  }, [selectedSteps, stepCode]);
  const workTypes = useMemo(() => [...new Set(props.processes.map(row => text(row, "workTypeCode") || text(row, "processGroup") || text(row, "domainCode") || "COMMON"))].sort(), [props.processes]);
  const projects = useMemo(() => [...new Set(props.executions.map(row => text(row, "projectId") || text(row, "executionId")).filter(Boolean))], [props.executions]);
  const completedJobs = props.jobs.filter(row => done(text(row, "jobStatus"))).length;
  const passedCases = props.cases.filter(row => done(text(row, "status")) || props.runs.some(run => text(run, "caseCode") === text(row, "caseCode") && text(run, "result") === "PASSED")).length;

  return <div className="space-y-4">
    <section className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-[#052b57] to-[#174ea6] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-black tracking-[0.08em] text-blue-200">INTEGRATED DESIGN WORKBENCH</p><h2 className="mt-1 text-xl font-black">통합 설계 문서·액티브 UI 관리</h2><p className="mt-2 text-sm text-blue-50">선택한 프로세스·단계·화면을 기준으로 설계 문서 18종과 UI, 데이터, API, 테스트, 배포 증적을 한곳에서 관리합니다.</p></div>
      <button className="min-h-11 shrink-0 rounded-lg bg-white px-5 font-black text-[#174ea6] shadow-sm" onClick={()=>setDesignWorkbenchOpen(true)} type="button">설계 워크벤치 열기</button>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="업무 설계 현황">
      <Metric label="액터" value={props.actors.length}/><Metric label="프로세스" value={props.processes.length}/><Metric label="단계" value={props.steps.length}/><Metric label="테스트" value={`${passedCases}/${props.cases.length}`}/><Metric label="개발 준비" value={`${completedJobs}/${props.jobs.length}`}/>
    </section>
    <section className="grid min-h-[570px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="border-b border-slate-200 bg-slate-50 p-4 xl:border-b-0 xl:border-r">
        <p className="text-xs font-black tracking-[0.08em] text-blue-700">WORK NAVIGATION</p><h3 className="mt-1 text-lg font-black text-[#052b57]">업무 탐색</h3>
        <div className="mt-4 grid gap-3">
          <Filter label="업무 종류" value={workType} onChange={setWorkType}><option value="">전체 업무</option>{workTypes.map(item => <option key={item}>{item}</option>)}</Filter>
          <Filter label="액터" value={actorCode} onChange={setActorCode}><option value="">전체 액터</option>{props.actors.map(row => <option key={text(row, "actorCode")} value={text(row, "actorCode")}>{text(row, "actorName")} ({text(row, "actorCode")})</option>)}</Filter>
          <Filter label="프로젝트" value={projectId} onChange={setProjectId}><option value="">전체 프로젝트</option>{projects.map(item => <option key={item}>{item}</option>)}</Filter>
          <label className="text-xs font-bold text-slate-600">프로세스 검색<input className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none" value={query} onChange={event => setQuery(event.target.value)} placeholder="프로세스명 또는 코드"/></label>
        </div>
        <div className="mt-4 max-h-[310px] space-y-1 overflow-y-auto pr-1" role="tree" aria-label="프로세스 트리">
          {processRows.map(row => { const code = text(row, "processCode"), active = code === selectedCode, count = props.steps.filter(step => text(step, "processCode") === code).length; return <button key={code} type="button" role="treeitem" aria-selected={active} onClick={() => props.onProcessChange(code)} className={`w-full rounded-lg border px-3 py-3 text-left transition ${active ? "border-blue-500 bg-blue-50 text-[#052b57] ring-1 ring-blue-100" : "border-transparent bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"}`}><span className="block text-sm font-black">{text(row, "processName")}</span><span className="mt-1 block text-xs text-slate-500">{code} · {count}단계</span></button>; })}
        </div>
      </aside>
      <main className="min-w-0 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div><p className="text-xs font-black tracking-[0.08em] text-blue-700">END-TO-END PROCESS</p><h3 className="mt-1 text-xl font-black text-[#052b57]">전체 업무 흐름</h3><p className="mt-1 text-sm text-slate-600">{text(selectedProcess, "processName")} · {selectedSteps.length}단계</p></div>
          <div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">완료</span><span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">진행 중</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">대기</span></div>
        </div>
        <div className="mt-6 flex min-h-[250px] items-start gap-2 overflow-x-auto pb-4">
          {selectedSteps.map((row, index) => { const active = text(row, "stepCode") === text(selectedStep, "stepCode"), status = text(row, "automationStatus") || "PLANNED", hasCondition = Boolean(text(row, "transitionRule") || text(row, "exceptionRule")); return <div key={`${selectedCode}-${text(row, "stepCode")}`} className="flex shrink-0 items-center gap-2"><div className="w-44"><button type="button" onClick={() => setStepCode(text(row, "stepCode"))} className={`min-h-36 w-full rounded-xl border p-3 text-left transition ${active ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-300"}`}><span className="text-xs font-bold text-slate-500">{index + 1}. {text(row, "actorCode") || "미지정"}</span><strong className="mt-2 block text-sm leading-5 text-slate-900">{text(row, "stepName")}</strong><span className={`mt-3 inline-block rounded-full px-2 py-1 text-xs font-bold ${badge(status)}`}>{active ? "현재 업무" : status}</span></button>{hasCondition && <div className="mx-auto mt-3 w-36 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-2 text-center text-xs font-bold text-amber-800">조건·예외 분기</div>}</div>{index < selectedSteps.length - 1 && <span className="text-2xl font-black text-slate-400" aria-hidden="true">→</span>}</div>; })}
          {!selectedSteps.length && <div className="flex min-h-52 w-full items-center justify-center rounded-xl border border-dashed text-sm text-slate-500">선택한 프로세스의 단계 설계가 필요합니다.</div>}
        </div>
        <div className="mt-5 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3"><Summary label="시작 조건" value={text(selectedProcess, "startCondition") || "시작 조건 설계 필요"}/><Summary label="현재 상태" value={text(selectedStep, "automationStatus") || "PLANNED"}/><Summary label="종료 조건" value={text(selectedProcess, "completionCondition") || "종료 조건 설계 필요"}/></div>
      </main>
      <aside className="border-t border-slate-200 bg-slate-50 p-4 xl:border-l xl:border-t-0">
        <p className="text-xs font-black tracking-[0.08em] text-blue-700">LIVE WORK GUIDE</p><div className="mt-1 flex items-start justify-between gap-2"><h3 className="text-lg font-black text-[#052b57]">업무 길잡이</h3><span className={`rounded-full px-2 py-1 text-xs font-bold ${badge(text(selectedStep, "automationStatus"))}`}>{text(selectedStep, "automationStatus") || "PLANNED"}</span></div>
        <h4 className="mt-5 text-base font-black text-slate-900">{text(selectedStep, "stepName") || "단계를 선택하십시오"}</h4>
        <dl className="mt-4 space-y-4 text-sm"><Guide label="담당 액터" value={text(selectedActor, "actorName") || text(selectedStep, "actorCode") || "미지정"}/><Guide label="필수 입력" value={contractSummary(text(selectedStep, "inputContract"), "입력 데이터 계약이 필요합니다.")}/><Guide label="완료 조건" value={text(selectedStep, "completionRule") || "완료 조건 설계가 필요합니다."}/><Guide label="예외·주의사항" value={text(selectedStep, "exceptionRule") || "등록된 예외 규칙이 없습니다."} warning/></dl>
        <div className="mt-5 grid gap-2">{route.startsWith("/") ? <a href={route} className="rounded-lg bg-[#246beb] px-4 py-3 text-center text-sm font-black text-white">업무 화면 열기</a> : <button type="button" onClick={() => props.onOpen("page-fields")} className="rounded-lg bg-[#246beb] px-4 py-3 text-sm font-black text-white">화면·필드 설계하기</button>}<button type="button" onClick={() => setDetailTab("test")} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">완료 조건 검증</button><button type="button" disabled={!selectedSteps.length} onClick={() => { const index = selectedSteps.findIndex(row => text(row, "stepCode") === text(selectedStep, "stepCode")); const next = selectedSteps[index + 1]; if (next) setStepCode(text(next, "stepCode")); }} className="rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm font-bold text-blue-700 disabled:opacity-40">다음 업무로 이동 →</button></div>
      </aside>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <nav className="flex overflow-x-auto border-b border-slate-200 bg-slate-50" aria-label="선택 단계 상세 정보">{([["design","설계"],["data","입출력 데이터"],["screen","화면·API"],["test","테스트"],["task","태스크·증적"]] as [DetailTab,string][]).map(([id,label]) => <button key={id} type="button" onClick={() => setDetailTab(id)} className={`min-h-12 shrink-0 border-b-2 px-5 text-sm font-black ${detailTab === id ? "border-blue-600 bg-white text-blue-700" : "border-transparent text-slate-600 hover:bg-white"}`}>{label}</button>)}</nav>
      <div className="p-4">{detailTab === "design" && <DetailGrid rows={[["프로세스",text(selectedProcess,"processName"),selectedCode],["단계",text(selectedStep,"stepName"),text(selectedStep,"stepCode")],["담당 액터",text(selectedActor,"actorName"),text(selectedStep,"actorCode")],["상태 전이",text(selectedStep,"transitionRule") || "설계 필요",text(selectedStep,"automationStatus") || "PLANNED"]]}/>} {detailTab === "data" && <DataContractTable step={selectedStep}/>} {detailTab === "screen" && <SimpleTable heads={["유형","화면·API·산출물","경로·계약","상태"]} rows={selectedArtifacts.map(row => [text(row,"artifactType"),text(row,"artifactName"),text(row,"targetPath") || text(row,"contractRef"),text(row,"status")])} empty="연결된 화면·API 산출물이 없습니다."/>} {detailTab === "test" && <SimpleTable heads={["시나리오","유형","기대 결과","상태"]} rows={selectedCases.map(row => [text(row,"caseName"),text(row,"caseType"),text(row,"expectedResult") || text(row,"assertionsJson"),text(row,"status")])} empty="등록된 테스트 시나리오가 없습니다."/>} {detailTab === "task" && <SimpleTable heads={["태스크","유형","담당","상태·증적"]} rows={selectedJobs.map(row => [text(row,"jobName") || text(row,"jobId"),text(row,"jobType"),text(row,"ownerActorCode") || text(row,"assignedTo"),`${text(row,"jobStatus")} ${text(row,"evidenceRef")}`])} empty="등록된 개발 태스크가 없습니다."/>}</div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3"><button type="button" onClick={() => props.onOpen("page-fields")} className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-700">설계 수정</button><button type="button" onClick={() => props.onOpen("simulation")} className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-700">테스트 실행</button><button type="button" onClick={() => props.onOpen("automation")} className="rounded-lg bg-[#246beb] px-4 py-2 text-sm font-bold text-white">개발 요청</button></div>
    </section>
    {designWorkbenchOpen && <IntegratedDesignWorkbench
      base={props.base}
      cases={selectedCases}
      jobs={selectedJobs}
      onClose={()=>setDesignWorkbenchOpen(false)}
      onOpen={props.onOpen}
      process={selectedProcess}
      processCode={selectedCode}
      routePath={route}
      step={selectedStep}
    />}
  </div>;
}

type DesignDocument = { documentType:string; title:string; content:string; status:string; revision:number; updatedBy?:string; updatedAt?:string };
const DESIGN_GROUPS = [
  ["업무·거버넌스",["REQUIREMENT","ACTOR_RACI","AUTHORITY","PROCESS","STATE","NAVIGATION"]],
  ["화면·데이터",["ACTIVE_UI","DESIGN_ASSET","FIELD_DICTIONARY","DATA_HANDOFF","DATABASE","API"]],
  ["품질·운영",["BUSINESS_RULE","VALIDATION","NOTIFICATION","TEST","TASK_EVIDENCE","RELEASE_AUDIT"]]
] as const;

function IntegratedDesignWorkbench({base,cases,jobs,onClose,onOpen,process,processCode,routePath,step}:{base:string;cases:Row[];jobs:Row[];onClose:()=>void;onOpen:(tab:string)=>void;process:Row;processCode:string;routePath:string;step:Row}) {
  const stepCode=text(step,"stepCode");
  const endpoint=base.replace(/\/actor-process$/,"/integrated-design-documents");
  const [documents,setDocuments]=useState<DesignDocument[]>([]);
  const [selectedType,setSelectedType]=useState("REQUIREMENT");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const current=documents.find(item=>item.documentType===selectedType);
  const load=async()=>{setBusy(true);try{const response=await fetch(`${endpoint}?processCode=${encodeURIComponent(processCode)}&stepCode=${encodeURIComponent(stepCode)}&routePath=${encodeURIComponent(routePath)}`,{credentials:"include",headers:{Accept:"application/json"}});const body=await response.json();if(!response.ok)throw new Error(body.message||"설계 문서를 불러오지 못했습니다.");setDocuments(body.documents||[]);}catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}};
  useEffect(()=>{void load();},[processCode,stepCode,routePath]);
  const updateCurrent=(patch:Partial<DesignDocument>)=>setDocuments(rows=>rows.map(row=>row.documentType===selectedType?{...row,...patch}:row));
  const save=async()=>{if(!current)return;setBusy(true);setMessage("");try{const response=await fetch(endpoint,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({...current,processCode,stepCode,routePath})});const body=await response.json();if(!response.ok)throw new Error(body.message||"설계 문서를 저장하지 못했습니다.");await load();setMessage(`${current.title} v${body.revision} 저장을 완료했습니다.`);}catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}};
  const ready=documents.filter(item=>["READY","APPROVED","VERIFIED"].includes(item.status)).length;
  return <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="통합 설계 워크벤치">
    <section className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-4 bg-[#052b57] px-5 py-4 text-white"><div><p className="text-xs font-black text-blue-200">SINGLE SOURCE OF DESIGN TRUTH</p><h2 className="mt-1 text-xl font-black">통합 설계 워크벤치</h2><p className="mt-1 text-sm text-blue-100">{text(process,"processName")} · {text(step,"stepName")} · 설계 준비 {ready}/18</p></div><button aria-label="닫기" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/15" onClick={onClose} type="button"><span className="material-symbols-outlined">close</span></button></header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <aside className="overflow-y-auto border-b bg-slate-50 p-4 lg:border-b-0 lg:border-r">
          {DESIGN_GROUPS.map(([group,types])=><div className="mb-5" key={group}><h3 className="mb-2 text-xs font-black text-slate-500">{group}</h3><div className="grid gap-1">{types.map(type=>{const doc=documents.find(item=>item.documentType===type);const active=type===selectedType;return <button className={`flex min-h-11 items-center justify-between rounded-lg border px-3 text-left text-sm font-bold ${active?"border-blue-500 bg-blue-50 text-blue-800":"border-transparent bg-white text-slate-700 hover:border-blue-200"}`} key={type} onClick={()=>setSelectedType(type)} type="button"><span>{doc?.title||type}</span><span className={`ml-2 h-2.5 w-2.5 shrink-0 rounded-full ${doc&&["READY","APPROVED","VERIFIED"].includes(doc.status)?"bg-emerald-500":doc?.content?"bg-amber-400":"bg-slate-300"}`}/></button>})}</div></div>)}
        </aside>
        <main className="min-w-0 overflow-y-auto p-5">
          {current?<><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-black text-slate-700">설계서 제목<input className="gov-input mt-1" value={current.title} onChange={event=>updateCurrent({title:event.target.value})}/></label><label className="text-sm font-black text-slate-700">상태<select className="gov-select mt-1 min-w-40" value={current.status} onChange={event=>updateCurrent({status:event.target.value})}><option value="DRAFT">초안</option><option value="READY">개발 준비</option><option value="IN_REVIEW">검토 중</option><option value="APPROVED">승인</option><option value="VERIFIED">검증 완료</option></select></label></div><label className="mt-5 block text-sm font-black text-slate-700">설계 내용<textarea className="gov-input mt-1 min-h-[380px] resize-y py-3 font-mono leading-6" placeholder="목적, 액터, 선행조건, 입력, 처리 규칙, 출력, 예외, 완료 조건과 연결 화면을 구조적으로 기록합니다." value={current.content} onChange={event=>updateCurrent({content:event.target.value})}/></label><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>버전 {current.revision} · {current.updatedBy||"미저장"} · {current.updatedAt||"-"}</span><span>{current.content.length.toLocaleString()}자</span></div></>:<p className="py-20 text-center text-slate-500">{busy?"설계 문서를 불러오는 중입니다.":"설계 문서를 선택하세요."}</p>}
        </main>
        <aside className="overflow-y-auto border-t bg-slate-50 p-4 lg:border-l lg:border-t-0">
          <h3 className="font-black text-[#052b57]">현재 설계 문맥</h3><dl className="mt-3 space-y-3 text-sm"><Guide label="프로세스" value={`${text(process,"processName")} (${processCode})`}/><Guide label="단계" value={`${text(step,"stepName")} (${stepCode})`}/><Guide label="액터" value={text(step,"actorCode")||"미지정"}/><Guide label="화면" value={routePath||"연결 필요"}/></dl>
          <h3 className="mt-6 font-black text-[#052b57]">연결 자산</h3><div className="mt-3 grid gap-2 text-sm"><WorkbenchLink label="전체 화면 캔버스" onClick={()=>onOpen("design-canvas")}/><WorkbenchLink label="페이지·컬럼 설계" onClick={()=>onOpen("page-fields")}/><WorkbenchLink label="테마·섹션·컴포넌트" onClick={()=>onOpen("design")}/><WorkbenchLink label={`테스트 시나리오 ${cases.length}건`} onClick={()=>onOpen("simulation")}/><WorkbenchLink label={`개발 태스크 ${jobs.length}건`} onClick={()=>onOpen("automation")}/><WorkbenchLink label="설계 정확성 검사" onClick={()=>onOpen("design-assurance")}/>{routePath.startsWith("/")?<a className="rounded-lg border border-blue-200 bg-white px-3 py-3 font-bold text-blue-700" href={routePath}>액티브 화면 열기</a>:null}</div>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">18종 설계서의 준비 상태, 화면·API·테스트·태스크 증적이 일치해야 개발 완료로 판정합니다. 빈 문서는 완료로 계산하지 않습니다.</div>
        </aside>
      </div>
      <footer className="flex shrink-0 flex-col gap-3 border-t bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className={`text-sm font-bold ${message.includes("완료")?"text-emerald-700":"text-slate-600"}`} role="status">{message||"설계 변경은 버전으로 보존되며 선택 문맥에만 반영됩니다."}</p><div className="flex gap-2"><button className="min-h-11 rounded-lg border px-4 font-bold" onClick={onClose} type="button">닫기</button><button className="min-h-11 rounded-lg bg-[#246beb] px-5 font-black text-white disabled:opacity-50" disabled={busy||!current} onClick={()=>void save()} type="button">{busy?"처리 중...":"저장·버전 생성"}</button></div></footer>
    </section>
  </div>;
}

function WorkbenchLink({label,onClick}:{label:string;onClick:()=>void}) { return <button className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-left font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700" onClick={onClick} type="button">{label}</button>; }

function Metric({label,value}:{label:string;value:string|number}) { return <article className="rounded-xl border border-slate-200 bg-white p-4"><span className="text-sm font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl font-black text-[#052b57]">{value}</strong></article>; }
function Filter({children,label,onChange,value}:{children:ReactNode;label:string;onChange:(value:string)=>void;value:string}) { return <label className="text-xs font-bold text-slate-600">{label}<select className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>; }
function Summary({label,value}:{label:string;value:string}) { return <div className="rounded-lg bg-slate-50 p-3"><span className="text-xs font-bold text-slate-500">{label}</span><p className="mt-1 line-clamp-2 text-sm font-bold text-slate-800">{value}</p></div>; }
function Guide({label,value,warning=false}:{label:string;value:string;warning?:boolean}) { return <div className={warning ? "rounded-lg border border-amber-200 bg-amber-50 p-3" : ""}><dt className={`text-xs font-black ${warning ? "text-amber-800" : "text-slate-500"}`}>{label}</dt><dd className="mt-1 break-words leading-6 text-slate-800">{value}</dd></div>; }
function contractSummary(raw:string,fallback:string) { if (!raw) return fallback; try { const parsed=JSON.parse(raw); if(Array.isArray(parsed)) return parsed.map(item => typeof item === "string" ? item : item.name || item.field || JSON.stringify(item)).join(", "); return Object.keys(parsed).join(", ") || fallback; } catch { return raw; } }
function DataContractTable({step}:{step:Row}) { const rows:string[][]=[]; for(const [direction,raw] of [["입력",text(step,"inputContract")],["출력",text(step,"outputContract")]] as const){if(!raw)continue;try{const parsed=JSON.parse(raw);const entries=Array.isArray(parsed)?parsed:Object.entries(parsed).map(([field,rule])=>({field,rule}));for(const item of entries){const row=typeof item==="string"?{field:item}:item as Record<string,unknown>;rows.push([direction,String(row.field||row.name||row.key||"-"),String(row.source||row.from||"-"),String(row.target||row.to||"-"),String(row.required??"필수"),String(row.rule||row.validation||"-")]);}}catch{rows.push([direction,raw,"-","-","-","원문 계약"]);}}return <SimpleTable heads={["구분","필드","소스","목적지","필수","검증 규칙"]} rows={rows} empty="입출력 데이터 계약이 등록되지 않았습니다."/>; }
function DetailGrid({rows}:{rows:string[][]}) { return <dl className="grid gap-3 md:grid-cols-2">{rows.map(([label,value,code])=><div key={label} className="rounded-xl border border-slate-200 p-4"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 font-black text-slate-900">{value||"-"}</dd><dd className="mt-1 text-xs text-slate-500">{code}</dd></div>)}</dl>; }
function SimpleTable({empty,heads,rows}:{empty:string;heads:string[];rows:string[][]}) { return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b bg-slate-50">{heads.map(head=><th key={head} className="px-4 py-3 font-black text-slate-600">{head}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,index)=><tr key={`${index}-${row.join("-")}`} className="border-b last:border-0">{row.map((cell,cellIndex)=><td key={cellIndex} className="max-w-[360px] break-words px-4 py-3 text-slate-700">{cell||"-"}</td>)}</tr>):<tr><td colSpan={heads.length} className="px-4 py-10 text-center text-slate-500">{empty}</td></tr>}</tbody></table></div>; }
