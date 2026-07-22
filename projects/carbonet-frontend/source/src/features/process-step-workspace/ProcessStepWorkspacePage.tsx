import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

type Row = Record<string, unknown>;
type Dashboard = { processes?: Row[]; steps?: Row[] };
type Execution = Row & { found?: boolean; events?: Row[] };
const value = (row: Row | undefined, key: string) => String(row?.[key] ?? "");

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error(`서버 응답 형식이 올바르지 않습니다. (${response.status})`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || `요청을 처리하지 못했습니다. (${response.status})`);
  return body as Row;
}

export function ProcessStepWorkspacePage() {
  const en = isEnglish();
  const query = new URLSearchParams(location.search);
  const initialProcess = query.get("process") || "EMISSION_PROJECT";
  const initialStep = query.get("step") || "";
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [processCode, setProcessCode] = useState(initialProcess);
  const [stepCode, setStepCode] = useState(initialStep);
  const [tenantId, setTenantId] = useState(query.get("tenantId") || "");
  const [projectId, setProjectId] = useState(query.get("projectId") || "");
  const [execution, setExecution] = useState<Execution>({});
  const [evidenceRef, setEvidenceRef] = useState("");
  const [workNote, setWorkNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const processes = dashboard.processes || [];
  const steps = useMemo(() => (dashboard.steps || [])
    .filter(row => value(row, "processCode") === processCode)
    .sort((a, b) => Number(a.stepOrder || 0) - Number(b.stepOrder || 0)), [dashboard.steps, processCode]);
  const selectedStep = steps.find(row => value(row, "stepCode") === stepCode) || steps[0];
  const currentStepCode = value(execution, "currentStepCode");
  const actorCode = value(selectedStep, "actorCode");

  useEffect(() => {
    const url = buildLocalizedPath("/admin/api/system/actor-process", "/en/admin/api/system/actor-process");
    void jsonRequest(url).then(body => setDashboard(body as Dashboard)).catch(reason => setError(String(reason.message || reason)));
  }, []);
  useEffect(() => {
    if (steps.length && !steps.some(row => value(row, "stepCode") === stepCode)) setStepCode(value(steps[0], "stepCode"));
  }, [steps, stepCode]);

  const loadExecution = async () => {
    if (!tenantId.trim() || !projectId.trim()) { setError("테넌트 ID와 프로젝트 ID를 입력하세요."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const params = new URLSearchParams({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode });
      const body = await jsonRequest(`${buildLocalizedPath("/home/api/process-executions", "/en/home/api/process-executions")}?${params}`);
      setExecution(body); setMessage(body.found ? "실행 정보를 불러왔습니다." : "진행 중인 실행이 없습니다.");
      if (body.currentStepCode) setStepCode(String(body.currentStepCode));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const startExecution = async () => {
    if (!tenantId.trim() || !projectId.trim() || !actorCode) { setError("프로젝트 문맥과 첫 단계 액터를 확인하세요."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await jsonRequest(buildLocalizedPath("/home/api/process-executions/start", "/en/home/api/process-executions/start"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode, actorCode }),
      });
      setMessage("프로세스 실행을 시작했습니다."); await loadExecution();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
  };

  const completeStep = async () => {
    const executionId = value(execution, "executionId");
    if (!executionId || !selectedStep) { setError("먼저 실행 정보를 조회하거나 프로세스를 시작하세요."); return; }
    if (currentStepCode !== value(selectedStep, "stepCode")) { setError("현재 실행 단계만 완료할 수 있습니다."); return; }
    if (!workNote.trim()) { setError("업무 처리 내용을 입력하세요."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const body = await jsonRequest(`${buildLocalizedPath("/home/api/process-executions", "/en/home/api/process-executions")}/${executionId}/commands`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode,
          stepCode: value(selectedStep, "stepCode"), actorCode, commandCode: value(selectedStep, "commandCode"),
          idempotencyKey: crypto.randomUUID(), requestJson: JSON.stringify({ workNote: workNote.trim(), evidenceRef: evidenceRef.trim() }),
          resultJson: JSON.stringify({ completed: true, evidenceRef: evidenceRef.trim() }) }),
      });
      setMessage(body.executionStatus === "COMPLETED" ? "전체 프로세스가 완료되었습니다." : "단계를 완료하고 다음 업무로 이동했습니다.");
      setWorkNote(""); setEvidenceRef(""); await loadExecution();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
  };

  return <AdminPageShell breadcrumbs={[
    { label: en ? "Admin" : "관리자", href: buildLocalizedPath("/admin/", "/en/admin/") },
    { label: en ? "Process workspace" : "프로세스 작업공간", href: buildLocalizedPath("/admin/system/process-workspace", "/en/admin/system/process-workspace") },
    { label: en ? "Step execution" : "단계 실행" },
  ]} title={en ? "Process Step Workspace" : "프로세스 단계 실행 작업공간"}>
    <div className="space-y-5">
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white shadow-sm">
        <p className="text-sm font-bold text-blue-100">ACTOR · PROCESS · TEST · TASK</p>
        <h2 className="mt-2 text-2xl font-black">업무 문맥 확인 → 단계 처리 → 증적 저장 → 다음 업무 인계</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-50">로그인 계정에 배정된 프로젝트 액터만 실행을 조회하고 처리할 수 있습니다. 모든 명령은 서버의 상태 전이 계약과 멱등키로 검증됩니다.</p>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-white p-5 lg:grid-cols-4">
        <Field label="프로세스"><select className="min-h-11 w-full rounded-lg border px-3" value={processCode} onChange={event => { setProcessCode(event.target.value); setExecution({}); }}>
          {processes.map(row => <option key={value(row, "processCode")} value={value(row, "processCode")}>{value(row, "processName")} ({value(row, "processCode")})</option>)}</select></Field>
        <Field label="테넌트 ID"><input className="min-h-11 w-full rounded-lg border px-3" value={tenantId} onChange={event => setTenantId(event.target.value)} /></Field>
        <Field label="프로젝트 ID"><input className="min-h-11 w-full rounded-lg border px-3" value={projectId} onChange={event => setProjectId(event.target.value)} /></Field>
        <div className="flex items-end gap-2"><button className="min-h-11 flex-1 rounded-lg border border-blue-600 px-3 font-bold text-blue-700 disabled:opacity-50" disabled={busy} onClick={() => void loadExecution()}>실행 조회</button><button className="min-h-11 flex-1 rounded-lg bg-blue-600 px-3 font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => void startExecution()}>실행 시작</button></div>
      </section>

      {(message || error) && <div aria-live="polite" className={`rounded-xl border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}

      <section className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border bg-white p-4"><h3 className="font-black text-[#052b57]">업무 실행 순서</h3><ol className="mt-4 space-y-2">{steps.map((row, index) => {
          const code = value(row, "stepCode"); const current = code === currentStepCode; const selected = code === value(selectedStep, "stepCode");
          return <li key={code}><button className={`w-full rounded-xl border p-3 text-left ${selected ? "border-blue-500 bg-blue-50" : "border-slate-200"}`} onClick={() => setStepCode(code)}><span className="text-xs font-bold text-slate-500">{index + 1}단계 · {value(row, "actorCode")}</span><strong className="mt-1 block text-sm text-slate-900">{value(row, "stepName")}</strong>{current && <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">현재 업무</span>}</button></li>;
        })}</ol></aside>

        <div className="space-y-5">
          <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">{value(selectedStep, "stepCode")} · {actorCode}</p><h3 className="mt-1 text-xl font-black text-[#052b57]">{value(selectedStep, "stepName") || "단계를 선택하세요"}</h3></div><span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold">{value(selectedStep, "fromState")} → {value(selectedStep, "toState")}</span></div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{value(selectedStep, "requirementText") || "등록된 단계 요구사항이 없습니다."}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><Contract title="진입 데이터 계약" body={value(selectedStep, "inputContract")} /><Contract title="완료·인계 데이터 계약" body={value(selectedStep, "outputContract")} /><Contract title="완료 판정 기준" body={value(selectedStep, "completionRule")} /><Contract title="실행 API" body={value(selectedStep, "apiContract")} /></div>
          </section>

          <section className="rounded-2xl border bg-white p-5"><h3 className="font-black text-[#052b57]">처리 결과와 검증 증적</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="업무 처리 내용 (필수)"><textarea className="min-h-28 w-full rounded-lg border p-3" value={workNote} onChange={event => setWorkNote(event.target.value)} /></Field><Field label="증빙·결과 참조"><textarea className="min-h-28 w-full rounded-lg border p-3" placeholder="문서 ID, 파일 경로, 검증 결과 또는 감사 증적" value={evidenceRef} onChange={event => setEvidenceRef(event.target.value)} /></Field></div>
            <div className="mt-4 flex flex-wrap justify-between gap-3"><p className="text-sm text-slate-600">명령: <strong>{value(selectedStep, "commandCode") || "-"}</strong> · 현재 실행: <strong>{value(execution, "executionStatus") || "미조회"}</strong></p><button className="min-h-11 rounded-lg bg-[#246beb] px-5 font-bold text-white disabled:opacity-50" disabled={busy || !execution.found || currentStepCode !== value(selectedStep, "stepCode")} onClick={() => void completeStep()}>검증 후 단계 완료</button></div>
          </section>

          <section className="rounded-2xl border bg-white p-5"><h3 className="font-black text-[#052b57]">상태 전이·감사 이력</h3>{(execution.events || []).length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-3">단계</th><th className="p-3">액터</th><th className="p-3">명령</th><th className="p-3">상태 전이</th><th className="p-3">처리 시각</th></tr></thead><tbody>{(execution.events || []).map(row => <tr className="border-b" key={value(row, "eventId")}><td className="p-3 font-bold">{value(row, "stepCode")}</td><td className="p-3">{value(row, "actorCode")}</td><td className="p-3">{value(row, "commandCode")}</td><td className="p-3">{value(row, "fromState")} → {value(row, "toState")}</td><td className="p-3">{value(row, "executedAt")}</td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">실행을 조회하면 단계별 감사 이력이 표시됩니다.</p>}</section>
        </div>
      </section>
    </div>
  </AdminPageShell>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>{children}</label>; }
function Contract({ title, body }: { title: string; body: string }) { return <article className="rounded-xl bg-slate-50 p-4"><h4 className="text-sm font-black text-slate-800">{title}</h4><p className="mt-2 break-words text-xs leading-5 text-slate-600">{body || "등록된 계약 없음"}</p></article>; }
