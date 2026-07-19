import { useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Props = {
  actors: Row[];
  artifacts: Row[];
  cases: Row[];
  jobs: Row[];
  processes: Row[];
  steps: Row[];
  processCode: string;
  onProcessChange: (processCode: string) => void;
  onDirectDevelop: (processCode: string) => void;
  busy: boolean;
};

const text = (row: Row, key: string) => String(row[key] ?? "");
const normalizedStatus = (row: Row) => text(row, "jobStatus") || text(row, "status");
const finished = (status: string) => ["VERIFIED", "COMPLETED"].includes(status);

function routeLink(path: string, label: string) {
  if (!path) return null;
  return <a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-[#164f86] hover:bg-blue-50" href={path}>
    <span className="material-symbols-outlined text-lg">open_in_new</span>{label}
  </a>;
}

export function ProcessDesignMap(props: Props) {
  const active = props.processCode || text(props.processes[0] || {}, "processCode");
  const process = props.processes.find((row) => text(row, "processCode") === active) || {};
  const steps = useMemo(() => props.steps
    .filter((row) => text(row, "processCode") === active)
    .sort((a, b) => Number(a.stepOrder) - Number(b.stepOrder)), [active, props.steps]);
  const [selected, setSelected] = useState("");
  useEffect(() => setSelected(text(steps[0] || {}, "stepCode")), [active]);

  const selectedStep = steps.find((row) => text(row, "stepCode") === selected) || steps[0] || {};
  const selectedCode = text(selectedStep, "stepCode");
  const actor = props.actors.find((row) => text(row, "actorCode") === text(selectedStep, "actorCode")) || {};
  const processCases = props.cases.filter((row) => text(row, "processCode") === active);
  const processJobs = props.jobs.filter((row) => text(row, "processCode") === active);
  const processVerified = processJobs.filter((row) => finished(normalizedStatus(row))).length;
  const processProgress = processJobs.length ? Math.round(processVerified * 100 / processJobs.length) : 0;

  const rows = steps.map((step) => {
    const code = text(step, "stepCode");
    const jobs = processJobs.filter((row) => text(row, "stepCode") === code);
    const verified = jobs.filter((row) => finished(normalizedStatus(row))).length;
    const running = jobs.filter((row) => normalizedStatus(row) === "RUNNING").length;
    const failed = jobs.filter((row) => ["FAILED", "RETRY"].includes(normalizedStatus(row))).length;
    const progress = jobs.length ? Math.round(verified * 100 / jobs.length) : 0;
    return { step, jobs, verified, running, failed, progress };
  });

  const selectedRow = rows.find((row) => text(row.step, "stepCode") === selectedCode);
  const selectedArtifacts = props.artifacts.filter((row) => text(row, "processCode") === active && (!text(row, "stepCode") || text(row, "stepCode") === selectedCode));
  const userPath = text(selectedStep, "userPath");
  const adminPath = text(selectedStep, "adminPath");

  return <div className="space-y-5">
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black tracking-wider text-blue-700">PROJECT DELIVERY MAP</p>
          <h2 className="mt-1 text-2xl font-black text-[#052b57]">프로세스·화면·개발 진척도 지도</h2>
          <p className="mt-2 text-sm text-slate-600">각 단계를 선택하면 담당 액터, 완료 조건, 사용자·관리자 화면, API와 개발 작업 상태를 함께 확인할 수 있습니다.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label="프로세스 선택" className="h-11 min-w-72 rounded-lg border bg-white px-3 font-bold" value={active} onChange={(event) => props.onProcessChange(event.target.value)}>
            {props.processes.map((row) => <option key={text(row, "processCode")} value={text(row, "processCode")}>{text(row, "processName")} ({text(row, "processCode")})</option>)}
          </select>
          <button className="h-11 rounded-lg bg-[#0f7b49] px-5 font-black text-white disabled:opacity-40" disabled={props.busy || processProgress < 100} onClick={() => props.onDirectDevelop(active)} type="button">검증된 설계 반영</button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["전체 진척도", `${processProgress}%`], ["프로세스 단계", steps.length], ["개발 작업", `${processVerified}/${processJobs.length}`], ["테스트 시나리오", processCases.length]].map(([label, value]) => <div className="rounded-xl border bg-white p-4" key={String(label)}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl text-[#052b57]">{value}</strong></div>)}
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200" aria-label={`전체 진척도 ${processProgress}%`}><div className="h-full bg-[#246beb]" style={{ width: `${processProgress}%` }} /></div>
    </section>

    <section className="rounded-2xl border bg-white p-4 lg:p-6">
      <div className="mb-5"><h3 className="text-lg font-black text-[#052b57]">{text(process, "processName")}</h3><p className="mt-1 text-sm text-slate-600">{text(process, "goal")}</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row, index) => {
          const code = text(row.step, "stepCode");
          const isSelected = code === selectedCode;
          const state = row.failed ? "확인 필요" : row.running ? "진행 중" : row.progress === 100 ? "완료" : "예정";
          return <button aria-pressed={isSelected} className={`min-h-44 rounded-xl border-2 p-4 text-left ${isSelected ? "border-[#246beb] bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"}`} key={code} onClick={() => setSelected(code)} type="button">
            <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black">{index + 1}</span><span className="text-xs font-black text-slate-600">{state}</span></div>
            <strong className="mt-3 block text-base text-[#052b57]">{text(row.step, "stepName")}</strong>
            <p className="mt-1 text-xs font-bold text-blue-700">{text(row.step, "actorCode") || "액터 미지정"}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#246beb]" style={{ width: `${row.progress}%` }} /></div>
            <p className="mt-2 text-xs text-slate-600">{row.verified}/{row.jobs.length} 완료 · 실행 {row.running} · 오류 {row.failed}</p>
          </button>;
        })}
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <article className="rounded-2xl border bg-white p-5">
        <p className="text-xs font-black text-blue-700">SELECTED STEP</p>
        <h3 className="mt-1 text-xl font-black text-[#052b57]">{text(selectedStep, "stepName") || "단계를 선택하세요"}</h3>
        <div className="mt-4 flex flex-wrap gap-2">{routeLink(userPath, "사용자 화면")}{routeLink(adminPath, "관리자 화면")}</div>
        {!userPath && !adminPath && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">연결된 화면이 없습니다. 자동 처리 단계인지 화면 설계 누락인지 확인해야 합니다.</p>}
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {[["담당 액터", `${text(actor, "actorName") || text(selectedStep, "actorCode") || "미지정"}`], ["상태 전이", `${text(selectedStep, "fromState") || "-"} → ${text(selectedStep, "toState") || "-"}`], ["실행 명령", text(selectedStep, "commandCode") || "미지정"], ["API 계약", text(selectedStep, "apiContract") || "없음"]].map(([label, value]) => <div className="rounded-lg bg-slate-50 p-3" key={label}><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-slate-800">{value}</dd></div>)}
        </dl>
        <h4 className="mt-5 font-black text-[#052b57]">완료 조건</h4><p className="mt-2 text-sm leading-6 text-slate-700">{text(selectedStep, "completionRule") || "완료 조건이 등록되지 않았습니다."}</p>
        <h4 className="mt-5 font-black text-[#052b57]">상세 설계</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{text(selectedStep, "requirementText") || "상세 설계가 등록되지 않았습니다."}</p>
      </article>

      <article className="rounded-2xl border bg-white p-5">
        <h3 className="font-black text-[#052b57]">개발 작업과 산출물</h3>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[["완료", selectedRow?.verified || 0], ["진행", selectedRow?.running || 0], ["오류", selectedRow?.failed || 0]].map(([label, value]) => <div className="rounded-lg bg-slate-50 p-3" key={label}><strong className="block text-xl text-[#052b57]">{value}</strong><span className="text-xs text-slate-500">{label}</span></div>)}
        </div>
        <div className="mt-5 max-h-72 space-y-2 overflow-y-auto">
          {(selectedRow?.jobs || []).map((job) => <div className="flex items-center justify-between gap-3 rounded-lg border p-3" key={text(job, "jobId")}><div className="min-w-0"><strong className="block truncate text-sm">{text(job, "jobType")}</strong><span className="text-xs text-slate-500">{text(job, "targetPath")}</span></div><span className="shrink-0 text-xs font-black text-slate-600">{normalizedStatus(job)}</span></div>)}
          {!selectedRow?.jobs.length && <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">등록된 개발 작업이 없습니다.</p>}
        </div>
        <h4 className="mt-5 font-black text-[#052b57]">연결 산출물 {selectedArtifacts.length}건</h4>
        <div className="mt-2 space-y-2">{selectedArtifacts.slice(0, 8).map((item) => <div className="rounded-lg bg-slate-50 p-3" key={`${text(item, "artifactCode")}-${text(item, "artifactName")}`}><strong className="text-sm">{text(item, "artifactName") || text(item, "artifactCode")}</strong><p className="mt-1 text-xs text-slate-500">{text(item, "deliveryStatus") || text(item, "status")}</p></div>)}</div>
      </article>
    </section>
  </div>;
}
