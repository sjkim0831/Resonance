import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type Row = Record<string, unknown>;
type WorkDraft = Row & { found?: boolean; contract?: Row; draft?: Row };
type Execution = Row & { found?: boolean; events?: Row[] };

const inputClass = "krds-control min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 focus:border-[#246beb] focus:outline-none focus:ring-2 focus:ring-blue-100";
const value = (row: Row | undefined, key: string) => String(row?.[key] ?? "");

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error(`서버 응답 형식이 올바르지 않습니다. (${response.status})`);
  const body = await response.json() as Row;
  if (!response.ok) throw new Error(String(body.message || `요청 처리에 실패했습니다. (${response.status})`));
  return body;
}

export function WorkExecutionPage() {
  const en = isEnglish();
  const query = new URLSearchParams(location.search);
  const [tenantId, setTenantId] = useState(query.get("tenantId") || "");
  const [projectId, setProjectId] = useState(query.get("projectId") || "");
  const [processCode, setProcessCode] = useState(query.get("process") || "EMISSION_PROJECT");
  const [stepCode, setStepCode] = useState(query.get("step") || "EMISSION_PROJECT_COLLECT");
  const [work, setWork] = useState<WorkDraft>({});
  const [execution, setExecution] = useState<Execution>({});
  const [form, setForm] = useState({ workSummary: "", decisionBasis: "", resultValue: "", resultUnit: "", exceptionReason: "" });
  const [evidence, setEvidence] = useState({ documentId: "", sourceUrl: "", checksum: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const contract = work.contract || {};
  const draft = work.draft || {};
  const actorCode = value(contract, "actorCode");
  const currentStep = value(execution, "currentStepCode");
  const checks = useMemo(() => [
    { label: en ? "Work result recorded" : "업무 처리 결과 입력", passed: Boolean(form.workSummary.trim()) },
    { label: en ? "Decision basis recorded" : "판단·계산 근거 입력", passed: Boolean(form.decisionBasis.trim()) },
    { label: en ? "Evidence reference recorded" : "증빙 참조 입력", passed: Boolean(evidence.documentId.trim() || evidence.sourceUrl.trim()) },
    { label: en ? "Current actor and step matched" : "현재 액터·단계 일치", passed: Boolean(execution.found && currentStep === stepCode && actorCode) },
  ], [actorCode, currentStep, en, evidence.documentId, evidence.sourceUrl, execution.found, form.decisionBasis, form.workSummary, stepCode]);
  const readyToComplete = checks.every(check => check.passed);

  const contextParams = () => new URLSearchParams({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode, stepCode });
  const requireContext = () => {
    if (!tenantId.trim() || !projectId.trim() || !processCode.trim() || !stepCode.trim()) {
      setError(en ? "Enter tenant, project, process, and step." : "테넌트·프로젝트·프로세스·단계를 모두 입력하세요.");
      return false;
    }
    return true;
  };

  const applyDraft = (body: WorkDraft) => {
    setWork(body);
    const parseObject = (raw: unknown) => { if (raw && typeof raw === "object") return raw; if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } } return {}; };
    const payload = parseObject(body.draft?.payloadJson);
    const evidencePayload = parseObject(body.draft?.evidenceJson);
    if (payload && typeof payload === "object") setForm(current => ({ ...current, ...(payload as typeof form) }));
    if (evidencePayload && typeof evidencePayload === "object") setEvidence(current => ({ ...current, ...(evidencePayload as typeof evidence) }));
  };

  const load = async () => {
    if (!requireContext()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const base = buildLocalizedPath("/home/api/process-executions", "/en/home/api/process-executions");
      const [draftBody, executionBody] = await Promise.all([
        requestJson(`${base}/draft?${contextParams()}`),
        requestJson(`${base}?${new URLSearchParams({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode })}`),
      ]);
      applyDraft(draftBody as WorkDraft);
      setExecution(executionBody as Execution);
      if (executionBody.currentStepCode) setStepCode(String(executionBody.currentStepCode));
      setMessage(en ? "The latest work context was loaded." : "최신 업무 문맥과 임시저장을 불러왔습니다.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (tenantId && projectId) void load();
    // Initial deep-link context is loaded once. Subsequent edits use the explicit load button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistDraft = async () => {
      const body = await requestJson(buildLocalizedPath("/home/api/process-executions/draft", "/en/home/api/process-executions/draft"), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode, stepCode, actorCode,
          expectedVersion: Number(draft.draftVersion || 0), payloadJson: JSON.stringify(form), evidenceJson: JSON.stringify(evidence) }),
      });
      applyDraft(body as WorkDraft);
      return body as WorkDraft;
  };

  const saveDraft = async () => {
    if (!requireContext()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await persistDraft();
      setMessage(en ? "Draft saved with version control." : "임시저장을 버전 관리와 함께 저장했습니다.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const startExecution = async () => {
    if (!requireContext() || !actorCode) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await requestJson(buildLocalizedPath("/home/api/process-executions/start", "/en/home/api/process-executions/start"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode, actorCode }),
      });
      setMessage(en ? "Process execution started." : "프로세스 실행을 시작했습니다.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
  };

  const complete = async () => {
    const executionId = value(execution, "executionId");
    if (!readyToComplete || !executionId) { setError(en ? "Resolve every completion check first." : "완료 점검 항목을 모두 충족하세요."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const saved = await persistDraft();
      const savedVersion = Number(saved.draft?.draftVersion || 0);
      const body = await requestJson(`${buildLocalizedPath("/home/api/process-executions", "/en/home/api/process-executions")}/${executionId}/commands`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode, stepCode, actorCode,
          commandCode: value(contract, "commandCode"), idempotencyKey: crypto.randomUUID(), requestJson: JSON.stringify({ ...form, evidence }),
          resultJson: JSON.stringify({ completed: true, draftVersion: savedVersion }) }),
      });
      setMessage(body.executionStatus === "COMPLETED" ? (en ? "The process is complete." : "전체 프로세스가 완료되었습니다.") : (en ? "Step complete. The next actor can continue." : "단계를 완료했습니다. 다음 액터가 업무를 이어갈 수 있습니다."));
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
  };

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-8">
    <nav aria-label={en ? "Breadcrumb" : "현재 위치"} className="gov-text-body-sm text-slate-500"><a className="hover:underline" href={buildLocalizedPath("/home", "/en/home")}>{en ? "Home" : "홈"}</a><span className="px-2">/</span><a className="hover:underline" href={buildLocalizedPath("/emission/my-tasks", "/en/emission/my-tasks")}>{en ? "My tasks" : "내 업무"}</a><span className="px-2">/</span><strong>{en ? "Work execution" : "업무 실행"}</strong></nav>
    <header className="mt-4 rounded-2xl bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white shadow-sm lg:p-8">
      <p className="gov-text-label font-black text-blue-100">ACTOR · PROCESS · TEST · TASK</p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="gov-text-heading-lg font-black">{en ? "Professional Work Execution" : "전문 업무 실행"}</h1><p className="gov-text-body mt-2 max-w-3xl text-blue-50">{en ? "Record inputs, evidence, validation, and completion in one actor-scoped workspace." : "액터에게 배정된 실제 업무의 입력·증빙·검증·완료와 다음 단계 인계를 하나의 작업공간에서 처리합니다."}</p></div><a className="krds-control inline-flex items-center justify-center rounded-lg border border-white/60 bg-white/10 px-4 font-bold text-white" href={buildLocalizedPath("/emission/my-tasks", "/en/emission/my-tasks")}>{en ? "Back to my tasks" : "내 업무로 돌아가기"}</a></div>
    </header>

    <section className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2 xl:grid-cols-5">
      <Field label={en ? "Tenant ID" : "테넌트 ID"}><input className={inputClass} value={tenantId} onChange={event => setTenantId(event.target.value)} /></Field>
      <Field label={en ? "Project ID" : "프로젝트 ID"}><input className={inputClass} value={projectId} onChange={event => setProjectId(event.target.value)} /></Field>
      <Field label={en ? "Process" : "프로세스"}><input className={inputClass} value={processCode} onChange={event => setProcessCode(event.target.value)} /></Field>
      <Field label={en ? "Step" : "단계"}><input className={inputClass} value={stepCode} onChange={event => setStepCode(event.target.value)} /></Field>
      <div className="flex items-end"><button className="krds-control min-h-11 w-full rounded-lg bg-[#246beb] px-4 font-black text-white disabled:opacity-50" disabled={busy} onClick={() => void load()}>{en ? "Load work" : "업무 불러오기"}</button></div>
    </section>

    {(message || error) && <p aria-live="polite" className={`mt-5 rounded-xl border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</p>}

    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_22rem]">
      <div className="space-y-6">
        <section className="krds-component rounded-2xl border bg-white"><div className="flex flex-wrap items-start justify-between gap-3 border-b p-5"><div><p className="gov-text-label font-black text-[#246beb]">{processCode} · {stepCode}</p><h2 className="gov-text-heading-md mt-2 font-black text-[#052b57]">{value(contract, "stepName") || (en ? "Load the assigned work" : "배정된 업무를 불러오세요")}</h2><p className="gov-text-body-sm mt-2 text-slate-600">{value(contract, "requirementText")}</p></div><div className="text-right"><Status>{value(execution, "executionStatus") || "NOT_STARTED"}</Status><p className="gov-text-label mt-2 text-slate-500">{en ? "Draft version" : "임시저장 버전"} {value(draft, "draftVersion") || "0"}</p></div></div>
          <div className="grid gap-4 p-5 md:grid-cols-2"><Contract label={en ? "Entry contract" : "진입 데이터 계약"} text={value(contract, "inputContract")} /><Contract label={en ? "Completion rule" : "완료 판정 기준"} text={value(contract, "completionRule")} /><Contract label={en ? "Output contract" : "결과·인계 계약"} text={value(contract, "outputContract")} /><Contract label={en ? "Responsible actor" : "담당 액터"} text={actorCode} /></div>
        </section>

        <section className="krds-component rounded-2xl border bg-white p-5"><h2 className="gov-text-heading-md font-black text-[#052b57]">{en ? "Work result" : "업무 처리 결과"}</h2><p className="gov-text-body-sm mt-2 text-slate-600">{en ? "All decisions must remain reproducible from the recorded basis and evidence." : "모든 판단은 입력한 근거와 증빙으로 재현할 수 있어야 합니다."}</p><div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label={en ? "Work summary *" : "처리 결과 요약 *"}><textarea className={`${inputClass} min-h-32 py-3`} value={form.workSummary} onChange={event => setForm({ ...form, workSummary: event.target.value })} /></Field>
          <Field label={en ? "Decision or calculation basis *" : "판단·계산 근거 *"}><textarea className={`${inputClass} min-h-32 py-3`} value={form.decisionBasis} onChange={event => setForm({ ...form, decisionBasis: event.target.value })} /></Field>
          <Field label={en ? "Result value" : "결과값"}><input className={inputClass} inputMode="decimal" value={form.resultValue} onChange={event => setForm({ ...form, resultValue: event.target.value })} /></Field>
          <Field label={en ? "Result unit" : "결과 단위"}><input className={inputClass} value={form.resultUnit} onChange={event => setForm({ ...form, resultUnit: event.target.value })} /></Field>
          <div className="md:col-span-2"><Field label={en ? "Exception and follow-up" : "예외·보완 사항"}><textarea className={`${inputClass} min-h-24 py-3`} value={form.exceptionReason} onChange={event => setForm({ ...form, exceptionReason: event.target.value })} /></Field></div>
        </div></section>

        <section className="krds-component rounded-2xl border bg-white p-5"><h2 className="gov-text-heading-md font-black text-[#052b57]">{en ? "Evidence and lineage" : "증빙·출처 이력"}</h2><div className="mt-5 grid gap-4 md:grid-cols-3"><Field label={en ? "Document ID *" : "문서·증빙 ID *"}><input className={inputClass} value={evidence.documentId} onChange={event => setEvidence({ ...evidence, documentId: event.target.value })} /></Field><Field label={en ? "Source URL or repository" : "출처 URL·저장소"}><input className={inputClass} value={evidence.sourceUrl} onChange={event => setEvidence({ ...evidence, sourceUrl: event.target.value })} /></Field><Field label={en ? "Checksum" : "무결성 체크섬"}><input className={inputClass} value={evidence.checksum} onChange={event => setEvidence({ ...evidence, checksum: event.target.value })} /></Field></div></section>

        <section className="krds-component rounded-2xl border bg-white p-5"><h2 className="gov-text-heading-md font-black text-[#052b57]">{en ? "Execution audit trail" : "실행·감사 이력"}</h2>{(execution.events || []).length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b bg-slate-50"><th className="p-3">{en ? "Step" : "단계"}</th><th className="p-3">{en ? "Actor" : "액터"}</th><th className="p-3">{en ? "Command" : "명령"}</th><th className="p-3">{en ? "Transition" : "상태 전이"}</th><th className="p-3">{en ? "Time" : "처리 시각"}</th></tr></thead><tbody>{(execution.events || []).map(row => <tr className="border-b" key={value(row, "eventId")}><td className="p-3 font-bold">{value(row, "stepCode")}</td><td className="p-3">{value(row, "actorCode")}</td><td className="p-3">{value(row, "commandCode")}</td><td className="p-3">{value(row, "fromState")} → {value(row, "toState")}</td><td className="p-3">{value(row, "executedAt")}</td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-xl bg-slate-50 p-5 text-slate-600">{en ? "No execution events yet." : "아직 실행 이력이 없습니다."}</p>}</section>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <section className="krds-component rounded-2xl border bg-white p-5"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Completion checks" : "완료 점검"}</h2><ul className="mt-4 space-y-3">{checks.map(check => <li className="flex items-start gap-3" key={check.label}><span aria-hidden="true" className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${check.passed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{check.passed ? "✓" : "–"}</span><span className="gov-text-body-sm text-slate-700">{check.label}</span></li>)}</ul></section>
        <section className="krds-component rounded-2xl border bg-white p-5"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Work actions" : "업무 실행"}</h2><div className="mt-4 grid gap-3"><button className="krds-control rounded-lg border border-[#246beb] bg-white font-black text-[#246beb] disabled:opacity-50" disabled={busy || !actorCode} onClick={() => void saveDraft()}>{en ? "Save draft" : "임시저장"}</button>{!execution.found && <button className="krds-control rounded-lg bg-[#052b57] font-black text-white disabled:opacity-50" disabled={busy || !actorCode} onClick={() => void startExecution()}>{en ? "Start process" : "프로세스 시작"}</button>}<button className="krds-control rounded-lg bg-[#246beb] font-black text-white disabled:opacity-50" disabled={busy || !readyToComplete} onClick={() => void complete()}>{en ? "Validate and complete" : "검증 후 단계 완료"}</button></div><p className="gov-text-body-sm mt-4 text-slate-500">{en ? "Completion is idempotent and server-authoritative." : "완료 명령은 멱등키와 서버 상태 전이 규칙으로 중복 처리를 방지합니다."}</p></section>
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Next handoff" : "다음 업무 인계"}</h2><p className="gov-text-body-sm mt-3 text-slate-700">{value(contract, "outputContract") || (en ? "The next actor is determined after completion." : "완료 후 상태 전이 계약에 따라 다음 액터와 업무가 결정됩니다.")}</p></section>
      </aside>
    </section>
  </main>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="gov-text-label mb-2 block font-bold text-slate-700">{label}</span>{children}</label>; }
function Contract({ label, text }: { label: string; text: string }) { return <article className="rounded-xl bg-slate-50 p-4"><h3 className="gov-text-label font-black text-slate-700">{label}</h3><p className="gov-text-body-sm mt-2 break-words text-slate-600">{text || "-"}</p></article>; }
function Status({ children }: { children: ReactNode }) { return <span className="inline-flex rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">{children}</span>; }
