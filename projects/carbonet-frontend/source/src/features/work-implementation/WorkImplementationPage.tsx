import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import "./workbench-layout.css";
import { isEnglish } from "../../lib/navigation/runtime";
import { ParallelWorkPanel } from "./parallel/ParallelWorkPanel";
import { WorkDesignViews, type WorkDesignView } from "./WorkDesignViews";
import { DevelopmentWorkbench } from "./DevelopmentWorkbench";
import { StudioDesignViews } from "./StudioDesignViews";
import "./design-studio.css";

type Row = Record<string, unknown>;
type ProcessRow = Row & { processCode: string; processName?: string; processVersion?: string; steps?: StepRow[] };
type StepRow = Row & { processCode: string; stepCode: string; stepName?: string; stepOrder?: number };
type BusinessRow = Row & { workTypeCode: string; workTypeName?: string; processes?: ProcessRow[] };
type Catalog = { counts?: Row; businessTypes?: BusinessRow[]; orphanRuntimeCount?: number };
type ProcessDesign = { steps?: StepRow[] };
type ContractDraft = { inputContract: string; outputContract: string; completionRule: string };

const API = "/admin/api/system/actor-process";
const value = (row: Row | undefined, ...keys: string[]) => {
  for (const key of keys) if (row?.[key] != null) return String(row[key]);
  return "";
};
const contractText = (value: unknown) => {
  if (typeof value === "string") return value;
  return value == null ? "{}" : JSON.stringify(value, null, 2);
};
const routeKey = (raw: unknown) => {
  const value = String(raw || "");
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  try {
    const path = new URL(value, window.location.origin).pathname.replace(/^\/en(?=\/)/i, "");
    return path === "/" ? path : path.replace(/\/+$/, "");
  } catch { return ""; }
};

export function WorkDesignStudioPage() { return <WorkImplementationPage studio />; }

