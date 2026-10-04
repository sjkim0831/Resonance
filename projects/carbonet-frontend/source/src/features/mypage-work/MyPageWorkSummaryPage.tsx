import { useEffect, useMemo, useState } from "react";
import { CommonContentCard, CommonStatusBadge } from "../../components/common-design/CommonDesignPrimitives";
import { EmissionPageIntro } from "../emission-common/EmissionPageIntro";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type WorkItem = { executionId: string; tenantId: string; projectId: string; processCode: string; processName: string; currentStepCode: string; stepName: string; currentState: string; actorCode: string; targetUrl?: string; startedAt?: string };
type Payload = { items?: WorkItem[]; summary?: { total?: number; active?: number }; message?: string };

export function MyPageWorkSummaryPage() {
  const en = isEnglish();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(buildLocalizedPath("/home/api/my-work-items", "/en/home/api/my-work-items"), { credentials: "include", headers: { Accept: "application/json" }, signal: controller.signal })
      .then(async response => { const body = await response.json() as Payload; if (response.status === 401) { window.location.assign(buildLocalizedPath("/signin/loginView", "/en/signin/loginView")); return; } if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`); setItems(Array.isArray(body.items) ? body.items : []); })
      .catch(reason => { if ((reason as {name?:string})?.name !== "AbortError") setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const filtered = useMemo(() => { const term = query.trim().toLocaleLowerCase(); return term ? items.filter(item => `${item.processName} ${item.stepName} ${item.projectId} ${item.actorCode}`.toLocaleLowerCase().includes(term)) : items; }, [items, query]);
  return <main className="min-h-[70vh] bg-[#f7f8fa] px-4 py-8 text-slate-900 md:px-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <EmissionPageIntro category={en ? "My Page · General Work" : "마이페이지 · 일반 업무"} title={en ? "My Work Summary" : "일반 내 업무"} description={en ? "Review active work assigned to your account across non-emission processes, then continue it with its existing actor and project scope." : "탄소배출 업무와 분리된 일반 업무를 확인하고, 현재 계정에 배정된 액터 권한으로 업무를 이어갑니다."} actions={<a className="krds-button rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] bg-white font-black text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/emission/my-tasks", "/en/emission/my-tasks")}>{en ? "Emission work" : "탄소배출 내 업무"}</a>} />
      <section className="grid gap-4 sm:grid-cols-2"><CommonContentCard><p className="text-sm font-bold text-slate-500">{en ? "Assigned general work" : "배정된 일반 업무"}</p><p className="mt-2 text-3xl font-black text-[#123a70]">{loading ? "—" : items.length}</p></CommonContentCard><CommonContentCard><p className="text-sm font-bold text-slate-500">{en ? "Handoff" : "업무 인계"}</p><p className="mt-2 text-sm font-semibold">{en ? "Continue from each work item; the server rechecks actor, tenant, and project permissions." : "각 업무에서 이어하기를 선택하세요. 실행·인계 시 서버가 액터·Tenant·프로젝트 권한을 다시 검사합니다."}</p></CommonContentCard></section>
      <CommonContentCard>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h2 className="text-xl font-black">{en ? "All assigned work" : "전체 배정 업무"}</h2><p className="mt-1 text-sm text-slate-600">{en ? "Emission projects are shown separately in Emission Management." : "탄소배출 프로젝트 업무는 ‘탄소배출 관리 → 탄소배출 내 업무’에서 별도로 처리합니다."}</p></div><label className="block md:w-96"><span className="gov-label">{en ? "Search" : "검색"}</span><input className="krds-input w-full" value={query} onChange={event => setQuery(event.target.value)} placeholder={en ? "Process, step, project" : "프로세스·절차·프로젝트"}/></label></div>
        {error ? <p className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}
        {loading ? <p className="py-12 text-center text-slate-500" aria-busy="true">{en ? "Loading assigned work…" : "배정된 업무를 불러오는 중…"}</p> : filtered.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-100 text-sm"><tr>{[en?"Process":"프로세스",en?"Current step":"현재 절차",en?"Project":"프로젝트",en?"State":"상태",en?"Owner":"담당 역할",en?"Action":"작업"].map(label=><th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map(item => { const href = buildLocalizedPath(`/work/execution?${new URLSearchParams({tenantId:item.tenantId,projectId:item.projectId,processCode:item.processCode,stepCode:item.currentStepCode})}`, `/en/work/execution?${new URLSearchParams({tenantId:item.tenantId,projectId:item.projectId,processCode:item.processCode,stepCode:item.currentStepCode})}`); return <tr className="border-t border-slate-200" key={item.executionId}><td className="px-4 py-4 font-bold">{item.processName}</td><td className="px-4 py-4">{item.stepName || item.currentStepCode}</td><td className="px-4 py-4">{item.projectId}</td><td className="px-4 py-4"><CommonStatusBadge>{item.currentState}</CommonStatusBadge></td><td className="px-4 py-4">{item.actorCode}</td><td className="px-4 py-4"><a className="krds-button krds-button-primary" href={href}>{en ? "Continue / hand off" : "업무 이어하기·인계"}</a></td></tr>; })}</tbody></table></div> : <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><p className="font-bold">{en ? "No general work is currently assigned." : "현재 계정에 배정된 일반 업무가 없습니다."}</p><p className="mt-2 text-sm text-slate-600">{en ? "New assignments will appear here; emission work remains in its separate list." : "새 배정은 이 목록에 표시되며 탄소배출 업무는 전용 목록에 표시됩니다."}</p></div>}
      </CommonContentCard>
    </div>
  </main>;
}
