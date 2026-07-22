import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

type Row = Record<string, unknown>;
type Dashboard = { processes?: Row[]; steps?: Row[]; stepExecutionSpecs?: Row[] };
type Execution = Row & { found?: boolean; events?: Row[] };
type StepField = { fieldCode: string; label?: string; fieldName?: string; controlType?: string; required?: boolean; description?: string; options?: string[] };

const value = (row: Row | undefined, key: string) => String(row?.[key] ?? "");
const numberValue = (row: Row | undefined, key: string) => Number(row?.[key] ?? 0);

function parseFields(raw: string): StepField[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.fieldCode === "string") : [];
  } catch { return []; }
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`서버 응답 형식이 올바르지 않습니다. (${response.status})`);
  }
  const body = await response.json() as Row;
  if (!response.ok) throw new Error(String(body.message || `요청을 처리하지 못했습니다. (${response.status})`));
  return body;
}

function localizedText(en: boolean, ko: string, english: string) {
  return en ? english : ko;
}

export function ProcessStepWorkspacePage() {
  const en = isEnglish();
  const query = new URLSearchParams(location.search);
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [processCode, setProcessCode] = useState(query.get("process") || "EMISSION_PROJECT");
  const [stepCode, setStepCode] = useState(query.get("step") || "");
  const [tenantId, setTenantId] = useState(query.get("tenantId") || "");
  const [projectId, setProjectId] = useState(query.get("projectId") || "");
  const [execution, setExecution] = useState<Execution>({});
  const [evidenceRef, setEvidenceRef] = useState("");
  const [workNote, setWorkNote] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const processes = dashboard.processes || [];
  const process = processes.find(row => value(row, "processCode") === processCode);
  const steps = useMemo(() => (dashboard.steps || [])
    .filter(row => value(row, "processCode") === processCode)
    .sort((a, b) => numberValue(a, "stepOrder") - numberValue(b, "stepOrder")), [dashboard.steps, processCode]);
  const selectedStep = steps.find(row => value(row, "stepCode") === stepCode) || steps[0];
  const selectedSpec = (dashboard.stepExecutionSpecs || []).find(row => value(row, "processCode") === processCode && value(row, "stepCode") === value(selectedStep, "stepCode"));
  const stepFields = useMemo(() => parseFields(value(selectedSpec, "fieldContract")), [selectedSpec]);
  const missingRequiredField = stepFields.some(field => field.required && !String(fieldValues[field.fieldCode] || "").trim());
  const currentStepCode = value(execution, "currentStepCode");
  const actorCode = value(selectedStep, "actorCode");
  const currentIndex = Math.max(0, steps.findIndex(row => value(row, "stepCode") === currentStepCode));
  const progress = execution.found ? Math.round(((currentIndex + (value(execution, "executionStatus") === "COMPLETED" ? 1 : 0)) / Math.max(steps.length, 1)) * 100) : 0;

  useEffect(() => {
    const url = buildLocalizedPath("/admin/api/system/actor-process", "/en/admin/api/system/actor-process");
    void jsonRequest(url)
      .then(body => setDashboard(body as Dashboard))
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  useEffect(() => {
    if (steps.length && !steps.some(row => value(row, "stepCode") === stepCode)) setStepCode(value(steps[0], "stepCode"));
  }, [steps, stepCode]);

  useEffect(() => { setFieldValues({}); }, [processCode, stepCode]);

  useEffect(() => {
    const next = new URLSearchParams(location.search);
    next.set("process", processCode);
    if (stepCode) next.set("step", stepCode); else next.delete("step");
    if (tenantId) next.set("tenantId", tenantId); else next.delete("tenantId");
    if (projectId) next.set("projectId", projectId); else next.delete("projectId");
    history.replaceState(null, "", `${location.pathname}?${next.toString()}`);
  }, [processCode, stepCode, tenantId, projectId]);

  const clearFeedback = () => { setError(""); setMessage(""); };
  const requireContext = () => {
    if (tenantId.trim() && projectId.trim()) return true;
    setError(localizedText(en, "테넌트 ID와 프로젝트 ID를 입력해 주세요.", "Enter both tenant ID and project ID."));
    return false;
  };

  const loadExecution = async () => {
    if (!requireContext()) return;
    setBusy(true); clearFeedback();
    try {
      const params = new URLSearchParams({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode });
      const body = await jsonRequest(`${buildLocalizedPath("/home/api/process-executions", "/en/home/api/process-executions")}?${params}`);
      setExecution(body);
      setMessage(body.found
        ? localizedText(en, "실행 정보와 감사 이력을 불러왔습니다.", "Execution and audit history loaded.")
        : localizedText(en, "진행 중인 실행이 없습니다. 실행 시작을 선택해 주세요.", "No active execution. Select Start execution."));
      if (body.currentStepCode) setStepCode(String(body.currentStepCode));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setBusy(false); }
  };

  const startExecution = async () => {
    if (!requireContext()) return;
    if (!actorCode) { setError(localizedText(en, "첫 단계의 담당 액터를 확인할 수 없습니다.", "The first-step actor is unavailable.")); return; }
    setBusy(true); clearFeedback();
    try {
      await jsonRequest(buildLocalizedPath("/home/api/process-executions/start", "/en/home/api/process-executions/start"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode, actorCode }),
      });
      setMessage(localizedText(en, "프로세스 실행을 시작했습니다.", "Process execution started."));
      await loadExecution();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  };

  const completeStep = async () => {
    const executionId = value(execution, "executionId");
    if (!executionId || !selectedStep) { setError(localizedText(en, "실행을 조회하거나 새로 시작해 주세요.", "Load or start an execution first.")); return; }
    if (currentStepCode !== value(selectedStep, "stepCode")) { setError(localizedText(en, "현재 실행 단계만 완료할 수 있습니다.", "Only the current step can be completed.")); return; }
    if (!workNote.trim()) { setError(localizedText(en, "업무 처리 내용을 입력해 주세요.", "Enter the work result.")); return; }
    setBusy(true); clearFeedback();
    try {
      const body = await jsonRequest(`${buildLocalizedPath("/home/api/process-executions", "/en/home/api/process-executions")}/${executionId}/commands`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenantId.trim(), projectId: projectId.trim(), processCode,
          stepCode: value(selectedStep, "stepCode"), actorCode,
          commandCode: value(selectedStep, "commandCode"), idempotencyKey: crypto.randomUUID(),
          requestJson: JSON.stringify({ workNote: workNote.trim(), evidenceRef: evidenceRef.trim(), fields: fieldValues }),
          resultJson: JSON.stringify({ completed: true, evidenceRef: evidenceRef.trim() }),
        }),
      });
      setMessage(value(body, "executionStatus") === "COMPLETED"
        ? localizedText(en, "전체 프로세스가 완료되었습니다.", "The entire process is complete.")
        : localizedText(en, "단계를 완료하고 다음 담당자의 업무로 연결했습니다.", "Step completed and handed off to the next actor."));
      setWorkNote(""); setEvidenceRef(""); await loadExecution();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  };

  return <AdminPageShell breadcrumbs={[
    { label: localizedText(en, "관리자", "Admin"), href: buildLocalizedPath("/admin/", "/en/admin/") },
    { label: localizedText(en, "검증·워크플로", "Verification & workflow") },
    { label: localizedText(en, "프로세스 단계 실행", "Process step execution") },
  ]} title={localizedText(en, "프로세스 단계 실행 작업공간", "Process Step Workspace")}>
    <div className="space-y-5">
      <section className="rounded-2xl border border-blue-900/10 bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-sm font-bold text-blue-100">ACTOR · PROCESS · TEST · TASK</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">{value(process, "processName") || processCode}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-50">{localizedText(en,
              "프로젝트와 계정에 배정된 액터 권한으로 현재 단계만 처리합니다. 모든 명령은 상태 전이, 멱등성, 테넌트 격리와 감사 증적으로 검증됩니다.",
              "Work only on the current step with the actor assigned to this account and project. Every command is checked for state, idempotency, tenant isolation, and audit evidence.")}</p></div>
          <div className="min-w-52 rounded-xl bg-white/10 p-4"><div className="flex justify-between text-xs font-bold"><span>{localizedText(en, "진행률", "Progress")}</span><span>{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-blue-100">{value(execution, "executionStatus") || localizedText(en, "실행 전", "Not started")}</p></div>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label={localizedText(en, "프로세스", "Process")}><select className="min-h-11 w-full rounded-lg border border-slate-300 px-3" value={processCode} onChange={event => { setProcessCode(event.target.value); setExecution({}); clearFeedback(); }}>{processes.map(row => <option key={value(row, "processCode")} value={value(row, "processCode")}>{value(row, "processName")} ({value(row, "processCode")})</option>)}</select></Field>
        <Field label={localizedText(en, "테넌트 ID", "Tenant ID")}><input className="min-h-11 w-full rounded-lg border border-slate-300 px-3" value={tenantId} onChange={event => setTenantId(event.target.value)} /></Field>
        <Field label={localizedText(en, "프로젝트 ID", "Project ID")}><input className="min-h-11 w-full rounded-lg border border-slate-300 px-3" value={projectId} onChange={event => setProjectId(event.target.value)} /></Field>
        <div className="flex items-end gap-2"><button type="button" className="min-h-11 flex-1 rounded-lg border border-blue-600 px-3 font-bold text-blue-700 disabled:opacity-50" disabled={busy} onClick={() => void loadExecution()}>{localizedText(en, "실행 조회", "Load")}</button><button type="button" className="min-h-11 flex-1 rounded-lg bg-blue-600 px-3 font-bold text-white disabled:opacity-50" disabled={busy || Boolean(execution.found)} onClick={() => void startExecution()}>{localizedText(en, "실행 시작", "Start")}</button></div>
      </section>

      {(message || error) && <div role={error ? "alert" : "status"} aria-live="polite" className={`rounded-xl border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}

      <section className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border bg-white p-4 xl:sticky xl:top-24"><h3 className="font-black text-[#052b57]">{localizedText(en, "업무 실행 순서", "Execution sequence")}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{localizedText(en, "현재 단계는 녹색으로 표시됩니다.", "The current step is shown in green.")}</p><ol className="mt-4 space-y-2">{steps.map((row, index) => {
          const code = value(row, "stepCode"); const current = code === currentStepCode; const selected = code === value(selectedStep, "stepCode");
          return <li key={code}><button type="button" className={`w-full rounded-xl border p-3 text-left transition-colors ${current ? "border-emerald-400 bg-emerald-50" : selected ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`} onClick={() => setStepCode(code)}><span className="text-xs font-bold text-slate-500">{index + 1}{localizedText(en, "단계", " step")} · {value(row, "actorCode")}</span><strong className="mt-1 block text-sm text-slate-900">{value(row, "stepName")}</strong>{current && <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{localizedText(en, "현재 업무", "Current")}</span>}</button></li>;
        })}</ol></aside>

        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">{value(selectedStep, "stepCode")} · {actorCode}</p><h3 className="mt-1 text-xl font-black text-[#052b57]">{value(selectedStep, "stepName") || localizedText(en, "단계를 선택해 주세요.", "Select a step.")}</h3></div><span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold">{value(selectedStep, "fromState")} → {value(selectedStep, "toState")}</span></div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{value(selectedStep, "requirementText") || value(selectedStep, "completionRule") || localizedText(en, "등록된 단계 요구사항이 없습니다.", "No step requirement is registered.")}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><Contract title={localizedText(en, "진입 데이터 계약", "Input contract")} body={value(selectedStep, "inputContract")} /><Contract title={localizedText(en, "완료·인계 데이터 계약", "Output contract")} body={value(selectedStep, "outputContract")} /><Contract title={localizedText(en, "완료 판정 기준", "Completion rule")} body={value(selectedStep, "completionRule")} /><Contract title={localizedText(en, "실행 API", "Execution API")} body={value(selectedStep, "apiContract")} /></div>
            <div className="mt-4 flex flex-wrap gap-2">{value(selectedStep, "userPath") && <a className="inline-flex min-h-10 items-center rounded-lg border border-blue-200 px-3 text-sm font-bold text-blue-700" href={value(selectedStep, "userPath")}>{localizedText(en, "사용자 업무 화면", "User workspace")}</a>}{value(selectedStep, "adminPath") && <a className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700" href={value(selectedStep, "adminPath")}>{localizedText(en, "관리 화면", "Admin workspace")}</a>}</div>
          </section>

          <section className="rounded-2xl border bg-white p-5"><h3 className="font-black text-[#052b57]">{localizedText(en, "처리 결과와 검증 증적", "Result and verification evidence")}</h3>
            {stepFields.length > 0 && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-black text-[#052b57]">{localizedText(en, "단계별 전문 입력 항목", "Step-specific professional fields")}</h4><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-700">{stepFields.length}{localizedText(en, "개 항목", " fields")}</span></div><div className="mt-4 grid gap-4 md:grid-cols-2">{stepFields.map(field => <DynamicField key={field.fieldCode} field={field} value={fieldValues[field.fieldCode] || ""} onChange={next => setFieldValues(current => ({ ...current, [field.fieldCode]: next }))} />)}</div></div>}
            <div className="mt-4 grid gap-4 md:grid-cols-2"><Field label={localizedText(en, "업무 처리 내용 (필수)", "Work result (required)")}><textarea className="min-h-28 w-full rounded-lg border border-slate-300 p-3" maxLength={4000} value={workNote} onChange={event => setWorkNote(event.target.value)} /></Field><Field label={localizedText(en, "증빙·검증 결과 참조", "Evidence reference")}><textarea className="min-h-28 w-full rounded-lg border border-slate-300 p-3" maxLength={2000} placeholder={localizedText(en, "문서 ID, 파일 경로, 검증 결과 또는 감사 증적", "Document ID, file path, validation result, or audit evidence")} value={evidenceRef} onChange={event => setEvidenceRef(event.target.value)} /></Field></div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{localizedText(en, "명령", "Command")}: <strong>{value(selectedStep, "commandCode") || "-"}</strong> · {localizedText(en, "실행 상태", "Execution")}: <strong>{value(execution, "executionStatus") || localizedText(en, "미조회", "Not loaded")}</strong></p><button type="button" className="min-h-11 rounded-lg bg-[#246beb] px-5 font-bold text-white disabled:opacity-50" disabled={busy || !execution.found || currentStepCode !== value(selectedStep, "stepCode") || !workNote.trim() || missingRequiredField} onClick={() => void completeStep()}>{localizedText(en, "검증 후 단계 완료", "Validate and complete")}</button></div>
          </section>

          <section className="rounded-2xl border bg-white p-5"><h3 className="font-black text-[#052b57]">{localizedText(en, "상태 전이·감사 이력", "State transition audit")}</h3>{(execution.events || []).length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-3">{localizedText(en, "단계", "Step")}</th><th className="p-3">{localizedText(en, "액터", "Actor")}</th><th className="p-3">{localizedText(en, "명령", "Command")}</th><th className="p-3">{localizedText(en, "상태 전이", "Transition")}</th><th className="p-3">{localizedText(en, "처리 시각", "Executed at")}</th></tr></thead><tbody>{(execution.events || []).map(row => <tr className="border-b" key={value(row, "eventId")}><td className="p-3 font-bold">{value(row, "stepCode")}</td><td className="p-3">{value(row, "actorCode")}</td><td className="p-3">{value(row, "commandCode")}</td><td className="p-3">{value(row, "fromState")} → {value(row, "toState")}</td><td className="p-3">{value(row, "executedAt")}</td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">{localizedText(en, "실행을 조회하면 단계별 감사 이력이 표시됩니다.", "Load an execution to view step-level audit history.")}</p>}</section>
        </div>
      </section>
    </div>
  </AdminPageShell>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>{children}</label>;
}

function Contract({ title, body }: { title: string; body: string }) {
  let display = body;
  try { display = JSON.stringify(JSON.parse(body), null, 2); } catch { /* plain text contract */ }
  return <article className="min-w-0 rounded-xl bg-slate-50 p-4"><h4 className="text-sm font-black text-slate-800">{title}</h4><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-slate-600">{display || "-"}</pre></article>;
}

function DynamicField({ field, value: fieldValue, onChange }: { field: StepField; value: string; onChange: (value: string) => void }) {
  const label = field.label || field.fieldName || field.fieldCode;
  const control = String(field.controlType || "TEXT").toUpperCase();
  const common = { className: "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3", value: fieldValue, required: Boolean(field.required), onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <Field label={`${label}${field.required ? " *" : ""}`}>
    {control === "TEXTAREA" ? <textarea {...common} className={`${common.className} min-h-24 py-3`} />
      : control === "SELECT" && field.options?.length ? <select {...common}><option value="">선택</option>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select>
        : <input {...common} type={control === "DATE" ? "date" : control === "NUMBER" || control === "DECIMAL" ? "number" : "text"} />}
    {field.description && <span className="mt-1 block text-xs leading-5 text-slate-500">{field.description}</span>}
  </Field>;
}
