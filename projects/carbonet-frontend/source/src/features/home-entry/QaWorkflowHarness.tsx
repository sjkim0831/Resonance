import { useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { QA_TEST_ACCOUNTS, switchQaAccount } from "./TestAccountSwitcher";

type WorkType = { workTypeCode: string; workTypeName: string; workTypeNameEn?: string; sortOrder?: number };
type Process = { processCode: string; processName: string; domainCode: string; workflowOrder?: number; developmentOrder?: number };
type Step = { processCode: string; stepCode: string; stepName: string; stepOrder: number; actorCode?: string; userPath?: string };
type Project = { projectId: string; projectName?: string; tenantId?: string };
type HarnessPayload = { tenantId?: string; workTypes?: WorkType[]; processCatalog?: Process[]; processCatalogSteps?: Step[]; projectProcesses?: Project[]; workflows?: Project[]; items?: Project[]; catalogVisibility?: string };
type QaCase = { caseCode:string; caseName:string; caseType:string; stepCode:string; stepOrder:number; stepName:string; itemId?:number; screenResourceId?:number; screenName?:string; routePath?:string; capabilityCode?:string; testCaseId?:number; preInputJson?:string; expectedResult?:string; caseStatus?:string; automated?:boolean };
type QaSession = { sessionId?:string; sessionStatus?:string; currentCaseIndex?:number; completedCaseCount?:number; totalCaseCount?:number; workingInputJson?:string; resultHistoryJson?:string };

const QA_KEY = "carbonet:qa-workflow-harness";
const control = "min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800";

function qaHost() {
  return location.hostname === "172.16.1.232" || location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname.endsWith(".172.16.1.232.nip.io");
}

export function QaWorkflowHarness() {
  const en = isEnglish();
  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(() => localStorage.getItem(QA_KEY) !== "closed");
  const [payload, setPayload] = useState<HarnessPayload>({});
  const [accountId, setAccountId] = useState<string>(QA_TEST_ACCOUNTS[0].id);
  const [workType, setWorkType] = useState("EMISSION");
  const [processCode, setProcessCode] = useState("");
  const [stepCode, setStepCode] = useState("");
  const [projectId, setProjectId] = useState(() => new URLSearchParams(location.search).get("projectId") || "");
  const [cycleType, setCycleType] = useState("ONCE");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [qaCases, setQaCases] = useState<QaCase[]>([]);
  const [qaIndex, setQaIndex] = useState(0);
  const [qaInput, setQaInput] = useState("{}");
  const [qaSession, setQaSession] = useState<QaSession>({ sessionStatus:"READY" });
  const [qaHistory, setQaHistory] = useState<Record<string,unknown>[]>([]);

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("testMode") === "1";
    const active = requested || qaHost() || sessionStorage.getItem(QA_KEY) === "enabled";
    if (active) sessionStorage.setItem(QA_KEY, "enabled");
    setEnabled(active);
    if (!active) return;
    fetch(buildLocalizedPath("/home/api/emission-tasks?qaCatalog=true", "/en/home/api/emission-tasks?qaCatalog=true"), { credentials: "include", headers: { "X-Carbonet-Test-Mode": "1" } })
      .then(async response => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then(body => setPayload(body as HarnessPayload))
      .catch(() => setMessage(en ? "Sign in to load the QA workflow catalog." : "로그인하면 QA 업무 카탈로그를 불러옵니다."));
  }, [en]);

  const workTypes = useMemo(() => [...(payload.workTypes || [])].sort((a,b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)), [payload.workTypes]);
  const processes = useMemo(() => (payload.processCatalog || []).filter(item => workType === "ALL" || item.domainCode === workType).sort((a,b) => Number(a.workflowOrder || a.developmentOrder || 0) - Number(b.workflowOrder || b.developmentOrder || 0)), [payload.processCatalog, workType]);
  const steps = useMemo(() => (payload.processCatalogSteps || []).filter(item => item.processCode === processCode).sort((a,b) => Number(a.stepOrder) - Number(b.stepOrder)), [payload.processCatalogSteps, processCode]);
  const projects = useMemo(() => {
    const rows = [...(payload.projectProcesses || []), ...(payload.workflows || []), ...(payload.items || [])];
    return [...new Map(rows.filter(row => row.projectId).map(row => [row.projectId, row])).values()].sort((a,b) => String(a.projectName || a.projectId).localeCompare(String(b.projectName || b.projectId)));
  }, [payload.items, payload.projectProcesses, payload.workflows]);

  useEffect(() => { if (!processes.some(item => item.processCode === processCode)) setProcessCode(processes[0]?.processCode || ""); }, [processCode, processes]);
  useEffect(() => { if (!steps.some(item => item.stepCode === stepCode)) setStepCode(steps[0]?.stepCode || ""); }, [stepCode, steps]);
  useEffect(() => { if (!projectId && projects[0]) setProjectId(projects[0].projectId); }, [projectId, projects]);

  useEffect(() => {
    if (!enabled || !processCode) { setQaCases([]); return; }
    const base="/admin/api/system/actor-process";
    Promise.all([fetch(`${base}/qa-datasets?processCode=${encodeURIComponent(processCode)}`,{credentials:"include"}).then(response=>response.ok?response.json():Promise.reject(new Error(String(response.status)))),fetch(`${base}/qa-sessions/latest?processCode=${encodeURIComponent(processCode)}&projectId=${encodeURIComponent(projectId)}`,{credentials:"include"}).then(response=>response.ok?response.json():Promise.reject(new Error(String(response.status))))]).then(([catalog,saved])=>{
      const items=Array.isArray(catalog.items)?catalog.items as QaCase[]:[];setQaCases(items);
      const session=saved.exists?saved.session as QaSession:{sessionStatus:"READY",currentCaseIndex:0,completedCaseCount:0,totalCaseCount:items.length,workingInputJson:"{}",resultHistoryJson:"[]"};
      const index=Math.min(Number(session.currentCaseIndex||0),Math.max(items.length-1,0));setQaSession(session);setQaIndex(index);
      try{setQaHistory(JSON.parse(session.resultHistoryJson||"[]"));}catch{setQaHistory([]);}
      setQaInput(session.workingInputJson||items[index]?.preInputJson||"{}");
    }).catch(()=>setMessage(en?"QA dataset catalog requires an administrator session.":"QA 데이터셋 카탈로그는 관리자 로그인 후 사용할 수 있습니다."));
  },[enabled,en,processCode,projectId]);

  if (!enabled) return null;
  const step = steps.find(item => item.stepCode === stepCode);

  function openWorkflow() {
    window.dispatchEvent(new CustomEvent("resonance:task-guide-focus", { detail: { projectId, processCode, stepCode, openOverview: true } }));
  }

  function openStep() {
    if (!processCode || !stepCode) return;
    const url = new URL(buildLocalizedPath("/work/execution", "/en/work/execution"), location.origin);
    const tenantId = projects.find(item => item.projectId === projectId)?.tenantId || payload.tenantId || "";
    if (tenantId) url.searchParams.set("tenantId", tenantId);
    if (projectId) url.searchParams.set("projectId", projectId);
    url.searchParams.set("processCode", processCode);
    url.searchParams.set("stepCode", stepCode);
    if (step?.actorCode) url.searchParams.set("actorCode", step.actorCode);
    if (step?.userPath) url.searchParams.set("screenPath", step.userPath);
    url.searchParams.set("guide", "1"); url.searchParams.set("shell", "1"); url.searchParams.set("testMode", "1");
    navigate(`${url.pathname}${url.search}`);
  }

  async function switchAccount() {
    setBusy(true); setMessage("");
    try { const result = await switchQaAccount(accountId); if (!result.ok) throw new Error(result.body.errors || "LOGIN_FAILED"); location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); setBusy(false); }
  }

  async function instanceAction(action: "CREATE" | "UPDATE" | "RESET" | "DELETE") {
    if (!projectId || !processCode) { setMessage(en ? "Select a project and process." : "프로젝트와 프로세스를 선택하세요."); return; }
    if ((action === "DELETE" || action === "RESET") && !window.confirm(en ? `${action} this QA instance?` : `선택한 QA 인스턴스를 ${action === "DELETE" ? "삭제" : "초기화"}할까요?`)) return;
    setBusy(true); setMessage("");
    try {
      const endpoint = "/home/api/process-executions/qa-instance";
      const first = steps[0];
      const response = await fetch(buildLocalizedPath(endpoint, `/en${endpoint}`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-Carbonet-Test-Mode": "1" }, body: JSON.stringify({ action, projectId, processCode, actorCode: first?.actorCode || "", cycleType, periodStart, periodEnd }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.message || String(response.status));
      setMessage(en ? `QA instance ${action.toLowerCase()} completed.` : `QA 인스턴스 ${action === "CREATE" ? "추가" : action === "UPDATE" ? "수정" : action === "RESET" ? "초기화" : "삭제"}가 완료되었습니다.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function persistQaSession(status:string,index=qaIndex,history=qaHistory,input=qaInput){
    const current=qaCases[index];
    const response=await fetch("/admin/api/system/actor-process/qa-sessions",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:qaSession.sessionId,projectId,processCode,sessionStatus:status,currentStepCode:current?.stepCode||"",currentCaseCode:current?.caseCode||"",currentCaseIndex:index,totalCaseCount:qaCases.length,completedCaseCount:history.length,workingInputJson:input,resultHistoryJson:JSON.stringify(history)})});
    const body=await response.json();if(!response.ok)throw new Error(body.message||String(response.status));setQaSession(currentSession=>({...currentSession,sessionId:String(body.sessionId),sessionStatus:status,currentCaseIndex:index,completedCaseCount:history.length,totalCaseCount:qaCases.length,workingInputJson:input,resultHistoryJson:JSON.stringify(history)}));
  }

  async function qaSessionAction(action:"START"|"PAUSE"|"RESET"|"SAVE"|"RUN_NEXT"){
    if(!qaCases.length){setMessage("등록된 경우의 수가 없습니다.");return;}setBusy(true);setMessage("");
    try{
      if(action==="RESET"){setQaIndex(0);setQaHistory([]);const input=qaCases[0]?.preInputJson||"{}";setQaInput(input);await persistQaSession("RESET",0,[],input);setMessage("Step 1의 첫 경우부터 다시 시작할 준비가 되었습니다.");return;}
      if(action==="PAUSE"){await persistQaSession("PAUSED");setMessage("현재 위치와 수정 입력값을 저장하고 중단했습니다.");return;}
      if(action==="SAVE"){JSON.parse(qaInput);await persistQaSession("PAUSED");setMessage("현재 테스트 입력값을 저장했습니다.");return;}
      if(action==="START"){setQaIndex(0);setQaHistory([]);const input=qaCases[0]?.preInputJson||"{}";setQaInput(input);await persistQaSession("RUNNING",0,[],input);setMessage(`전체 ${qaCases.length}개 경우의 수 탐색을 Step 1부터 시작합니다.`);return;}
      const current=qaCases[qaIndex];if(!current?.itemId)throw new Error("연결 화면 itemId가 없어 코드 테스트를 실행할 수 없습니다.");JSON.parse(qaInput);
      const response=await fetch("/admin/api/system/actor-process/screen-workflow-test",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({itemId:Number(current.itemId),processCode,stepCode:current.stepCode,capabilityCode:current.capabilityCode||"ALL",testCaseId:current.testCaseId||undefined,preInputJson:qaInput})});
      const result=await response.json();if(!response.ok)throw new Error(result.message||String(response.status));
      const nextHistory=[...qaHistory,{caseCode:current.caseCode,stepCode:current.stepCode,caseType:current.caseType,result:result.result,runId:result.runId,executedAt:new Date().toISOString()}];
      const nextIndex=Math.min(qaIndex+1,qaCases.length-1),complete=nextHistory.length>=qaCases.length,nextInput=complete?qaInput:qaCases[nextIndex]?.preInputJson||"{}";
      setQaHistory(nextHistory);setQaIndex(nextIndex);setQaInput(nextInput);await persistQaSession(complete?"COMPLETED":"RUNNING",nextIndex,nextHistory,nextInput);
      setMessage(complete?`전체 ${qaCases.length}개 경우의 수 코드 검사가 완료되었습니다.`:`${current.stepName} · ${current.caseName}: ${result.result}. 다음 경우로 이동했습니다.`);
    }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}
  }

  return <section className="border-b border-blue-200 bg-[#eef5ff]" data-common-component="COMMON_QA_WORKFLOW_HARNESS" data-testid="qa-workflow-harness">
    <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8">
      <div className="flex items-center justify-between gap-3"><div><strong className="text-sm font-black text-[#052b57]">{en ? "QA workflow harness" : "QA 통합 업무 하네스"}</strong><span className="ml-2 text-xs font-bold text-blue-700">ACCOUNT · WORK · PROCESS · STEP · INSTANCE</span></div><button className="min-h-9 rounded-lg border border-blue-300 bg-white px-3 text-sm font-bold text-[#246beb]" onClick={() => { const next=!expanded; setExpanded(next); localStorage.setItem(QA_KEY,next?"open":"closed"); }} type="button">{expanded ? (en ? "Collapse" : "접기") : (en ? "Open QA" : "QA 열기")}</button></div>
      {expanded ? <><div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-blue-900"><span>전체 프로세스 {payload.processCatalog?.length || 0}개</span><span>전체 절차 {payload.processCatalogSteps?.length || 0}개</span><span>선택 프로세스 절차 {steps.length}개</span></div><div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr_1fr_1.4fr_1.4fr_1.5fr_auto]">
        <label className="text-xs font-bold text-slate-600">{en ? "Login account" : "로그인 계정"}<select className={`${control} mt-1 w-full`} value={accountId} onChange={event => setAccountId(event.target.value)}>{QA_TEST_ACCOUNTS.map(item => <option key={item.id} value={item.id}>{item.actor} · {item.id}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">{en ? "Work type" : "업무 종류"}<select className={`${control} mt-1 w-full`} value={workType} onChange={event => setWorkType(event.target.value)}><option value="ALL">{en ? "All" : "전체"}</option>{workTypes.map(item => <option key={item.workTypeCode} value={item.workTypeCode}>{en ? item.workTypeNameEn || item.workTypeName : item.workTypeName}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">{en ? "Process" : "프로세스"}<select className={`${control} mt-1 w-full`} value={processCode} onChange={event => setProcessCode(event.target.value)}>{processes.map(item => <option key={item.processCode} value={item.processCode}>{item.processName}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">{en ? "Step" : "절차"}<select className={`${control} mt-1 w-full`} value={stepCode} onChange={event => setStepCode(event.target.value)}>{steps.map(item => <option key={item.stepCode} value={item.stepCode}>{item.stepOrder}. {item.stepName}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">{en ? "Work instance project" : "업무 인스턴스·프로젝트"}<select className={`${control} mt-1 w-full`} value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">{en ? "Select project" : "프로젝트 선택"}</option>{projects.map(item => <option key={item.projectId} value={item.projectId}>{item.projectName || item.projectId}</option>)}</select></label>
        <div className="flex items-end gap-2"><button className="min-h-10 rounded-lg bg-[#052b57] px-3 text-sm font-black text-white disabled:opacity-50" disabled={busy} onClick={() => void switchAccount()} type="button">{en ? "Login" : "전환 로그인"}</button><button className="min-h-10 rounded-lg bg-[#246beb] px-3 text-sm font-black text-white" onClick={openWorkflow} type="button">{en ? "Canvas/Table" : "캔버스·표"}</button><button className="min-h-10 rounded-lg border border-[#246beb] bg-white px-3 text-sm font-black text-[#246beb]" onClick={openStep} type="button">{en ? "Open step" : "절차 실행"}</button></div>
      </div></> : null}
      {expanded ? <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-blue-200 pt-3"><label className="text-xs font-bold text-slate-600">{en ? "Cycle" : "실행 주기"}<select className={`${control} ml-2`} value={cycleType} onChange={event => setCycleType(event.target.value)}>{["ONCE","MONTHLY","QUARTERLY","HALF_YEARLY","ANNUAL","AD_HOC"].map(value => <option key={value}>{value}</option>)}</select></label>{cycleType !== "ONCE" ? <><input aria-label={en ? "Period start" : "기간 시작"} className={control} type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} /><input aria-label={en ? "Period end" : "기간 종료"} className={control} type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} /></> : null}{(["CREATE","UPDATE","RESET","DELETE"] as const).map(action => <button className={`min-h-10 rounded-lg px-3 text-sm font-black ${action === "DELETE" ? "border border-red-300 bg-white text-red-700" : "border border-blue-300 bg-white text-blue-800"}`} disabled={busy} key={action} onClick={() => void instanceAction(action)} type="button">{action === "CREATE" ? "추가" : action === "UPDATE" ? "수정" : action === "RESET" ? "초기화" : "삭제"}</button>)}{message ? <span className="text-sm font-bold text-amber-800" role="status">{message}</span> : null}</div> : null}
      {expanded && processCode ? <section className="mt-3 rounded-xl border border-blue-200 bg-white p-4" data-testid="qa-dataset-runner"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><strong className="text-sm font-black text-[#052b57]">코드 기반 경우의 수 탐색</strong><p className="mt-1 text-xs text-slate-600">AI 호출 없음 · Step 1부터 5종 순서 실행 · 중단 후 입력 수정·재개 가능</p></div><div className="flex flex-wrap gap-2">{([['START','처음부터'],['PAUSE','중단'],['SAVE','값 저장'],['RUN_NEXT','현재 경우 실행']] as const).map(([action,label])=><button className="min-h-9 rounded-lg border border-blue-300 bg-white px-3 text-xs font-black text-blue-800 disabled:opacity-50" disabled={busy} key={action} onClick={()=>void qaSessionAction(action)} type="button">{label}</button>)}</div></div><div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr_2fr]"><label className="text-xs font-bold text-slate-600">경우의 수<select className={`${control} mt-1 w-full`} value={qaIndex} onChange={event=>{const index=Number(event.target.value);setQaIndex(index);setQaInput(qaCases[index]?.preInputJson||"{}");}}>{qaCases.map((item,index)=><option key={`${item.stepCode}-${item.caseCode}`} value={index}>{item.stepOrder}. {item.stepName} · {item.caseType} · {item.caseName}</option>)}</select></label><div className="rounded-lg bg-slate-50 p-3 text-xs"><b>{qaCases[qaIndex]?.screenName||"연결 화면 점검 필요"}</b><span className="mt-1 block text-slate-500">{qaCases[qaIndex]?.routePath||"경로 없음"}</span><span className="mt-1 block font-bold text-blue-700">{qaHistory.length}/{qaCases.length} 완료 · {qaSession.sessionStatus||"READY"}</span></div><label className="text-xs font-bold text-slate-600">선입력 JSON<textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs" value={qaInput} onChange={event=>setQaInput(event.target.value)}/></label></div><div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200"><span className="bg-emerald-500 transition-all" style={{width:`${qaCases.length?Math.round(qaHistory.length/qaCases.length*100):0}%`}}/></div></section>:null}
    </div>
  </section>;
}
