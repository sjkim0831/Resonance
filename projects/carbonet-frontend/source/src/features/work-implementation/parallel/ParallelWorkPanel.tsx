import { useMemo, useState } from "react";
import { inspectWorkstreams, type Workstream, type Policy } from "./inspectWorkstreams.mjs";
import policyJson from "./integration-policy.json";

const registered = import.meta.glob("./workstreams/*.json", { eager: true, import: "default" });
const streams = Object.values(registered).map(value => value as Workstream).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.id.localeCompare(b.id));
const policy = policyJson as Policy;
const labels: Record<string, string> = { PLANNED: "배정 대기", IN_PROGRESS: "개발 중", REVIEW: "통합 검토", INTEGRATED: "반영 기록 있음" };
type Process = { processCode: string; processVersion?: string; steps?: { stepCode: string }[] };

export function ParallelWorkPanel({ processes, catalogLoaded }: { processes: Process[]; catalogLoaded: boolean }) {
  const [selected, setSelected] = useState(streams[0]?.id || "");
  const report = useMemo(() => inspectWorkstreams(streams, policy, catalogLoaded ? { catalog: processes } : {}), [processes, catalogLoaded]);
  const current = streams.find(s => s.id === selected);
  const issues = report.findings.filter(f => f.streamIds.includes(selected));
  const errors = issues.filter(f => f.severity === "ERROR");
  const pending = [...new Set(issues.filter(f => f.severity !== "ERROR").map(f => f.message))];
  const exportPlan = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), purpose: "DEVELOPMENT_PLAN_NOT_PROCESS_DEFINITION", catalogChecked: catalogLoaded, policy, workstreams: streams, report }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "parallel-work-plan.json"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section aria-label="병렬 개발 작업 관리" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-5 py-4">
      <div><h2 className="text-lg font-bold text-[#052b57]">병렬 개발 작업 관리</h2><p className="mt-1 text-sm text-slate-600">업무별 수정 범위와 통합 대기 항목을 확인합니다. 개발 배정 기록이며 실제 업무 완료 상태와 별도로 관리합니다.</p></div>
      <button type="button" onClick={exportPlan} className="rounded-lg border bg-white px-4 py-2 text-sm font-bold">작업 명세 내려받기</button>
    </div>
    <div className="grid gap-3 p-5 md:grid-cols-3">
      {streams.map(s => <button type="button" key={s.id} aria-pressed={selected === s.id} onClick={() => setSelected(s.id)} className={`rounded-lg border p-4 text-left ${selected === s.id ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 bg-white"}`}>
        <span className="text-xs font-bold text-slate-600">{labels[s.state] || s.state} · {s.assignee}</span>
        <strong className="mt-2 block text-base text-[#052b57]">{s.name}</strong>
        <span className="mt-2 block text-sm text-slate-600">{s.steps.length}개 절차 · {s.pages.length}개 화면 · {s.ownedPaths.length}개 수정 경로</span>
        <span className="mt-2 block text-xs text-slate-500">요청 모델 {s.model}</span>
      </button>)}
    </div>
    <div className="mx-5 flex flex-wrap gap-3 rounded-lg bg-slate-50 p-3 text-sm">
      <span>명세 충돌 <strong className={report.conflictCount ? "text-red-700" : "text-slate-900"}>{report.conflictCount}건</strong></span>
      <span>정의 대조: {catalogLoaded ? "현재 조회된 카탈로그 기준" : "카탈로그 조회 대기"}</span>
      <span className="font-bold text-amber-800">통합: {report.integrationReady && catalogLoaded ? "CLI Commit·변경 파일 검사 필요" : "대기 항목 확인 필요"}</span>
    </div>
    {current && <div className="grid gap-5 p-5 lg:grid-cols-2">
      <div><h3 className="font-bold">{current.name}</h3><p className="mt-2 text-sm text-slate-600">{current.goal}</p>
        <ul className="mt-3 space-y-2 text-sm">{current.pages.map(p => <li key={p.pageId}><a className="font-medium text-blue-700 underline" href={p.route}>{p.route}</a><span className="ml-2 text-xs text-slate-500">{p.permissionCodes.length ? p.permissionCodes.join(", ") : "권한 연결 확인 대기"}</span></li>)}</ul>
        <details className="mt-4 rounded border p-3 text-sm"><summary className="cursor-pointer font-bold">수정 가능한 파일 {current.ownedPaths.length}개</summary><ul className="mt-2 space-y-2 break-all font-mono text-xs">{current.ownedPaths.map(p => <li key={p}>{p}</li>)}</ul></details>
      </div>
      <div><h3 className="font-bold">통합 전 확인</h3>
        {errors.length > 0 && <ul className="mt-2 space-y-1 rounded bg-red-50 p-3 text-sm text-red-800">{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>}
        <ul className="mt-2 space-y-1 text-sm text-slate-700">{pending.map(p => <li key={p}>• {p}</li>)}</ul>
        <p className="mt-3 text-xs leading-5 text-slate-500">명세 충돌 검사는 현재 등록된 작업 간 비교입니다. 실제 수정 파일·Commit·Migration은 통합 CLI에서 추가 검사합니다. 메뉴·권한·공통 API·DB Migration 반영은 총괄이 한 번에 통합합니다.</p>
      </div>
    </div>}
  </section>;
}
