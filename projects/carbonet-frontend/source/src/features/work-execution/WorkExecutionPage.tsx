import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buildLocalizedPath, isEnglish, replace } from "../../lib/navigation/runtime";
import { ContractFieldControl, type ContractField } from "../generated-screen/ContractFieldControl";

type Row = Record<string, unknown>;
type WorkDraft = Row & { found?: boolean; contract?: Row; draft?: Row };
type Execution = Row & { found?: boolean; events?: Row[] };

const inputClass = "krds-control min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 focus:border-[#246beb] focus:outline-none focus:ring-2 focus:ring-blue-100";
const value = (row: Row | undefined, key: string) => String(row?.[key] ?? "");
const processNames: Record<string, [string, string]> = {
  EMISSION_PROJECT_PORTFOLIO: ["배출 프로젝트 선택·현황 관리", "Emission project portfolio"],
  ORGANIZATIONAL_BOUNDARY: ["조직 경계 설정", "Organizational boundary"],
  ACTIVITY_DATA: ["활동자료 수집·검증", "Activity data collection and verification"],
  EMISSION_CALCULATION: ["배출량 산정·검증", "Emission calculation and verification"],
  REPORT_CERTIFICATION: ["보고서 작성·인증", "Report and certification"],
  REGULATORY_SUBMISSION: ["규제 제출·보완", "Regulatory submission"],
};
const processName = (code: string, en: boolean) => processNames[code]?.[en ? 1 : 0] || code.split("_").join(" ");
const actorNames: Record<string, [string, string]> = {
  COMPANY_MANAGER: ["기업 관리자", "Company manager"], SITE_DATA_OWNER: ["사업장 자료 담당자", "Site data owner"],
  CALCULATOR: ["배출량 산정 담당자", "Emission calculator"], VERIFIER: ["독립 검증 담당자", "Independent verifier"],
  APPROVER: ["최종 승인 담당자", "Final approver"],
};
const actorName = (code: string, en: boolean) => actorNames[code]?.[en ? 1 : 0] || code.split("_").join(" ");
const stateNames: Record<string, [string, string]> = {
  NOT_STARTED: ["시작 전", "Not started"], RUNNING: ["진행 중", "In progress"], PLANNED: ["계획 완료", "Planned"],
  PROJECT_SELECTED: ["프로젝트 선택 완료", "Project selected"], SUBMITTED: ["제출 완료", "Submitted"],
  VERIFIED: ["검증 완료", "Verified"], COMPLETED: ["전체 완료", "Completed"],
};
function stateName(code: string, en: boolean) {
  const known = stateNames[code];
  if (known) return known[en ? 1 : 0];
  const step = code.match(/^STEP_(\d+)_COMPLETED$/);
  if (step) return en ? `Step ${step[1]} completed` : `${step[1]}단계 완료`;
  return code.split("_").join(" ");
}
const commandNames: Record<string, [string, string]> = { START: ["업무 시작", "Start work"], COMPLETE: ["단계 완료", "Complete step"], APPROVE: ["승인", "Approve"], SUBMIT: ["제출", "Submit"] };
const commandName = (code: string, en: boolean) => commandNames[code]?.[en ? 1 : 0] || code.split("_").join(" ");
function stepAuditName(code: string, en: boolean) {
  if (code === "EMISSION_PROJECT_PORTFOLIO_LIST") return en ? "Select emission project" : "배출 프로젝트 선택";
  const step = code.match(/(?:_S|_0?)(\d+)(?:_[A-Z]+)?$/);
  return step ? (en ? `Work step ${Number(step[1])}` : `${Number(step[1])}단계 업무`) : code.split("_").join(" ");
}
function businessText(raw: string, en: boolean) {
  if (!raw) return "";
  const replacements: Array<[RegExp, string, string]> = [
    [/\btenant\b/gi, "회사", "company"], [/\bactor\b/gi, "담당자", "responsible actor"], [/담당\s*액터/g, "담당자", "responsible actor"], [/액터/g, "담당자", "actor"],
    [/화면[·/]API[·/]DB\s*계약/gi, "화면과 업무 데이터 처리 규칙", "screen and business data rules"],
    [/API[·/]DB\s*계약/gi, "업무 데이터 저장·조회 규칙", "business data storage and lookup rules"],
    [/\bVERIFY\s*명령/g, "검증 완료 처리", "verification completion action"],
    [/\bAPPROVE\s*명령/g, "최종 승인 처리", "final approval action"],
    [/\bSUBMIT\s*명령/g, "제출 처리", "submission action"],
    [/\bCOMPLETE\s*명령/g, "단계 완료 처리", "step completion action"],
    [/\bSTART\s*명령/g, "업무 시작 처리", "work start action"],
    [/\bcommand\b/gi, "업무 처리", "work action"], [/\bpayload\b/gi, "입력 데이터", "input data"],
    [/\bsnapshot\b/gi, "처리 시점 기록", "point-in-time record"], [/\bidempotency\b/gi, "중복 처리 방지", "duplicate-processing prevention"],
  ];
  return replacements.reduce((text, [pattern, ko, english]) => text.replace(pattern, en ? english : ko), raw);
}

