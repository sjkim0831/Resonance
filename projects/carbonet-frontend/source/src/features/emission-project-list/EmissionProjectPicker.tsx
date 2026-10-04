import { useEffect, useState } from "react";
import { CommonPageContainer } from "../../components/common-design/CommonDesignPrimitives";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type Project = { id: string; name: string; site?: string; period?: string; periodStart?: string; periodEnd?: string };

export function EmissionProjectPicker({ title, description }: { title: string; description: string }) {
  const en = isEnglish();
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRows([]);
    const path = `/home/api/emission-projects?keyword=${encodeURIComponent(keyword)}&page=${page}&size=10`;
    void fetch(buildLocalizedPath(path, `/en${path}`), { credentials: "include", headers: { Accept: "application/json" }, signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw Error(body.message || `프로젝트 조회 실패 (${response.status})`);
        if (!Array.isArray(body.items)) throw Error(en ? "Invalid project response." : "프로젝트 응답 형식을 확인할 수 없습니다.");
        return body;
      })
      .then(body => { if (!controller.signal.aborted) { setRows(body.items); setTotal(Number(body.total) || 0); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [keyword, page, refresh, en]);
  const target = (id: string) => { const params = new URLSearchParams(location.search); params.set("projectId", id); return `${location.pathname}?${params}`; };
  return <CommonPageContainer>
    <header className="py-6"><h1 className="text-3xl font-black text-[#052b57]">{title}</h1><p className="mt-2 text-slate-600">{description}</p></header>
    <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-5" onSubmit={event => { event.preventDefault(); setKeyword(input.trim()); setPage(1); setRefresh(value => value + 1); }}>
      <label className="min-w-0 flex-1 font-bold">{en ? "Project search" : "프로젝트 검색"}<input className="mt-2 h-11 w-full rounded border border-slate-300 px-3 font-normal" placeholder={en ? "Project, site, owner" : "프로젝트명·사업장·담당자"} value={input} onChange={event => setInput(event.target.value)} /></label>
      <button className="min-h-11 rounded bg-[#003675] px-5 font-bold text-white" disabled={loading}>{en ? "Search" : "조회"}</button>
    </form>
    <section className="mt-5 overflow-hidden rounded-lg border bg-white" aria-busy={loading}>
      <h2 className="border-b p-4 text-lg font-bold">{en ? "Select project" : "보고서를 작성할 프로젝트 선택"}</h2>
      {error ? <div role="alert" className="p-5 text-red-800">{error}<button className="ml-3 underline" onClick={() => setRefresh(value => value + 1)}>{en ? "Retry" : "다시 조회"}</button></div> : loading ? <p role="status" className="p-8 text-center">{en ? "Loading projects…" : "프로젝트를 불러오는 중입니다."}</p> : <>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-100"><tr>{(en ? ["Project", "Site", "Period", "Action"] : ["프로젝트", "사업장", "산정 기간", "업무"]).map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>
          {rows.map(row => <tr className="border-t" key={row.id}><td className="p-4"><strong>{row.name}</strong><small className="block text-slate-500">{row.id}</small></td><td className="p-4">{row.site || "—"}</td><td className="p-4">{row.period || (row.periodStart && row.periodEnd ? `${row.periodStart} ~ ${row.periodEnd}` : "—")}</td><td className="p-4"><a className="inline-flex min-h-11 items-center rounded border border-blue-800 px-4 font-bold text-blue-900" href={target(row.id)}>{en ? "Select" : "선택"}</a></td></tr>)}
          {!rows.length && <tr><td colSpan={4} className="p-8 text-center">{en ? "No matching projects." : "조회 조건에 맞는 프로젝트가 없습니다."}</td></tr>}
        </tbody></table></div>
        <div className="flex items-center justify-center gap-4 border-t p-4"><button className="rounded border px-4 py-2 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(value => value - 1)}>{en ? "Previous" : "이전"}</button><span>{page} / {Math.max(1, Math.ceil(total / 10))}</span><button className="rounded border px-4 py-2 disabled:opacity-40" disabled={page * 10 >= total} onClick={() => setPage(value => value + 1)}>{en ? "Next" : "다음"}</button></div>
      </>}
    </section>
  </CommonPageContainer>;
}
