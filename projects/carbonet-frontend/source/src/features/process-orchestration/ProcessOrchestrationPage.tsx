import { useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

type Row = Record<string, unknown>;
type Payload = { processes?: Row[]; steps?: Row[]; cases?: Row[]; developmentJobs?: Row[]; processDevelopmentProgress?: Row[]; designAssurance?: Row[] };
const text = (row: Row | undefined, key: string) => String(row?.[key] ?? "");
const metric = (row: Row | undefined, key: string) => Number(row?.[key] ?? 0);
const tone = (ok: boolean) => ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200";

export function ProcessOrchestrationPage() {
  const en = isEnglish();
  const processCode = new URLSearchParams(location.search).get("process") || "GOVERNANCE_CHANGE";
  const [data, setData] = useState<Payload>({});
  const [error, setError] = useState("");
  useEffect(() => {
    const url = buildLocalizedPath("/admin/api/system/actor-process", "/en/admin/api/system/actor-process");
    void fetch(url, { credentials: "include" }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "업무 데이터를 불러오지 못했습니다.");
      setData(body);
    }).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);
  const process = useMemo(() => (data.processes || []).find(row => text(row, "processCode") === processCode), [data.processes, processCode]);
  const steps = useMemo(() => (data.steps || []).filter(row => text(row, "processCode") === processCode).sort((a, b) => metric(a, "stepOrder") - metric(b, "stepOrder")), [data.steps, processCode]);
  const cases = useMemo(() => (data.cases || []).filter(row => text(row, "processCode") === processCode), [data.cases, processCode]);
  const jobs = useMemo(() => (data.developmentJobs || []).filter(row => text(row, "processCode") === processCode), [data.developmentJobs, processCode]);
  const progress = (data.processDevelopmentProgress || []).find(row => text(row, "processCode") === processCode);
  const assurance = (data.designAssurance || []).find(row => text(row, "processCode") === processCode);
  const completedJobs = jobs.filter(row => ["VERIFIED", "COMPLETED"].includes(text(row, "jobStatus"))).length;

  return <AdminPageShell breadcrumbs={[
    { label: en ? "Admin" : "관리자", href: buildLocalizedPath("/admin/", "/en/admin/") },
    { label: en ? "Workflow" : "업무 프로세스" },
    { label: text(process, "processName") || processCode },
  ]} title={en ? "Professional Process Workspace" : "전문 업무 프로세스 통합 작업공간"}>
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-bold text-blue-200">{text(process, "domainCode")} · {processCode}</p><h2 className="mt-2 text-3xl font-black">{text(process, "processName") || processCode}</h2><p className="mt-3 max-w-4xl text-sm leading-6 text-blue-50">{text(process, "goal") || "업무 목표와 완료 조건을 기준으로 단계·액터·증빙·검증을 통합 관리합니다."}</p></div><a className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-5 font-black text-[#174ea6]" href={buildLocalizedPath(`/admin/system/actor-process?process=${encodeURIComponent(processCode)}`, `/en/admin/system/actor-process?process=${encodeURIComponent(processCode)}`)}>설계·테스트 상세</a></div>
      </section>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[
        ["담당 액터", text(process, "ownerActorCode") || "미지정"], ["업무 단계", steps.length], ["테스트 시나리오", cases.length], ["개발 작업", `${completedJobs}/${jobs.length}`], ["설계 정확도", `${text(assurance, "designAccuracyScore") || 0}%`], ["업무 SLA", text(process, "slaHours") ? `${text(process, "slaHours")}시간` : "미지정"],
      ].map(([label, value]) => <article className="rounded-xl border bg-white p-4" key={String(label)}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-2 block break-words text-xl text-[#052b57]">{value}</strong></article>)}</section>
      <section className="grid gap-4 xl:grid-cols-3">
        <Info title="시작 조건" body={text(process, "startCondition") || "선행 업무, 권한, 기준정보와 입력 데이터가 준비되어야 합니다."} />
        <Info title="완료 조건" body={text(process, "completionCondition") || "필수 단계, 증빙, 검증과 승인 조건을 모두 충족해야 합니다."} />
        <article className="rounded-2xl border bg-white p-5"><h3 className="font-black text-[#052b57]">통제 기준</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><dt className="text-slate-500">위험도</dt><dd className="font-bold">{text(process, "riskLevel") || "미지정"}</dd><dt className="text-slate-500">검토 주기</dt><dd className="font-bold">{text(process, "reviewCycleDays") ? `${text(process, "reviewCycleDays")}일` : "미지정"}</dd><dt className="text-slate-500">설계 상태</dt><dd className="font-bold">{text(assurance, "assuranceStatus") || "-"}</dd><dt className="text-slate-500">진척도</dt><dd className="font-bold">{text(progress, "completionPercent") || 0}%</dd></dl></article>
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-black text-[#052b57]">업무 실행 순서</h3><p className="mt-1 text-sm text-slate-600">단계 완료 조건과 담당 액터를 확인하고 실제 연결 화면에서 업무를 수행합니다.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${tone(metric(assurance, "designBlockerCount") === 0)}`}>{metric(assurance, "designBlockerCount") === 0 ? "설계 검증 통과" : `설계 차단 ${metric(assurance, "designBlockerCount")}건`}</span></div>
        <ol className="mt-5 grid gap-4">{steps.map((step, index) => <StepCard index={index} key={text(step, "stepCode")} row={step} />)}</ol>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border bg-white p-5"><h3 className="font-black text-[#052b57]">검증 시나리오</h3><ul className="mt-4 space-y-3">{cases.map(row => <StatusRow key={text(row, "caseCode")} title={text(row, "caseName")} detail={text(row, "caseType")} status={text(row, "status")} ok={text(row, "status") === "APPROVED"} />)}</ul></article>
        <article className="rounded-2xl border bg-white p-5"><h3 className="font-black text-[#052b57]">구현·검증 작업</h3><ul className="mt-4 space-y-3">{jobs.slice(0, 12).map(row => <StatusRow key={`${text(row, "jobId")}-${text(row, "jobName")}`} title={text(row, "jobName")} detail={`${text(row, "jobType")} · ${text(row, "targetPath")}`} status={text(row, "jobStatus")} ok={["VERIFIED", "COMPLETED"].includes(text(row, "jobStatus"))} />)}</ul></article>
      </section>
    </div>
  </AdminPageShell>;
}

function Info({ title, body }: { title: string; body: string }) { return <article className="rounded-2xl border bg-white p-5"><h3 className="font-black text-[#052b57]">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-700">{body}</p></article>; }
function StepCard({ index, row }: { index: number; row: Row }) { const target = text(row, "adminPath") || text(row, "userPath"); return <li className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[3rem_1fr_auto] lg:items-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 font-black text-[#174ea6]">{index + 1}</span><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-black text-[#052b57]">{text(row, "stepName")}</h4><span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{text(row, "actorCode")}</span><span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{text(row, "fromState")} → {text(row, "toState")}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{text(row, "requirementText") || text(row, "completionRule")}</p><p className="mt-2 text-xs text-slate-500">완료 기준: {text(row, "completionRule") || "필수 데이터·증빙·권한 검증 통과"}</p></div>{target ? <a className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#246beb] px-4 font-bold text-white" href={target}>업무 화면 열기</a> : <span className="rounded-lg bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-800">하위 업무에서 실행</span>}</li>; }
function StatusRow({ title, detail, status, ok }: { title: string; detail: string; status: string; ok: boolean }) { return <li className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3"><div><strong className="text-sm text-slate-800">{title}</strong><p className="mt-1 break-all text-xs text-slate-500">{detail}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ring-1 ${tone(ok)}`}>{status || "PENDING"}</span></li>; }
