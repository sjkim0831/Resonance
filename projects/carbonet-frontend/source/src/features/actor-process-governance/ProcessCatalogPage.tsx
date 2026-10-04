import { useCallback, useEffect, useMemo, useState } from "react";
import { BoundScreenActions } from "../work-implementation/BoundScreenActions";

type Row = Record<string, any>;
type Catalog = { businessTypes?: Row[]; counts?: Row; orphanRuntimeCount?: number; generatedAt?: string };

export function ProcessCatalogPage() {
  const [data, setData] = useState<Catalog>({ businessTypes: [], counts: {} });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/admin/api/system/actor-process/catalog", { credentials: "include", headers: { Accept: "application/json" } });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error(`카탈로그 API가 JSON 대신 HTTP ${response.status}를 반환했습니다.`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "전체 업무 정의를 불러오지 못했습니다.");
      setData(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const types = useMemo<Row[]>(() => (data.businessTypes || []).map(type => ({ ...type, processes: (type.processes || []).map((process: Row) => ({
    ...process,
    steps: (process.steps || []).filter((step: Row) => {
      const hit = !query || `${type.workTypeName} ${process.processCode} ${process.processName} ${step.stepCode} ${step.stepName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
      const active = filter === "ALL" || filter === "ACTIVE" && Boolean(type.active) || filter === "RETIRED" && ["RETIRED", "DELETED"].includes(String(process.lifecycleStatus).toUpperCase());
      return hit && active;
    })
  })).filter((process: Row) => process.steps.length > 0) })), [data.businessTypes, query, filter]);

  return <main className="mx-auto max-w-7xl p-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">관리자 · 정의 카탈로그</p><h1 className="text-3xl font-black text-[#052b57]">전체 업무 보기</h1><p className="mt-1 text-slate-600">업무·프로세스·절차의 현재 정의 정본입니다. 편집 후 이 목록을 다시 조회해 반영을 확인할 수 있습니다.</p></div><div className="flex gap-2"><button className="rounded border border-blue-300 bg-white px-4 py-2 font-bold text-blue-800" onClick={() => void load()} disabled={loading}>새로고침</button><a className="rounded bg-[#052b57] px-4 py-2 font-bold text-white" href="/admin/system/work-implementation">업무 목록 편집</a></div></header>
    <div className="my-4 flex flex-wrap gap-2"><input aria-label="업무 검색" className="min-w-64 flex-1 rounded border p-2" placeholder="업무명·process_code·step_code 검색" value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="상태 필터" className="rounded border p-2" value={filter} onChange={event => setFilter(event.target.value)}><option value="ALL">전체</option><option value="ACTIVE">활성 업무</option><option value="RETIRED">폐기 프로세스</option></select></div>
    <p className="mb-4">업무 {data.counts?.businessTypes || 0} · 프로세스 {data.counts?.processes || 0} · 절차 {data.counts?.steps || 0} · 고아 실행 {data.orphanRuntimeCount || 0}</p>
    {error && <div role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-900">{error} <button className="ml-2 underline" onClick={() => void load()}>다시 시도</button></div>}
    {loading && <p role="status" className="mb-3 text-slate-600">최신 업무 정의를 읽는 중입니다…</p>}
    {!loading && !error && types.map(type => <section key={type.workTypeCode} className="mb-4 rounded-xl border bg-white p-4"><h2 className="font-black">{type.businessOrder}. {type.workTypeName}</h2>{type.processes.map((process: Row) => <article key={process.processCode} className="mt-3 border-t pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><a className="font-bold text-blue-700" href={process.workspaceUrl}>{process.displayNumber} {process.processName}</a><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">정의 v{process.processVersion || "미제공"} · {process.lifecycleStatus || process.processStatus || "상태 미제공"}</span></div><div className="mt-1 flex items-center gap-3"><small className="text-slate-500">{process.processCode}</small><a className="text-xs font-bold text-blue-700 underline" href={`/admin/system/work-implementation?processCode=${encodeURIComponent(process.processCode)}`}>절차 계약 편집</a></div><ol className="ml-6 list-decimal">{process.steps.map((step: Row) => <li key={step.stepCode} className="py-1">{step.stepName} <span className="text-xs text-slate-500">{step.stepCode}</span>{step.screenBindings?.length ? step.screenBindings.map((binding: Row) => <BoundScreenActions key={`${binding.audience}:${binding.screenResourceId}:${binding.routePath}`} routePath={String(binding.routePath || "")} screenName={String(binding.screenName || step.stepName || "화면")} />) : <span className="ml-2 text-amber-700">MISSING_BINDING</span>}</li>)}</ol></article>)}</section>)}
    {!loading && !error && !types.length && <p className="rounded border bg-white p-8 text-center text-slate-600">조건에 맞는 업무가 없습니다.</p>}
    <p className="mt-3 text-xs text-slate-500">정의 버전은 관리 편집 화면의 저장 후 재조회 결과와 비교할 수 있습니다. 업무 정의 변경은 해당 프로세스의 공식 Revision 경로를 사용합니다.</p>
  </main>;
}
