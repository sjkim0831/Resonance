import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GovernanceCompressionNav } from "../admin-system/GovernanceCompressionNav";

type Row = Record<string, unknown>;
type Payload = { actors: Row[]; assignments: Row[]; processes: Row[]; steps: Row[]; cases: Row[]; runs: Row[]; summary?: Row };
const empty: Payload = { actors: [], assignments: [], processes: [], steps: [], cases: [], runs: [] };
const value = (row: Row, key: string) => String(row[key] ?? "");
const fieldClass = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#246beb] focus:outline-none focus:ring-2 focus:ring-blue-100";

export function ActorProcessGovernancePage() {
  const en = isEnglish();
  const base = buildLocalizedPath("/admin/api/system/actor-process", "/en/admin/api/system/actor-process");
  const [data, setData] = useState<Payload>(empty);
  const [tab, setTab] = useState("overview");
  const [processFilter, setProcessFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(base, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "조회에 실패했습니다.");
      setData(body);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "조회에 실패했습니다."); }
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${base}/${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "저장에 실패했습니다.");
      setMessage(path === "standard-pack" ? `표준 업무팩을 반영했습니다. 프로세스 ${result.processes ?? 0}개, 단계 ${result.steps ?? 0}개, 시나리오 ${result.cases ?? 0}개가 준비되었습니다.` : "저장되었습니다.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "저장에 실패했습니다."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>, path: string) {
    event.preventDefault();
    const form = event.currentTarget;
    await post(path, Object.fromEntries(new FormData(form).entries()));
    if (!error) form.reset();
  }

  const selectedSteps = useMemo(() => data.steps.filter(row => !processFilter || value(row, "processCode") === processFilter), [data.steps, processFilter]);
  const selectedCases = useMemo(() => data.cases.filter(row => !processFilter || value(row, "processCode") === processFilter), [data.cases, processFilter]);
  const readyCount = Number(data.summary?.readyCount ?? 0);
  const readiness = Number(data.summary?.readinessPercent ?? 0);
  const tabs = [["overview", "전체 현황"], ["actors", "액터"], ["assignments", "계정 배정"], ["processes", "프로세스"], ["steps", "단계"], ["simulation", "시나리오·실행"]];

  return <AdminPageShell breadcrumbs={[{ label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") }, { label: en ? "System" : "시스템 관리" }, { label: en ? "Actor & Process" : "액터·프로세스 관리" }]} title={en ? "Actor & Process Governance" : "액터·프로세스 관리"}>
    <GovernanceCompressionNav activeId="actor-process" en={en} />
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-sm font-bold text-blue-200">PROCESS CONTROL PLANE</p><h2 className="mt-1 text-2xl font-black">액터에서 테스트까지, 개발 전 업무 설계를 한곳에서 관리합니다.</h2><p className="mt-2 max-w-3xl text-sm text-blue-50">계정과 프로젝트별 역할, 상태 전이, 완료 조건, 예외·권한·격리·복구 시나리오가 승인되어야 개발 준비 상태가 됩니다.</p></div>
          <button disabled={busy} onClick={() => void post("standard-pack", {})} className="h-12 rounded-xl bg-white px-5 font-black text-[#174ea6] shadow disabled:opacity-50">{busy ? "반영 중..." : "표준 업무팩 일괄 등록"}</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["액터", data.actors.length], ["계정 배정", data.assignments.length], ["프로세스", data.processes.length], ["시나리오", data.cases.length], ["개발 준비", `${readyCount}/${data.processes.length}`]].map(([label, number]) => <div key={String(label)} className="rounded-xl bg-white/10 p-4"><span className="text-sm text-blue-100">{label}</span><strong className="mt-1 block text-2xl">{number}</strong></div>)}</div>
      </section>
      {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{message}</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
      <nav className="flex flex-wrap gap-2">{tabs.map(([id, name]) => <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-4 py-3 text-sm font-bold ${tab === id ? "bg-[#246beb] text-white" : "border bg-white text-slate-700 hover:bg-slate-50"}`}>{name}</button>)}</nav>

      {tab === "overview" && <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Panel title="개발 준비도" description="단계가 존재하고 모든 필수 시나리오가 승인된 프로세스 비율입니다."><div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#246beb]" style={{ width: `${Math.min(readiness, 100)}%` }} /></div><div className="mt-2 flex justify-between text-sm"><b>{readiness}% 완료</b><span className="text-slate-500">준비 {readyCount} · 보완 {Math.max(data.processes.length - readyCount, 0)}</span></div></Panel>
        <Panel title="권장 등록 순서" description="순서를 지키면 권한과 테스트 참조 오류를 줄일 수 있습니다."><ol className="mt-3 grid gap-2 text-sm text-slate-700"><li>1. 액터와 기능 권한 정의</li><li>2. 실제 계정을 테넌트·프로젝트·액터에 배정</li><li>3. 프로세스 목표와 시작·완료 조건 정의</li><li>4. 액터별 상태 전이 단계 연결</li><li>5. 정상·예외·권한·격리·복구 시나리오 실행</li></ol></Panel>
        <div className="xl:col-span-2"><Table heads={["프로세스", "도메인", "버전", "상태", "단계", "시나리오", "통과 실행"]} rows={data.processes.map(row => [value(row, "processName"), value(row, "domainCode"), value(row, "version"), value(row, "status"), value(row, "stepCount"), value(row, "caseCount"), value(row, "passedRuns")])} /></div>
      </div>}

      {tab === "actors" && <><Form onSubmit={event => void submit(event, "actors")} cols="lg:grid-cols-6"><Field label="액터 코드"><input className={fieldClass} name="actorCode" required /></Field><Field label="액터명"><input className={fieldClass} name="actorName" required /></Field><Field label="유형"><select className={fieldClass} name="actorType"><option>BUSINESS</option><option>REVIEW</option><option>APPROVAL</option><option>OPERATION</option><option>AUTOMATION</option><option>AUDIT</option></select></Field><Field label="기능 권한"><input className={fieldClass} name="capabilityCodes" placeholder="VIEW,EDIT,SUBMIT" /></Field><div className="lg:col-span-2"><Field label="목적"><input className={fieldClass} name="purpose" required /></Field></div><SaveButton busy={busy} /></Form><Table heads={["코드", "액터명", "유형", "목적", "기능 권한"]} rows={data.actors.map(row => [value(row, "actorCode"), value(row, "actorName"), value(row, "actorType"), value(row, "purpose"), value(row, "capabilityCodes")])} /></>}

      {tab === "assignments" && <><Form onSubmit={event => void submit(event, "assignments")} cols="lg:grid-cols-6"><Field label="계정 ID"><input className={fieldClass} name="accountId" required /></Field><Field label="테넌트"><input className={fieldClass} name="tenantId" defaultValue="DEFAULT" required /></Field><Field label="프로젝트"><input className={fieldClass} name="projectId" defaultValue="*" required /></Field><Field label="데이터 범위"><input className={fieldClass} name="dataScope" defaultValue="*" required /></Field><Field label="액터"><select className={fieldClass} name="actorCode" required>{data.actors.map(row => <option key={value(row, "actorCode")} value={value(row, "actorCode")}>{value(row, "actorName")} ({value(row, "actorCode")})</option>)}</select></Field><SaveButton busy={busy} label="배정" /></Form><Table heads={["계정", "테넌트", "프로젝트", "액터", "데이터 범위", "상태"]} rows={data.assignments.map(row => [value(row, "accountId"), value(row, "tenantId"), value(row, "projectId"), value(row, "actorCode"), value(row, "dataScope"), value(row, "status")])} /></>}

      {tab === "processes" && <><Form onSubmit={event => void submit(event, "processes")} cols="lg:grid-cols-4">{[["프로세스 코드", "processCode"], ["프로세스명", "processName"], ["도메인", "domainCode"], ["버전", "version"], ["목표", "goal"], ["시작 조건", "startCondition"], ["완료 조건", "completionCondition"]].map(([label, name]) => <Field key={name} label={label}><input className={fieldClass} name={name} defaultValue={name === "version" ? "1.0.0" : ""} required /></Field>)}<SaveButton busy={busy} /></Form><Table heads={["코드", "프로세스명", "도메인", "버전", "상태", "단계", "시나리오"]} rows={data.processes.map(row => [value(row, "processCode"), value(row, "processName"), value(row, "domainCode"), value(row, "version"), value(row, "status"), value(row, "stepCount"), value(row, "caseCount")])} /></>}

      {tab === "steps" && <><ProcessFilter processes={data.processes} value={processFilter} onChange={setProcessFilter} /><Form onSubmit={event => void submit(event, "steps")} cols="lg:grid-cols-4"><Field label="프로세스"><select className={fieldClass} name="processCode" required>{data.processes.map(row => <option key={value(row, "processCode")}>{value(row, "processCode")}</option>)}</select></Field><Field label="순서"><input className={fieldClass} type="number" min="1" name="stepOrder" required /></Field><Field label="단계 코드"><input className={fieldClass} name="stepCode" required /></Field><Field label="단계명"><input className={fieldClass} name="stepName" required /></Field><Field label="수행 액터"><select className={fieldClass} name="actorCode" required>{data.actors.map(row => <option key={value(row, "actorCode")} value={value(row, "actorCode")}>{value(row, "actorName")}</option>)}</select></Field><Field label="이전 상태"><input className={fieldClass} name="fromState" required /></Field><Field label="명령"><input className={fieldClass} name="commandCode" required /></Field><Field label="다음 상태"><input className={fieldClass} name="toState" required /></Field><div className="lg:col-span-2"><Field label="완료 규칙"><input className={fieldClass} name="completionRule" required /></Field></div><Field label="사용자 화면 경로"><input className={fieldClass} name="userPath" /></Field><Field label="관리자 화면 경로"><input className={fieldClass} name="adminPath" /></Field><SaveButton busy={busy} /></Form><Table heads={["프로세스", "순서", "단계", "액터", "상태 전이", "완료 규칙"]} rows={selectedSteps.map(row => [value(row, "processCode"), value(row, "stepOrder"), value(row, "stepName"), value(row, "actorCode"), `${value(row, "fromState")} → ${value(row, "toState")}`, value(row, "completionRule")])} /></>}

      {tab === "simulation" && <><ProcessFilter processes={data.processes} value={processFilter} onChange={setProcessFilter} /><div className="grid gap-4 xl:grid-cols-2"><Form onSubmit={event => void submit(event, "cases")} cols="sm:grid-cols-2"><Field label="시나리오 코드"><input className={fieldClass} name="caseCode" required /></Field><Field label="프로세스"><select className={fieldClass} name="processCode">{data.processes.map(row => <option key={value(row, "processCode")}>{value(row, "processCode")}</option>)}</select></Field><Field label="시나리오명"><input className={fieldClass} name="caseName" required /></Field><Field label="유형"><select className={fieldClass} name="caseType"><option>HAPPY_PATH</option><option>EXCEPTION</option><option>AUTHORITY</option><option>ISOLATION</option><option>RECOVERY</option></select></Field><Field label="사전 조건"><textarea className={`${fieldClass} h-24 py-2`} name="preconditions" required /></Field><Field label="실행 단계 JSON"><textarea className={`${fieldClass} h-24 py-2`} name="stepsJson" defaultValue="[]" required /></Field><div className="sm:col-span-2"><Field label="검증 조건 JSON"><textarea className={`${fieldClass} h-20 py-2`} name="assertionsJson" defaultValue="[]" required /></Field></div><SaveButton busy={busy} label="시나리오 저장" /></Form><Form onSubmit={event => void submit(event, "runs")} cols="sm:grid-cols-2"><Field label="시나리오"><select className={fieldClass} name="caseCode">{data.cases.map(row => <option key={value(row, "caseCode")}>{value(row, "caseCode")}</option>)}</select></Field><Field label="결과"><select className={fieldClass} name="result"><option>PASSED</option><option>FAILED</option><option>BLOCKED</option></select></Field><Field label="실패 사유"><textarea className={`${fieldClass} h-24 py-2`} name="failureReason" /></Field><Field label="증적 JSON"><textarea className={`${fieldClass} h-24 py-2`} name="evidenceJson" defaultValue="{}" /></Field><SaveButton busy={busy} label="실행 결과 기록" /></Form></div><Table heads={["시나리오", "프로세스", "이름", "유형", "상태"]} rows={selectedCases.map(row => [value(row, "caseCode"), value(row, "processCode"), value(row, "caseName"), value(row, "caseType"), value(row, "status")])} /></>}
    </div>
  </AdminPageShell>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>{children}</label>; }
function Form({ onSubmit, cols, children }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; cols: string; children: ReactNode }) { return <form className={`grid gap-3 rounded-2xl border bg-white p-5 ${cols}`} onSubmit={onSubmit}>{children}</form>; }
function SaveButton({ busy, label = "저장" }: { busy: boolean; label?: string }) { return <button disabled={busy} className="h-11 self-end rounded-lg bg-[#246beb] px-4 font-bold text-white disabled:opacity-50" type="submit">{busy ? "처리 중..." : label}</button>; }
function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="rounded-2xl border bg-white p-5"><h3 className="text-lg font-black text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p>{children}</section>; }
function ProcessFilter({ processes, value: selected, onChange }: { processes: Row[]; value: string; onChange: (value: string) => void }) { return <div className="flex items-center gap-3 rounded-xl border bg-white p-4"><b className="text-sm">프로세스 필터</b><select className={`${fieldClass} max-w-md`} value={selected} onChange={event => onChange(event.target.value)}><option value="">전체 프로세스</option>{processes.map(row => <option key={value(row, "processCode")} value={value(row, "processCode")}>{value(row, "processName")} ({value(row, "processCode")})</option>)}</select></div>; }
function Table({ heads, rows }: { heads: string[]; rows: string[][] }) { return <section className="overflow-hidden rounded-2xl border bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-100"><tr>{heads.map(head => <th key={head} className="px-4 py-3 font-bold text-slate-700">{head}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-t hover:bg-slate-50">{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[360px] px-4 py-3 text-slate-700">{cell || "-"}</td>)}</tr>) : <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={heads.length}>등록된 항목이 없습니다.</td></tr>}</tbody></table></div></section>; }