function parseContractFields(raw: unknown): ContractField[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const field = item as Row;
      return {
        ...field,
        code: String(field.fieldCode || field.code || ""),
        label: String(field.fieldName || field.label || field.fieldCode || ""),
        control: field.controlType || field.control,
      } as ContractField;
    }).filter((field) => field.code && field.editable !== false);
  } catch { return []; }
}
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
  const shellMode = query.get("shell") === "1" || location.pathname === "/home/workspace" || location.pathname === "/en/home/workspace";
  const sourcePath = query.get("screenPath") || "";
  const [tenantId, setTenantId] = useState(query.get("tenantId") || "");
  const [projectId, setProjectId] = useState(query.get("projectId") || "");
  const [processCode, setProcessCode] = useState(query.get("processCode") || query.get("process") || "EMISSION_PROJECT");
  const [stepCode, setStepCode] = useState(query.get("stepCode") || query.get("step") || "EMISSION_PROJECT_COLLECT");
  const [values, setValues] = useState<Record<string,string>>({});
  const [work, setWork] = useState<WorkDraft>({});
  const [execution, setExecution] = useState<Execution>({});
  const [form, setForm] = useState({ workSummary: "", decisionBasis: "", resultValue: "", resultUnit: "", exceptionReason: "" });
  const [evidence, setEvidence] = useState({ documentId: "", sourceUrl: "", checksum: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [handoff, setHandoff] = useState<Row>({});

  const contract = work.contract || {};
  const draft = work.draft || {};
  const actorCode = value(contract, "actorCode");
  const currentStep = value(execution, "currentStepCode");
  const contractFields = useMemo(() => parseContractFields(contract.fieldContractJson), [contract.fieldContractJson]);
  useEffect(() => {
    if (!contractFields.length) return;
    setValues((current) => {
      const next = { ...current };
      const year = String(new Date().getFullYear());
      for (const field of contractFields) {
        if (next[field.code]) continue;
        const code = field.code.toLowerCase();
        const control = String(field.control || "").toUpperCase();
        if (control === "PROJECT_SELECT" || code === "projectid") next[field.code] = projectId;
        else if (control === "ACTOR_SELECT" || code.includes("actor")) next[field.code] = actorCode;
        else if (code === "tenantid") next[field.code] = tenantId;
        else if (code.includes("year")) next[field.code] = year;
        else if (code.includes("status")) next[field.code] = "CONFIRMED";
        else if (code.includes("scope")) next[field.code] = "SCOPE_1";
      }
      return next;
    });
  }, [actorCode, contractFields, projectId, tenantId]);
  const missingRequiredFields = contractFields.filter((field) => field.required === true && !String(values[field.code] || "").trim());
  const checks = useMemo(() => [
    { label: en ? "Required contract fields completed" : "\uB2E8\uACC4\uBCC4 \uD544\uC218 \uD56D\uBAA9 \uC785\uB825", passed: missingRequiredFields.length === 0 && contractFields.length > 0 },
    { label: en ? "Work result recorded" : "업무 처리 결과 입력", passed: Boolean(form.workSummary.trim()) },
    { label: en ? "Decision basis recorded" : "판단·계산 근거 입력", passed: Boolean(form.decisionBasis.trim()) },
    { label: en ? "Evidence reference recorded" : "증빙 참조 입력", passed: Boolean(evidence.documentId.trim() || evidence.sourceUrl.trim()) },
    { label: en ? "Current actor and step matched" : "현재 액터·단계 일치", passed: Boolean(execution.found && currentStep === stepCode && actorCode) },
  ], [actorCode, contractFields.length, currentStep, en, evidence.documentId, evidence.sourceUrl, execution.found, form.decisionBasis, form.workSummary, missingRequiredFields.length, stepCode]);
  const readyToComplete = checks.every(check => check.passed);

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
    const payloadRow = payload && typeof payload === "object" ? payload as Row : {};
    setForm({
      workSummary: String(payloadRow.workSummary || ""),
      decisionBasis: String(payloadRow.decisionBasis || ""),
      resultValue: String(payloadRow.resultValue || ""),
      resultUnit: String(payloadRow.resultUnit || ""),
      exceptionReason: String(payloadRow.exceptionReason || ""),
    });
    setValues(Object.fromEntries(Object.entries(payloadRow).map(([key,item]) => [key,item == null ? "" : String(item)])));
    const evidenceRow = evidencePayload && typeof evidencePayload === "object" ? evidencePayload as Row : {};
    setEvidence({ documentId: String(evidenceRow.documentId || ""), sourceUrl: String(evidenceRow.sourceUrl || ""), checksum: String(evidenceRow.checksum || "") });
  };

  const load = async (requestedProcess = processCode, requestedStep = stepCode) => {
    if (!tenantId.trim() || !projectId.trim() || !requestedProcess.trim() || !requestedStep.trim()) {
      setError(en ? "Enter tenant, project, process, and step." : "테넌트·프로젝트·프로세스·단계를 모두 입력하세요.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const base = buildLocalizedPath("/home/api/process-executions", "/en/home/api/process-executions");
      const requestedContext = new URLSearchParams({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode: requestedProcess, stepCode: requestedStep });
      const [draftBody, executionBody] = await Promise.all([
        requestJson(`${base}/draft?${requestedContext}`),
        requestJson(`${base}?${new URLSearchParams({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode: requestedProcess })}`),
      ]);
      applyDraft(draftBody as WorkDraft);
      setExecution(executionBody as Execution);
      setProcessCode(requestedProcess);
      if (executionBody.currentStepCode) setStepCode(String(executionBody.currentStepCode));
      setMessage(en ? "The latest work context was loaded." : "최신 업무 문맥과 임시저장을 불러왔습니다.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (tenantId) return;
    requestJson(buildLocalizedPath("/home/api/emission-projects/options", "/en/home/api/emission-projects/options"))
      .then((body) => setTenantId(String(body.tenantId || "")))
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && projectId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, projectId, processCode]);

  const persistDraft = async () => {
      const body = await requestJson(buildLocalizedPath("/home/api/process-executions/draft", "/en/home/api/process-executions/draft"), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenantId.trim(), projectId: projectId.trim(), processCode, stepCode, actorCode,
          expectedVersion: Number(draft.draftVersion || 0), payloadJson: JSON.stringify({ ...values, ...form }), evidenceJson: JSON.stringify(evidence) }),
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
          commandCode: value(contract, "commandCode"), idempotencyKey: crypto.randomUUID(), requireDraft: true, requestJson: JSON.stringify({ ...values, ...form, evidence }),
          resultJson: JSON.stringify({ completed: true, draftVersion: savedVersion }), snapshotRef: `manual:${projectId}:${processCode}:${stepCode}:${savedVersion}` }),
      });
      setHandoff(body);
      setMessage(body.executionStatus === "COMPLETED" ? (en ? "The process is complete." : "전체 프로세스가 완료되었습니다.") : (en ? "Step complete. The next actor can continue." : "단계를 완료했습니다. 다음 액터가 업무를 이어갈 수 있습니다."));
      const nextProcessCode = value(body, "nextProcessCode");
      const targetProcessCode = nextProcessCode || processCode;
      const targetStepCode = value(body, nextProcessCode ? "nextProcessStepCode" : "nextStepCode");
      if (shellMode && targetStepCode) {
        const nextActorCode = value(body, nextProcessCode ? "nextProcessActorCode" : "nextActorCode");
        const nextSourcePath = value(body, nextProcessCode ? "nextProcessUserPath" : "nextUserPath");
        if (nextActorCode && nextActorCode !== actorCode) {
          setMessage(en ? `Step complete. Sign in as the assigned ${actorName(nextActorCode, true)}, then continue from the handoff card.` : `단계를 완료했습니다. 다음 담당자(${actorName(nextActorCode, false)}) 계정으로 전환한 뒤 인계 카드에서 계속 진행하세요.`);
          setBusy(false);
          return;
        }
        const nextUrl = new URL(location.href);
        nextUrl.searchParams.set("processCode", targetProcessCode);
        nextUrl.searchParams.set("stepCode", targetStepCode);
        if (nextActorCode) nextUrl.searchParams.set("actorCode", nextActorCode);
        if (nextSourcePath) nextUrl.searchParams.set("screenPath", nextSourcePath);
        replace(`${nextUrl.pathname}${nextUrl.search}`);
        await load(targetProcessCode, targetStepCode);
        setMessage(en ? "Step complete. The next step is ready in this workspace." : "단계를 완료했습니다. 같은 작업공간에 다음 절차를 불러왔습니다.");
        return;
      }
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
  };

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-8">
    <nav aria-label={en ? "Breadcrumb" : "현재 위치"} className="gov-text-body-sm text-slate-500"><a className="hover:underline" href={buildLocalizedPath("/home", "/en/home")}>{en ? "Home" : "홈"}</a><span className="px-2">/</span><a className="hover:underline" href={buildLocalizedPath("/emission/my-tasks", "/en/emission/my-tasks")}>{en ? "My tasks" : "내 업무"}</a><span className="px-2">/</span><strong>{en ? "Work execution" : "업무 실행"}</strong></nav>
    <header className="mt-4 rounded-2xl bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white shadow-sm lg:p-8">
      <p className="gov-text-label font-black text-blue-100">ACTOR · PROCESS · TEST · TASK</p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="gov-text-heading-lg font-black">{shellMode ? (en ? "Home Work Workspace" : "홈 업무 작업공간") : (en ? "Professional Work Execution" : "전문 업무 실행")}</h1><p className="gov-text-body mt-2 max-w-3xl text-blue-50">{shellMode ? (en ? "Select a workflow step, complete its contract, and continue to the next assigned actor without leaving the SPA." : "전체 업무 보기에서 선택한 절차를 처리하고 SPA를 벗어나지 않은 채 다음 담당자에게 인계합니다.") : (en ? "Record inputs, evidence, validation, and completion in one actor-scoped workspace." : "액터에게 배정된 실제 업무의 입력·증빙·검증·완료와 다음 단계 인계를 하나의 작업공간에서 처리합니다.")}</p></div><div className="flex flex-wrap gap-2">{shellMode && sourcePath ? <a className="krds-control inline-flex items-center justify-center rounded-lg border border-white/60 bg-white/10 px-4 font-bold text-white" href={sourcePath}>{en ? "Open specialized screen" : "전문 화면 열기"}</a> : null}<a className="krds-control inline-flex items-center justify-center rounded-lg border border-white/60 bg-white/10 px-4 font-bold text-white" href={buildLocalizedPath(shellMode ? "/home" : "/emission/my-tasks", shellMode ? "/en/home" : "/en/emission/my-tasks")}>{shellMode ? (en ? "Back to home" : "홈으로 돌아가기") : (en ? "Back to my tasks" : "내 업무로 돌아가기")}</a></div></div>
    </header>

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" data-business-context>
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="gov-text-label font-black text-[#246beb]">{en ? "Current assigned work" : "현재 배정 업무"}</p><p className="gov-text-heading-sm mt-1 font-black text-[#052b57]">{processName(processCode, en)}</p><p className="gov-text-body-sm mt-1 text-slate-600">{value(contract, "stepName") || (en ? "Loading the work step" : "업무 절차를 불러오는 중입니다")}</p></div><button className="krds-control rounded-lg bg-[#246beb] px-5 font-black text-white disabled:opacity-50" disabled={busy} onClick={() => void load()}>{en ? "Refresh work" : "현재 업무 새로고침"}</button></div>
      <details className="mt-4 border-t border-slate-200 pt-4" data-technical-context><summary className="cursor-pointer font-bold text-[#246beb]">{en ? "Change technical work context" : "업무 문맥 직접 변경"}</summary><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label={en ? "Tenant ID" : "테넌트 ID"}><input className={inputClass} value={tenantId} onChange={event => setTenantId(event.target.value)} /></Field>
        <Field label={en ? "Project ID" : "프로젝트 ID"}><input className={inputClass} value={projectId} onChange={event => setProjectId(event.target.value)} /></Field>
        <Field label={en ? "Process code" : "프로세스 코드"}><input className={inputClass} value={processCode} onChange={event => setProcessCode(event.target.value)} /></Field>
        <Field label={en ? "Step code" : "단계 코드"}><input className={inputClass} value={stepCode} onChange={event => setStepCode(event.target.value)} /></Field>
      </div></details>
    </section>

    {(message || error) && <p aria-live="polite" className={`mt-5 rounded-xl border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</p>}

    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_22rem]">
      <div className="space-y-6">
        <section className="krds-component rounded-2xl border bg-white"><div className="flex flex-wrap items-start justify-between gap-3 border-b p-5"><div><p className="gov-text-label font-black text-[#246beb]">{processName(processCode, en)}</p><h2 className="gov-text-heading-md mt-2 font-black text-[#052b57]">{value(contract, "stepName") || (en ? "Load the assigned work" : "배정된 업무를 불러오세요")}</h2><BusinessDescription en={en} text={value(contract, "requirementText")} /><details className="mt-3 text-xs text-slate-500" data-technical-identity><summary className="cursor-pointer font-bold text-[#246beb]">{en ? "View work identifier" : "업무 식별 코드 보기"}</summary><p className="mt-2 break-all font-mono">{processCode} · {stepCode}</p></details></div><div className="text-right"><Status>{stateName(value(execution, "executionStatus") || "NOT_STARTED", en)}</Status><p className="gov-text-label mt-2 text-slate-500">{en ? "Draft version" : "임시저장 버전"} {value(draft, "draftVersion") || "0"}</p></div></div>
          <div className="grid gap-4 p-5 md:grid-cols-2"><Contract en={en} kind="ENTRY" label={en ? "What you need before starting" : "업무 시작 전 확인사항"} text={value(contract, "inputContract")} /><Contract en={en} kind="RULE" label={en ? "Completion rule" : "완료 판정 기준"} text={businessText(value(contract, "completionRule"), en)} rawText={value(contract, "completionRule")} /><Contract en={en} kind="OUTPUT" label={en ? "What to hand off after completion" : "완료 후 인계사항"} text={value(contract, "outputContract")} /><Contract en={en} kind="ACTOR" label={en ? "Responsible actor" : "담당 액터"} text={actorName(actorCode, en)} rawText={actorCode} /></div>
        </section>

        <section className="krds-component rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="gov-text-heading-md font-black text-[#052b57]">{en ? "Step-specific required data" : "\uB2E8\uACC4\uBCC4 \uC804\uBB38 \uC5C5\uBB34 \uD56D\uBAA9"}</h2><p className="gov-text-body-sm mt-2 text-slate-600">{en ? "These fields come from the approved screen and data contract." : "\uC2B9\uC778\uB41C \uD654\uBA74\u00B7\uB370\uC774\uD130 \uACC4\uC57D\uC5D0\uC11C \uD604\uC7AC \uB2E8\uACC4\uC758 \uD56D\uBAA9\uC744 \uBD88\uB7EC\uC635\uB2C8\uB2E4."}</p></div><strong className={`rounded-full px-3 py-2 text-sm ${missingRequiredFields.length ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{missingRequiredFields.length ? (en ? `${missingRequiredFields.length} required` : `\uD544\uC218 ${missingRequiredFields.length}\uAC1C \uBBF8\uC785\uB825`) : (en ? "Required fields complete" : "\uD544\uC218 \uD56D\uBAA9 \uC644\uB8CC")}</strong></div>
          {contractFields.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{contractFields.map((field) => <ContractFieldControl field={field} key={field.code} value={values[field.code] || ""} onChange={(next) => setValues((current) => ({ ...current, [field.code]: next }))} />)}</div> : <p className="mt-4 rounded-xl bg-amber-50 p-4 font-bold text-amber-900">{en ? "No approved field contract is connected." : "\uC2B9\uC778\uB41C \uD544\uB4DC \uACC4\uC57D\uC774 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."}</p>}
        </section>

        <section className="krds-component rounded-2xl border bg-white p-5"><h2 className="gov-text-heading-md font-black text-[#052b57]">{en ? "Work result" : "업무 처리 결과"}</h2><p className="gov-text-body-sm mt-2 text-slate-600">{en ? "All decisions must remain reproducible from the recorded basis and evidence." : "모든 판단은 입력한 근거와 증빙으로 재현할 수 있어야 합니다."}</p><div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label={en ? "Work summary *" : "처리 결과 요약 *"}><textarea className={`${inputClass} min-h-32 py-3`} value={form.workSummary} onChange={event => setForm({ ...form, workSummary: event.target.value })} /></Field>
          <Field label={en ? "Decision or calculation basis *" : "판단·계산 근거 *"}><textarea className={`${inputClass} min-h-32 py-3`} value={form.decisionBasis} onChange={event => setForm({ ...form, decisionBasis: event.target.value })} /></Field>
          <Field label={en ? "Result value" : "결과값"}><input className={inputClass} inputMode="decimal" value={form.resultValue} onChange={event => setForm({ ...form, resultValue: event.target.value })} /></Field>
          <Field label={en ? "Result unit" : "결과 단위"}><input className={inputClass} value={form.resultUnit} onChange={event => setForm({ ...form, resultUnit: event.target.value })} /></Field>
          <div className="md:col-span-2"><Field label={en ? "Exception and follow-up" : "예외·보완 사항"}><textarea className={`${inputClass} min-h-24 py-3`} value={form.exceptionReason} onChange={event => setForm({ ...form, exceptionReason: event.target.value })} /></Field></div>
        </div></section>

        <section className="krds-component rounded-2xl border bg-white p-5"><h2 className="gov-text-heading-md font-black text-[#052b57]">{en ? "Evidence and lineage" : "증빙·출처 이력"}</h2><div className="mt-5 grid gap-4 md:grid-cols-3"><Field label={en ? "Document ID *" : "문서·증빙 ID *"}><input className={inputClass} value={evidence.documentId} onChange={event => setEvidence({ ...evidence, documentId: event.target.value })} /></Field><Field label={en ? "Source URL or repository" : "출처 URL·저장소"}><input className={inputClass} value={evidence.sourceUrl} onChange={event => setEvidence({ ...evidence, sourceUrl: event.target.value })} /></Field><Field label={en ? "Checksum" : "무결성 체크섬"}><input className={inputClass} value={evidence.checksum} onChange={event => setEvidence({ ...evidence, checksum: event.target.value })} /></Field></div></section>

        <section className="krds-component rounded-2xl border bg-white p-5"><h2 className="gov-text-heading-md font-black text-[#052b57]">{en ? "Execution audit trail" : "실행·감사 이력"}</h2>{(execution.events || []).length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b bg-slate-50"><th className="p-3">{en ? "Step" : "단계"}</th><th className="p-3">{en ? "Actor" : "담당자"}</th><th className="p-3">{en ? "Action" : "처리"}</th><th className="p-3">{en ? "Status change" : "진행 상태"}</th><th className="p-3">{en ? "Time" : "처리 시각"}</th></tr></thead><tbody>{(execution.events || []).map(row => <tr className="border-b" key={value(row, "eventId")}><td className="p-3 font-bold">{stepAuditName(value(row, "stepCode"), en)}</td><td className="p-3">{actorName(value(row, "actorCode"), en)}</td><td className="p-3">{commandName(value(row, "commandCode"), en)}</td><td className="p-3">{stateName(value(row, "fromState"), en)} → {stateName(value(row, "toState"), en)}</td><td className="p-3">{value(row, "executedAt")}</td></tr>)}</tbody></table><details className="mt-3 text-xs text-slate-500" data-audit-technical><summary className="cursor-pointer font-bold text-[#246beb]">{en ? "View audit codes" : "감사 코드 보기"}</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-slate-100">{JSON.stringify(execution.events || [], null, 2)}</pre></details></div> : <p className="mt-4 rounded-xl bg-slate-50 p-5 text-slate-600">{en ? "No execution events yet." : "아직 실행 이력이 없습니다."}</p>}</section>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <section className="krds-component rounded-2xl border bg-white p-5"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Completion checks" : "완료 점검"}</h2><ul className="mt-4 space-y-3">{checks.map(check => <li className="flex items-start gap-3" key={check.label}><span aria-hidden="true" className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${check.passed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{check.passed ? "✓" : "–"}</span><span className="gov-text-body-sm text-slate-700">{check.label}</span></li>)}</ul></section>
        <section className="krds-component rounded-2xl border bg-white p-5"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Work actions" : "업무 실행"}</h2><div className="mt-4 grid gap-3"><button className="krds-control rounded-lg border border-[#246beb] bg-white font-black text-[#246beb] disabled:opacity-50" disabled={busy || !actorCode} onClick={() => void saveDraft()}>{en ? "Save draft" : "임시저장"}</button>{!execution.found && <button className="krds-control rounded-lg bg-[#052b57] font-black text-white disabled:opacity-50" disabled={busy || !actorCode} onClick={() => void startExecution()}>{en ? "Start process" : "프로세스 시작"}</button>}<button className="krds-control rounded-lg bg-[#246beb] font-black text-white disabled:opacity-50" disabled={busy || !readyToComplete} onClick={() => void complete()}>{en ? "Validate and complete" : "검증 후 단계 완료"}</button></div><p className="gov-text-body-sm mt-4 text-slate-500">{en ? "Completion is idempotent and server-authoritative." : "완료 명령은 멱등키와 서버 상태 전이 규칙으로 중복 처리를 방지합니다."}</p></section>
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Next handoff" : "다음 업무 인계"}</h2><p className="gov-text-body-sm mt-3 text-slate-700">{en ? "After completion, the server confirms the next work and responsible actor." : "현재 업무를 완료하면 서버가 다음 업무와 담당 액터를 확정합니다."}</p>{value(handoff, "nextProcessCode") && <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4"><p className="gov-text-label font-black text-blue-800">{en ? "Next process ready" : "다음 프로세스 준비 완료"}</p><p className="gov-text-body-sm mt-2 font-bold text-slate-800">{processName(value(handoff, "nextProcessCode"), en)}</p><p className="gov-text-body-sm mt-1 text-slate-700">{en ? "Responsible actor" : "담당자"}: {actorName(value(handoff, "nextProcessActorCode"), en)}</p><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer font-bold text-[#246beb]">{en ? "View handoff code" : "인계 코드 보기"}</summary><p className="mt-1 break-all font-mono">{value(handoff, "nextProcessCode")} · {value(handoff, "nextProcessStepCode")} · {value(handoff, "nextProcessActorCode")}</p></details><a className="krds-control mt-3 inline-flex w-full items-center justify-center rounded-lg bg-[#246beb] px-3 font-black text-white" href={`${buildLocalizedPath("/work/execution", "/en/work/execution")}?projectId=${encodeURIComponent(projectId)}&processCode=${encodeURIComponent(value(handoff, "nextProcessCode"))}&stepCode=${encodeURIComponent(value(handoff, "nextProcessStepCode"))}&actorCode=${encodeURIComponent(value(handoff, "nextProcessActorCode"))}&guide=1${shellMode ? `&shell=1&screenPath=${encodeURIComponent(value(handoff, "nextProcessUserPath"))}` : ""}`}>{en ? "Continue next process" : "다음 프로세스 이어서 진행"}</a></div>}</section>
      </aside>
    </section>
  </main>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="gov-text-label mb-2 block font-bold text-slate-700">{label}</span>{children}</label>; }
function BusinessDescription({ text, en }: { text: string; en: boolean }) {
  const readable = businessText(text, en);
  const changed = readable !== text;
  return <div data-business-description><p className="gov-text-body-sm mt-2 text-slate-600">{readable}</p>{changed ? <details className="mt-2 text-xs text-slate-500" data-description-raw><summary className="cursor-pointer font-bold text-[#246beb]">{en ? "View technical description" : "기술 설명 원문 보기"}</summary><p className="mt-2 rounded-lg bg-slate-900 p-3 text-slate-100">{text}</p></details> : null}</div>;
}
type ContractKind = "ENTRY" | "RULE" | "OUTPUT" | "ACTOR";
const contractKeyLabels: Record<string, [string, string]> = {
  processCode: ["프로세스", "Process"], stepCode: ["업무 단계", "Work step"], fromState: ["시작 상태", "Starting status"],
  actorCode: ["담당 액터", "Responsible actor"], tenantId: ["회사·테넌트", "Company or tenant"], projectId: ["프로젝트", "Project"],
  reportId: ["보고서", "Report"], status: ["상태", "Status"], site: ["사업장", "Site"], keyword: ["검색어", "Keyword"],
  page: ["페이지", "Page"], required: ["필수 산출물", "Required deliverables"], optional: ["선택 항목", "Optional items"],
  actorId: ["사용자 액터", "User actor"], items: ["업무 목록", "Work items"], total: ["검색 결과 수", "Result count"],
  summary: ["상태별 현황", "Status summary"], sites: ["사업장 선택 목록", "Site options"], nextRoute: ["다음 처리 화면", "Next screen"],
  toState: ["완료 상태", "Completion status"], completionRule: ["완료 기준", "Completion rule"],
  evidenceRequired: ["증빙 필요 여부", "Evidence required"], autoFilled: ["자동 입력 항목", "Auto-filled fields"],
  forbidden: ["사용 금지 자료", "Forbidden inputs"], handoff: ["다음 인계 업무", "Next handoff"],
  allowedApproaches: ["허용 경계 기준", "Allowed boundary approaches"], authorityCode: ["제출 기관", "Authority"],
  clientRequestId: ["제출 요청 번호", "Submission request ID"], reportingProgram: ["적용 보고 제도", "Reporting program"],
  submissionDeadline: ["제출 기한", "Submission deadline"], timeline: ["처리 이력", "Timeline"],
  nextActions: ["후속 조치", "Next actions"], packageHash: ["제출 묶음 지문", "Submission package fingerprint"],
};
const contractValueLabels: Record<string, [string, string]> = {
  required: ["필수", "Required"], optional: ["선택", "Optional"], session: ["로그인 정보에서 자동 확인", "Read from signed-in session"],
  "actor scoped": ["배정된 액터 권한 범위", "Assigned actor scope"], "filtered count": ["검색 조건에 맞는 건수", "Count matching filters"],
  "actor scoped status counts": ["액터 권한 범위의 상태별 건수", "Status counts in actor scope"],
  "actor scoped options": ["액터가 조회할 수 있는 사업장", "Sites available to the actor"],
  "selected project detail": ["선택한 프로젝트의 상세 화면", "Selected project detail screen"],
  acceptedsubmissionsnapshotid: ["승인된 활동자료 버전", "Accepted activity-data version"], calculationmethodversion: ["산정 방법론 버전", "Calculation method version"],
  factorversion: ["배출계수 버전", "Emission-factor version"], unitconversionversion: ["단위 환산 기준 버전", "Unit-conversion version"],
  calculatorassignment: ["산정 담당자 배정", "Calculator assignment"], mutableunacceptedrows: ["미승인 변경 자료", "Mutable unaccepted rows"],
  unversionedfactor: ["버전 없는 배출계수", "Unversioned factor"], calculationplanid: ["산정 계획 번호", "Calculation plan ID"],
  scopepolicy: ["배출 범위 기준", "Scope policy"], materialitythreshold: ["중요성 기준", "Materiality threshold"],
  recalculationpolicy: ["재산정 기준", "Recalculation policy"], planapprovalevidence: ["계획 승인 증빙", "Plan approval evidence"],
  calculatoraccountid: ["산정 담당자 계정", "Calculator account"], calculationversionid: ["산정 결과 버전", "Calculation result version"],
  lineresults: ["항목별 산정 결과", "Line calculation results"], scopetotals: ["배출 범위별 합계", "Scope totals"],
  grandtotal: ["총 배출량", "Grand total"], factordecisionaudit: ["배출계수 선택 근거", "Factor decision audit"],
  inputfingerprint: ["입력자료 지문", "Input fingerprint"], verificationrunid: ["검증 실행 번호", "Verification run ID"],
  ruleresults: ["검증 규칙 결과", "Rule results"], exceptions: ["예외 항목", "Exceptions"], reconciliationresult: ["합계 대조 결과", "Reconciliation result"],
  verifieropinion: ["독립 검증 의견", "Verifier opinion"], openexceptions: ["미해결 예외", "Open exceptions"],
  approvedcalculationversionid: ["승인 산정 버전", "Approved calculation version"], approvaldecision: ["승인 결정", "Approval decision"],
  approvalcomment: ["승인 의견", "Approval comment"], lockedat: ["잠금 시각", "Locked at"], resultsnapshothash: ["결과자료 지문", "Result snapshot fingerprint"],
  reportingentityid: ["보고 법인", "Reporting entity"], reportingperiod: ["보고 기간", "Reporting period"], legalentities: ["법인 목록", "Legal entities"],
  ownershippercent: ["지분율", "Ownership percentage"], effectivefrom: ["적용 시작일", "Effective from"], effectiveuntil: ["적용 종료일", "Effective until"],
  sourceevidenceids: ["원천 증빙", "Source evidence"], idempotencykey: ["중복 처리 방지 키", "Idempotency key"],
  organizationinventoryversion: ["조직 원장 버전", "Organization inventory version"], entitycount: ["법인 수", "Entity count"], sitecount: ["사업장 수", "Site count"],
  ownershipevidencestatus: ["소유구조 증빙 상태", "Ownership evidence status"], inventorysnapshothash: ["조직 원장 지문", "Inventory snapshot fingerprint"],
  consolidationapproach: ["연결 기준", "Consolidation approach"], controlassessments: ["통제력 평가", "Control assessments"], inclusiondecisions: ["포함 결정", "Inclusion decisions"],
  exclusionreasons: ["제외 사유", "Exclusion reasons"], materialitypolicy: ["중요성 정책", "Materiality policy"],
  operational_control: ["운영통제 기준", "Operational control"], financial_control: ["재무통제 기준", "Financial control"], equity_share: ["지분비율 기준", "Equity share"],
  boundarydecisionversion: ["조직 경계 결정 버전", "Boundary decision version"], includedentityids: ["포함 법인", "Included entities"], excludedentityids: ["제외 법인", "Excluded entities"],
  decisionevidenceids: ["결정 증빙", "Decision evidence"], decisionsnapshothash: ["결정자료 지문", "Decision snapshot fingerprint"],
  internaltransactions: ["내부거래 내역", "Internal transactions"], eliminationrules: ["내부거래 제거 규칙", "Elimination rules"], basecurrency: ["기준 통화", "Base currency"],
  conversionrates: ["환산율", "Conversion rates"], consolidationperiod: ["연결 산정 기간", "Consolidation period"], consolidationrunid: ["연결 산정 실행 번호", "Consolidation run ID"],
  eliminationentries: ["제거 분개", "Elimination entries"], reconciliationdifference: ["대조 차이", "Reconciliation difference"], consolidatedentityids: ["연결 대상 법인", "Consolidated entities"],
  calculationevidenceids: ["산정 증빙", "Calculation evidence"], boundaryversion: ["조직 경계 버전", "Boundary version"], boundaryevidence: ["조직 경계 증빙", "Boundary evidence"],
  calculationhash: ["산정자료 지문", "Calculation fingerprint"], boundaryverificationresult: ["조직 경계 검증 결과", "Boundary verification result"], boundaryfindings: ["조직 경계 검증 의견", "Boundary findings"],
  reviewchecklist: ["검토 점검표", "Review checklist"], openissues: ["미해결 쟁점", "Open issues"], approvedboundaryversion: ["승인 조직 경계 버전", "Approved boundary version"],
  boundarysnapshothash: ["조직 경계 지문", "Boundary snapshot fingerprint"], process_complete: ["프로세스 완료", "Process complete"],
  "activity ledger": ["활동자료 원장", "Activity-data ledger"], "source evidence files": ["원천 증빙 파일", "Source evidence files"],
  "sha-256 checksum": ["파일 지문", "SHA-256 checksum"], "quality result": ["품질 검증 결과", "Quality result"],
  "immutable submission snapshot": ["잠금 제출 버전", "Immutable submission snapshot"],
};
function readableToken(raw: unknown, en: boolean) {
  const text = String(raw ?? "").trim();
  const known = contractValueLabels[text.toLowerCase()];
  if (known) return known[en ? 1 : 0];
  return text.split("_").join(" ");
}
function parseReadableContract(text: string): Row | unknown[] | null {
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Row | unknown[] : null;
  } catch { return null; }
}
function Contract({ label, text, en, kind, rawText }: { label: string; text: string; en: boolean; kind: ContractKind; rawText?: string }) {
  const parsed = parseReadableContract(text);
  const entries = parsed && !Array.isArray(parsed) ? Object.entries(parsed) : [];
  const items = Array.isArray(parsed) ? parsed : [];
  const hasStructuredContent = entries.length > 0 || items.length > 0;
  return <article className="rounded-xl bg-slate-50 p-4">
    <h3 className="gov-text-label font-black text-slate-700">{label}</h3>
    <div className="gov-text-body-sm mt-3 break-words text-slate-700" data-contract-summary={kind}>
      {entries.length ? <dl className="space-y-2">{entries.map(([key, raw]) => {
        const name = contractKeyLabels[key]?.[en ? 1 : 0] || readableToken(key, en);
        const values = Array.isArray(raw) ? raw : [raw];
        return <div className="grid gap-1 sm:grid-cols-[9rem_1fr]" key={key}><dt className="font-bold text-slate-600">{name}</dt><dd>{values.map(item => readableToken(item, en)).filter(Boolean).join(" · ") || "-"}</dd></div>;
      })}</dl> : items.length ? <ul className="list-disc space-y-1 pl-5">{items.map((item, index) => <li key={index}>{readableToken(item, en)}</li>)}</ul> : <p>{text || "-"}</p>}
    </div>
    {hasStructuredContent || (rawText && rawText !== text) ? <details className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500" data-contract-raw={kind}><summary className="cursor-pointer font-bold text-[#246beb]">{en ? "View technical contract" : "기술 계약 원문 보기"}</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 text-slate-100">{rawText || text}</pre></details> : null}
  </article>;
}
function Status({ children }: { children: ReactNode }) { return <span className="inline-flex rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">{children}</span>; }
