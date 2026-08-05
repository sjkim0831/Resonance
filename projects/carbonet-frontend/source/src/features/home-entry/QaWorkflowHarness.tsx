import { useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { QA_TEST_ACCOUNTS, switchQaAccount } from "./TestAccountSwitcher";

type WorkType = { workTypeCode: string; workTypeName: string; workTypeNameEn?: string; sortOrder?: number };
type Process = { processCode: string; processName: string; domainCode: string; workflowOrder?: number; developmentOrder?: number };
type Step = { processCode: string; stepCode: string; stepName: string; stepOrder: number; actorCode?: string; userPath?: string };
type Project = { projectId: string; projectName?: string };
type HarnessPayload = { workTypes?: WorkType[]; processCatalog?: Process[]; processCatalogSteps?: Step[]; projectProcesses?: Project[]; workflows?: Project[]; items?: Project[] };

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
  const [accountId, setAccountId] = useState(QA_TEST_ACCOUNTS[0].id);
  const [workType, setWorkType] = useState("EMISSION");
  const [processCode, setProcessCode] = useState("");
  const [stepCode, setStepCode] = useState("");
  const [projectId, setProjectId] = useState(() => new URLSearchParams(location.search).get("projectId") || "");
  const [cycleType, setCycleType] = useState("ONCE");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("testMode") === "1";
    const active = requested || qaHost() || sessionStorage.getItem(QA_KEY) === "enabled";
    if (active) sessionStorage.setItem(QA_KEY, "enabled");
    setEnabled(active);
    if (!active) return;
    fetch(buildLocalizedPath("/home/api/emission-tasks", "/en/home/api/emission-tasks"), { credentials: "include" })
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

  if (!enabled) return null;
  const step = steps.find(item => item.stepCode === stepCode);

  function openWorkflow() {
    window.dispatchEvent(new CustomEvent("resonance:task-guide-focus", { detail: { projectId, processCode, stepCode, openOverview: true } }));
  }

  function openStep() {
    if (!processCode || !stepCode) return;
    const url = new URL(buildLocalizedPath("/work/execution", "/en/work/execution"), location.origin);
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

  return <section className="border-b border-blue-200 bg-[#eef5ff]" data-common-component="COMMON_QA_WORKFLOW_HARNESS" data-testid="qa-workflow-harness">
    <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8">
      <div className="flex items-center justify-between gap-3"><div><strong className="text-sm font-black text-[#052b57]">{en ? "QA workflow harness" : "QA 통합 업무 하네스"}</strong><span className="ml-2 text-xs font-bold text-blue-700">ACCOUNT · WORK · PROCESS · STEP · INSTANCE</span></div><button className="min-h-9 rounded-lg border border-blue-300 bg-white px-3 text-sm font-bold text-[#246beb]" onClick={() => { const next=!expanded; setExpanded(next); localStorage.setItem(QA_KEY,next?"open":"closed"); }} type="button">{expanded ? (en ? "Collapse" : "접기") : (en ? "Open QA" : "QA 열기")}</button></div>
      {expanded ? <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr_1fr_1.4fr_1.4fr_1.5fr_auto]">
        <label className="text-xs font-bold text-slate-600">{en ? "Login account" : "로그인 계정"}<select className={`${control} mt-1 w-full`} value={accountId} onChange={event => setAccountId(event.target.value)}>{QA_TEST_ACCOUNTS.map(item => <option key={item.id} value={item.id}>{item.actor} · {item.id}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">{en ? "Work type" : "업무 종류"}<select className={`${control} mt-1 w-full`} value={workType} onChange={event => setWorkType(event.target.value)}><option value="ALL">{en ? "All" : "전체"}</option>{workTypes.map(item => <option key={item.workTypeCode} value={item.workTypeCode}>{en ? item.workTypeNameEn || item.workTypeName : item.workTypeName}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">{en ? "Process" : "프로세스"}<select className={`${control} mt-1 w-full`} value={processCode} onChange={event => setProcessCode(event.target.value)}>{processes.map(item => <option key={item.processCode} value={item.processCode}>{item.processName}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">{en ? "Step" : "절차"}<select className={`${control} mt-1 w-full`} value={stepCode} onChange={event => setStepCode(event.target.value)}>{steps.map(item => <option key={item.stepCode} value={item.stepCode}>{item.stepOrder}. {item.stepName}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">{en ? "Work instance project" : "업무 인스턴스·프로젝트"}<select className={`${control} mt-1 w-full`} value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">{en ? "Select project" : "프로젝트 선택"}</option>{projects.map(item => <option key={item.projectId} value={item.projectId}>{item.projectName || item.projectId}</option>)}</select></label>
        <div className="flex items-end gap-2"><button className="min-h-10 rounded-lg bg-[#052b57] px-3 text-sm font-black text-white disabled:opacity-50" disabled={busy} onClick={() => void switchAccount()} type="button">{en ? "Login" : "전환 로그인"}</button><button className="min-h-10 rounded-lg bg-[#246beb] px-3 text-sm font-black text-white" onClick={openWorkflow} type="button">{en ? "Canvas/Table" : "캔버스·표"}</button><button className="min-h-10 rounded-lg border border-[#246beb] bg-white px-3 text-sm font-black text-[#246beb]" onClick={openStep} type="button">{en ? "Open step" : "절차 실행"}</button></div>
      </div> : null}
      {expanded ? <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-blue-200 pt-3"><label className="text-xs font-bold text-slate-600">{en ? "Cycle" : "실행 주기"}<select className={`${control} ml-2`} value={cycleType} onChange={event => setCycleType(event.target.value)}>{["ONCE","MONTHLY","QUARTERLY","HALF_YEARLY","ANNUAL","AD_HOC"].map(value => <option key={value}>{value}</option>)}</select></label>{cycleType !== "ONCE" ? <><input aria-label={en ? "Period start" : "기간 시작"} className={control} type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} /><input aria-label={en ? "Period end" : "기간 종료"} className={control} type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} /></> : null}{(["CREATE","UPDATE","RESET","DELETE"] as const).map(action => <button className={`min-h-10 rounded-lg px-3 text-sm font-black ${action === "DELETE" ? "border border-red-300 bg-white text-red-700" : "border border-blue-300 bg-white text-blue-800"}`} disabled={busy} key={action} onClick={() => void instanceAction(action)} type="button">{action === "CREATE" ? "추가" : action === "UPDATE" ? "수정" : action === "RESET" ? "초기화" : "삭제"}</button>)}{message ? <span className="text-sm font-bold text-amber-800" role="status">{message}</span> : null}</div> : null}
    </div>
  </section>;
}