export function WorkImplementationPage({ studio = false }: { studio?: boolean } = {}) {
  const DesignViews = studio ? StudioDesignViews : WorkDesignViews;
  const [resourceTarget,setResourceTarget]=useState({process:'',step:'',route:''});
  const en = isEnglish();
  const editorRef = useRef<HTMLDialogElement>(null);
  const openEditor = () => editorRef.current?.showModal();
  const params = new URLSearchParams(location.search);
  const [catalog, setCatalog] = useState<Catalog>({ businessTypes: [] });
  const [design, setDesign] = useState<ProcessDesign>({ steps: [] });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedProcessCode, setSelectedProcessCode] = useState(params.get("processCode") || "");
  const [selectedStepCode, setSelectedStepCode] = useState(params.get("stepCode") || "");
  const [draft, setDraft] = useState<ContractDraft>({ inputContract: "{}", outputContract: "{}", completionRule: "" });
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeView, setActiveView] = useState<WorkDesignView>("list");
  const [revisionHistory, setRevisionHistory] = useState<Row[]>([]);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [revisionError, setRevisionError] = useState("");
  const [flowEdges, setFlowEdges] = useState<Row[]>([]);
  const [flowError, setFlowError] = useState("");

  const loadCatalog = useCallback(async () => {
    const response = await fetch(`${API}/catalog`, { credentials: "include", headers: { Accept: "application/json" } });
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) throw new Error(en ? `Catalog returned HTTP ${response.status}.` : `카탈로그 API가 JSON 대신 HTTP ${response.status}를 반환했습니다.`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || (en ? "Could not load the work catalog." : "전체 업무 정의를 불러오지 못했습니다."));
    setCatalog(body);
    return body as Catalog;
  }, [en]);

  const loadDesign = useCallback(async (processCode: string) => {
    if (!processCode) { setDesign({ steps: [] }); return { steps: [] } as ProcessDesign; }
    const response = await fetch(`${API}/process-design?processCode=${encodeURIComponent(processCode)}`, { credentials: "include", headers: { Accept: "application/json" } });
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) throw new Error(en ? `Process design returned HTTP ${response.status}.` : `프로세스 상세 API가 JSON 대신 HTTP ${response.status}를 반환했습니다.`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || (en ? "Could not load the process contract." : "절차 계약을 불러오지 못했습니다."));
    const result = body as ProcessDesign;
    setDesign(result);
    return result;
  }, [en]);

  const processes = useMemo(() => (catalog.businessTypes || []).flatMap(type => type.processes || []), [catalog.businessTypes]);
  const selectedProcess = processes.find(row => row.processCode === selectedProcessCode);
  const listedSteps = selectedProcess?.steps || [];
  const selectedStep = (design.steps || []).find(row => row.stepCode === selectedStepCode);
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (catalog.businessTypes || []).flatMap(type => (type.processes || []).flatMap(process => (process.steps || []).map(step => ({ type, process, step }))))
      .filter(({ type, process, step }) => {
        const bindings = Array.isArray(step.screenBindings) ? step.screenBindings as Row[] : [];
        const implementation = value(bindings[0], "implementationStatus").toUpperCase() || "UNVERIFIED";
        const matchesQuery = !needle || [type.workTypeName, type.workTypeCode, process.processName, process.processCode, step.stepName, step.stepCode, ...bindings.map(binding => value(binding, "routePath"))].join(" ").toLocaleLowerCase().includes(needle);
        const matchesStatus = status === "ALL" || implementation === status;
        return matchesQuery && matchesStatus;
      });
  }, [catalog.businessTypes, query, status]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadCatalog().then(data => {
      if (!active) return;
      const allProcesses = (data.businessTypes || []).flatMap(type => type.processes || []);
      const requestedProcess = params.get("processCode");
      const requestedStep = params.get("stepCode");
      const requested = allProcesses.find(process => process.processCode === requestedProcess && process.steps?.some(step => step.stepCode === requestedStep));
      const targetRoute = routeKey(params.get("routePath"));
      const routeMatch = targetRoute ? allProcesses.flatMap(process => (process.steps || []).map(step => ({ process, step }))).find(({ step }) => {
        const bindings = Array.isArray(step.screenBindings) ? step.screenBindings as Row[] : [];
        return bindings.some(binding => routeKey(binding.routePath) === targetRoute);
      }) : undefined;
      const first = requested || routeMatch?.process || allProcesses.find(process => process.processCode === requestedProcess) || allProcesses[0];
      const process = selectedProcessCode && allProcesses.find(item => item.processCode === selectedProcessCode) || first;
      setSelectedProcessCode(process?.processCode || "");
      const steps = process?.steps || [];
      const matchedStep = routeMatch?.process.processCode === process?.processCode ? routeMatch.step.stepCode : "";
      setSelectedStepCode(steps.some(step => step.stepCode === requestedStep) && (!requestedProcess || requestedProcess === process?.processCode)
        ? requestedStep || ""
        : matchedStep || steps[0]?.stepCode || "");
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadCatalog]);

  useEffect(() => {
    let active = true;
    if (!selectedProcessCode) return;
    loadDesign(selectedProcessCode).then(result => {
      if (!active) return;
      const first = result.steps?.find(step => step.stepCode === selectedStepCode) || result.steps?.[0];
      if (!result.steps?.some(step => step.stepCode === selectedStepCode)) setSelectedStepCode(first?.stepCode || "");
      if (first) setDraft({ inputContract: contractText(first.inputContract), outputContract: contractText(first.outputContract), completionRule: value(first, "completionRule") });
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [loadDesign, selectedProcessCode]);

  useEffect(() => {
    if (!selectedProcessCode) return;
    let active = true;
    setFlowError("");
    fetch(`${API}/design/professional-graph?processCode=${encodeURIComponent(selectedProcessCode)}`, { credentials: "include", headers: { Accept: "application/json" } })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || `업무 흐름 연결을 불러오지 못했습니다 (HTTP ${response.status}).`);
        if (active) setFlowEdges(Array.isArray(body.edges) ? body.edges : []);
      })
      .catch(reason => { if (active) { setFlowEdges([]); setFlowError(reason instanceof Error ? reason.message : String(reason)); } });
    return () => { active = false; };
  }, [selectedProcessCode]);

  useEffect(() => {
    if (!selectedStep) return;
    setDraft({ inputContract: contractText(selectedStep.inputContract), outputContract: contractText(selectedStep.outputContract), completionRule: value(selectedStep, "completionRule") });
    setReason("");
  }, [selectedStepCode, design]);

  useEffect(() => {
    if (activeView !== "compare" || !selectedProcessCode) return;
    let active = true;
    setRevisionLoading(true);
    setRevisionError("");
    fetch(`${API}/processes/${encodeURIComponent(selectedProcessCode)}/revisions`, { credentials: "include", headers: { Accept: "application/json" } })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || `Revision 이력을 불러오지 못했습니다 (HTTP ${response.status}).`);
        if (active) setRevisionHistory(Array.isArray(body.revisions) ? body.revisions : []);
      })
      .catch(reason => { if (active) setRevisionError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (active) setRevisionLoading(false); });
    return () => { active = false; };
  }, [activeView, selectedProcessCode]);

  const refresh = async () => {
    setError("");
    try { await loadCatalog(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const structureSaved = async () => { await loadCatalog(); await loadDesign(selectedProcessCode); setRevisionHistory([]); };

  const save = async () => {
    if (!selectedProcess || !selectedStep) return;
    if (!reason.trim()) { setError(en ? "Enter a revision reason." : "변경 사유를 입력해 주세요."); return; }
    for (const [field, raw] of [["inputContract", draft.inputContract], ["outputContract", draft.outputContract]] as const) {
      try { const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); }
      catch { setError(en ? `${field} must be a JSON object.` : `${field}는 JSON 객체여야 합니다.`); return; }
    }
    const before = value(selectedProcess, "processVersion") || "";
    const original = (design.steps || []).find(step => step.stepCode === selectedStep.stepCode);
    if (!original) { setError(en ? "Reload the step before editing." : "저장 전에 절차를 다시 불러와 주세요."); return; }
    const payload: Row = { revisionReason: reason.trim(), expectedProcessVersion: before };
    if (draft.inputContract !== contractText(original.inputContract)) payload.inputContract = draft.inputContract;
    if (draft.outputContract !== contractText(original.outputContract)) payload.outputContract = draft.outputContract;
    if (draft.completionRule !== value(original, "completionRule")) payload.completionRule = draft.completionRule;
    if (Object.keys(payload).length === 2) { setError(en ? "Change at least one contract field." : "변경할 계약 항목이 없습니다."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${API}/processes/${encodeURIComponent(selectedProcess.processCode)}/steps/${encodeURIComponent(selectedStep.stepCode)}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(response.status === 409 ? (en ? "Definition changed since it was loaded. Your draft is preserved; reload to compare." : "불러온 뒤 정의가 변경되었습니다. 입력 내용은 보존했습니다. 최신 정의를 다시 불러와 비교해 주세요.") : body.message || (en ? "Save failed." : "정의 저장에 실패했습니다."));
      const refreshedCatalog = await loadCatalog();
      const refreshedProcess = (refreshedCatalog.businessTypes || []).flatMap(type => type.processes || []).find(process => process.processCode === selectedProcess.processCode);
      await loadDesign(selectedProcess.processCode);
      setMessage(`${selectedStep.stepName || selectedStep.stepCode} 저장 완료 · 버전 ${before} → ${value(refreshedProcess, "processVersion") || value(body, "processVersion")}. 전체 업무 보기도 같은 카탈로그에서 갱신되었습니다.`);
      setReason("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  };

  return <AdminPageShell title="업무 설계·개발 통합 작업실" subtitle="정본 설계와 실제 개발 작업·코드 변경·검증 결과를 연결합니다." breadcrumbs={[{ label: "시스템 운영", href: "/admin/system/actor-process" }, { label: "업무 설계·개발 통합 작업실" }]}>

    <section className={`work-design-workspace${studio ? " design-studio" : ""}`} aria-label="업무 통합 작업 공간">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">관리자 · 업무 설계와 구현</p><h1 className="mt-1 text-3xl font-black text-[#052b57]">업무 설계·구현 통합 관리</h1><p className="mt-2 text-slate-600">정본 카탈로그를 기준으로 업무 순서·절차·화면 연결과 공식 Revision 편집을 함께 확인합니다.</p></div><div className="flex gap-2"><a className="rounded-lg border border-blue-300 bg-white px-4 py-3 font-bold text-[#174ea6]" href="/admin/system/actor-process">프로세스·절차 관리</a><a className="rounded-lg bg-[#052b57] px-4 py-3 font-bold text-white" href="/admin/system/process-catalog">전체 업무 보기</a></div></header>
      {params.get("routePath")&&<div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm" role="status"><strong>업무 화면에서 이어서 편집 중</strong><span className="ml-2 text-slate-700">{params.get("routePath")}</span><a className="ml-3 font-bold text-blue-800 underline" href={params.get("routePath")||"/admin"}>업무 화면으로 돌아가기</a></div>}
      <section className="grid gap-3 sm:grid-cols-3">{[["업무 종류", catalog.counts?.businessTypes ?? catalog.businessTypes?.length ?? "—"], ["프로세스", catalog.counts?.processes ?? (processes.length || "—")], ["절차", catalog.counts?.steps ?? (rows.length || "—")]].map(([label, count]) => <article key={String(label)} className="rounded-xl border bg-white p-4"><span className="text-sm text-slate-500">{String(label)}</span><strong className="mt-1 block text-2xl">{String(count)}</strong></article>)}</section>
      <details className="rounded-xl border bg-white"><summary className="cursor-pointer px-4 py-3 font-bold text-slate-700">병렬 개발 작업 명세 확인</summary><div className="p-3"><ParallelWorkPanel processes={processes} catalogLoaded={!loading && !!catalog.businessTypes?.length} /></div></details>
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">{error}</div>}
      {message && <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">{message} <a className="ml-2 font-bold underline" href="/admin/system/process-catalog">전체 업무 보기에서 확인</a></div>}
      {selectedProcess && selectedStep && <DevelopmentWorkbench studio={studio} key={`${selectedProcessCode}:${selectedStepCode}:${selectedProcess.processVersion || ""}`} context={{ processCode:selectedProcessCode, stepCode:selectedStepCode, processVersion:selectedProcess.processVersion || "", stepName:selectedStep.stepName || selectedStepCode, inputContract:selectedStep.inputContract, outputContract:selectedStep.outputContract, completionRule:value(selectedStep,"completionRule"), routePath:(resourceTarget.process===selectedProcessCode&&resourceTarget.step===selectedStepCode?resourceTarget.route:'') || value((listedSteps.find(s => s.stepCode === selectedStepCode)?.screenBindings as Row[] | undefined)?.[0],"routePath") || value(selectedStep,"userPath","adminPath") }} onEdit={() => openEditor()} />}
      <section className="flex flex-wrap gap-3 rounded-xl border bg-white p-4"><label className="min-w-64 flex-1 text-sm font-bold">업무·프로세스·절차 검색<input className="mt-1 h-11 w-full rounded border px-3 font-normal" value={query} onChange={event => setQuery(event.target.value)} placeholder="업무명, 코드, 화면 경로" /></label><label className="w-56 text-sm font-bold">화면 구현 상태<select className="mt-1 h-11 w-full rounded border px-3" value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">전체</option><option value="IMPLEMENTED">구현됨</option><option value="PARTIAL">부분 구현</option><option value="MISSING">미구현</option><option value="UNVERIFIED">미확인</option></select></label><button className="self-end rounded border px-4 py-2 font-bold" onClick={() => void refresh()} disabled={loading}>목록 새로고침</button></section>
<DesignViews {...{onStructureSaved:structureSaved,onPageSelected:(route:string)=>setResourceTarget({process:selectedProcessCode,step:selectedStepCode,route})}} rows={studio ? rows.map(row => row.step.stepCode === selectedStepCode && row.process.processCode === selectedProcessCode ? { ...row, step: { ...row.step, ...selectedStep, screenBindings: row.step.screenBindings } } : row) : rows} processes={processes} selectedProcessCode={selectedProcessCode} selectedStepCode={selectedStepCode} flowEdges={flowEdges} flowError={flowError} revisionHistory={revisionHistory} revisionLoading={revisionLoading} revisionError={revisionError} onViewChange={setActiveView} onProcessSelect={processCode => { const next = processes.find(process => process.processCode === processCode); setSelectedProcessCode(processCode); setSelectedStepCode(next?.steps?.[0]?.stepCode || ""); setMessage(""); }} onStepSelect={(processCode,stepCode) => { setSelectedProcessCode(processCode); setSelectedStepCode(stepCode); setMessage(""); }} onEdit={(processCode,stepCode) => { setSelectedProcessCode(processCode); setSelectedStepCode(stepCode); setMessage(""); openEditor(); }} />
      <dialog ref={editorRef} className="work-contract-dialog" aria-label="절차 계약 편집"><button type="button" className="float-right rounded border px-3 py-2" onClick={() => editorRef.current?.close()}>닫기</button><section id="work-contract-editor" className="scroll-mt-5 rounded-xl border border-blue-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">공식 Revision 저장</p><h2 className="mt-1 text-xl font-black text-[#052b57]">절차 계약 편집</h2><p className="mt-1 text-sm text-slate-600">저장 시 Before/After Snapshot과 Revision Audit을 기록하고 프로세스 버전을 올립니다.</p></div>{selectedProcess && <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-900">현재 프로세스 버전 {selectedProcess.processVersion || "?"}</span>}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-sm font-bold">프로세스<select className="mt-1 h-11 w-full rounded border px-3" value={selectedProcessCode} onChange={event => { setSelectedProcessCode(event.target.value); const next = processes.find(process => process.processCode === event.target.value); setSelectedStepCode(next?.steps?.[0]?.stepCode || ""); setMessage(""); }}><option value="">선택</option>{processes.map(process => <option key={process.processCode} value={process.processCode}>{process.processName} ({process.processCode})</option>)}</select></label><label className="text-sm font-bold">절차<select className="mt-1 h-11 w-full rounded border px-3" value={selectedStepCode} onChange={event => setSelectedStepCode(event.target.value)}><option value="">선택</option>{listedSteps.map(step => <option key={step.stepCode} value={step.stepCode}>{step.stepOrder}. {step.stepName} ({step.stepCode})</option>)}</select></label></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="text-sm font-bold">입력 계약 JSON<textarea className="mt-1 min-h-48 w-full rounded border p-3 font-mono text-xs" value={draft.inputContract} onChange={event => setDraft(value => ({ ...value, inputContract: event.target.value }))} /></label><label className="text-sm font-bold">출력 계약 JSON<textarea className="mt-1 min-h-48 w-full rounded border p-3 font-mono text-xs" value={draft.outputContract} onChange={event => setDraft(value => ({ ...value, outputContract: event.target.value }))} /></label><label className="text-sm font-bold lg:col-span-2">완료 규칙<textarea className="mt-1 min-h-24 w-full rounded border p-3" value={draft.completionRule} onChange={event => setDraft(value => ({ ...value, completionRule: event.target.value }))} /></label><label className="text-sm font-bold lg:col-span-2">변경 사유<textarea className="mt-1 min-h-20 w-full rounded border p-3" value={reason} onChange={event => setReason(event.target.value)} required /></label></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">저장 계약: inputContract · outputContract · completionRule · revisionReason · expectedProcessVersion</p><button className="rounded-lg bg-[#052b57] px-5 py-3 font-bold text-white disabled:opacity-50" onClick={() => void save()} disabled={saving || loading || !selectedStep}>{saving ? "저장 중…" : "Revision 저장 후 전체 업무 보기 갱신"}</button></div>
      </section></dialog>
    </section>
  </AdminPageShell>;
}
