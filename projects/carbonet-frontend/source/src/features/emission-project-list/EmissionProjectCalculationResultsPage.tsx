import { useEffect, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { CommonPageContainer } from "../../components/common-design/CommonDesignPrimitives";

type Run = { id: number; version: number; status: string; totalEmission: number; resultUnit: string; submissionIds?: string; snapshotHash?: string; methodology?: string; calculatedBy?: string; calculatedAt?: string };
type ResultItem = { name: string; category: string; period: string; quantity: number; unit: string; factorName: string; factorUnit: string; factorSource: string; factorValue: number; emissionValue: number; formula: string };
type ProjectCalculation = { project: { id: string; name: string; site: string }; activityCount: number; acceptedSubmissionCount: number; runs: Run[]; items: ResultItem[] };
type ProjectOption = { id: string; name: string; site?: string; period?: string; step?: string; status?: string };

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
  return body as T;
}

export function EmissionProjectCalculationResultsPage() {
  const en = isEnglish();
  const id = new URLSearchParams(location.search).get("projectId") || "";
  const [data, setData] = useState<ProjectCalculation | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const api = buildLocalizedPath(`/home/api/emission-projects/${encodeURIComponent(id)}/calculation`, `/en/home/api/emission-projects/${encodeURIComponent(id)}/calculation`);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const url = id
      ? api
      : buildLocalizedPath("/home/api/emission-projects?page=1&size=100", "/en/home/api/emission-projects?page=1&size=100");
    void fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })
      .then(readJson<ProjectCalculation | { items: ProjectOption[] }>)
      .then((body) => {
        if (cancelled) return;
        if (id) setData(body as ProjectCalculation);
        else setProjects((body as { items?: ProjectOption[] }).items || []);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, api]);

  const matches = projects.filter((p) => `${p.id} ${p.name} ${p.site || ""}`.toLowerCase().includes(keyword.toLowerCase()));
  const pagePath = en ? "/en/emission/calculation-results" : "/emission/calculation-results";

  return <CommonPageContainer>
    <nav className="text-sm text-slate-500"><a href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>{en ? "Emission projects" : "배출량 프로젝트"}</a><span className="mx-2">/</span>{en ? "Calculation results" : "산정 결과"}</nav>
    <header className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-6">
      <p className="font-bold text-blue-800">{en ? "Emission Management" : "탄소배출 관리"}</p>
      <h1 className="mt-1 text-3xl font-black text-[#052b57]">{en ? "Calculation Results" : "산정 결과"}</h1>
      <p className="mt-2 text-slate-600">{en ? "Review saved calculation versions and their activity-level results. Run or edit calculations in the separate calculation workspace." : "저장된 산정 버전과 활동자료별 결과를 조회합니다. 산정 실행·계수 매핑은 별도의 배출량 산정 화면에서 진행합니다."}</p>
      {id && <a className="mt-4 inline-flex rounded-lg bg-[#003675] px-4 py-2 font-bold text-white" href={buildLocalizedPath(`/emission/calculation?projectId=${encodeURIComponent(id)}`, `/en/emission/calculation?projectId=${encodeURIComponent(id)}`)}>{en ? "Open calculation workspace" : "배출량 산정 작업공간 열기"}</a>}
    </header>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</p>}
    {!id ? <section className="mt-5 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><label className="min-w-64 flex-1 text-sm font-bold">{en ? "Search projects" : "프로젝트 검색"}<input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="mt-1 w-full rounded-lg border p-3 font-normal" placeholder={en ? "Project, site, or ID" : "프로젝트명·사업장·ID"}/></label><span className="pb-3 text-sm text-slate-500">{loading ? (en ? "Loading…" : "불러오는 중…") : `${matches.length}${en ? " projects" : "개 프로젝트"}`}</span></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-slate-100"><tr>{(en ? ["Project", "Site", "Period", "Status", "Action"] : ["프로젝트", "사업장", "기간", "현재 상태", "조회"]).map((x) => <th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{matches.map((p) => <tr className="border-t" key={p.id}><td className="p-3"><strong>{p.name}</strong><small className="block text-slate-500">{p.id}</small></td><td className="p-3">{p.site || "-"}</td><td className="p-3">{p.period || "-"}</td><td className="p-3">{p.step || p.status || "-"}</td><td className="p-3"><a className="inline-flex rounded-lg bg-[#003675] px-4 py-2 font-bold text-white" href={`${pagePath}?projectId=${encodeURIComponent(p.id)}`}>{en ? "View results" : "결과 보기"}</a></td></tr>)}{!loading && !matches.length && <tr><td colSpan={5} className="p-10 text-center text-slate-500">{en ? "No authorized projects found." : "조회 가능한 프로젝트가 없습니다."}</td></tr>}</tbody></table></div>
    </section> : <>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="font-bold text-blue-700">{data?.project.site || ""}</p><h2 className="mt-1 text-2xl font-black text-[#052b57]">{data?.project.name || id}</h2><p className="text-sm text-slate-500">{id}</p></div><span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold">{loading ? (en ? "Loading" : "불러오는 중") : `${data?.runs?.length || 0}${en ? " saved versions" : "개 산정 버전"}`}</span></div>
      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[en ? "Accepted submissions" : "접수 제출본", data?.acceptedSubmissionCount ?? "-"], [en ? "Activity rows" : "산정 대상 자료", data?.activityCount ?? "-"], [en ? "Calculation versions" : "산정 버전", data?.runs?.length ?? "-"], [en ? "Latest total" : "최신 총배출량", data?.runs?.[0] ? `${Number(data.runs[0].totalEmission).toFixed(6)} ${data.runs[0].resultUnit}` : "-"]].map(([label, value]) => <article key={String(label)} className="rounded-xl border bg-white p-5"><p className="text-sm font-bold text-slate-500">{label}</p><strong className="mt-2 block break-words text-2xl text-[#052b57]">{value}</strong></article>)}</section>
      {!loading && !data?.runs?.length && <section className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-6"><h2 className="text-xl font-black text-amber-950">{en ? "No calculation result has been saved." : "저장된 산정 결과가 없습니다."}</h2><p className="mt-2 text-amber-900">{en ? "Complete accepted-data mapping and create a calculation version in the calculation workspace. This page will show it after refresh." : "접수된 자료를 매핑하고 배출량 산정 작업공간에서 산정 버전을 생성하면, 이 화면에 결과가 표시됩니다."}</p><a className="mt-4 inline-flex rounded-lg bg-[#003675] px-4 py-2 font-bold text-white" href={buildLocalizedPath(`/emission/calculation?projectId=${encodeURIComponent(id)}`, `/en/emission/calculation?projectId=${encodeURIComponent(id)}`)}>{en ? "Go to calculation" : "배출량 산정으로 이동"}</a></section>}
      <section className="mt-5 overflow-x-auto rounded-xl border bg-white"><div className="border-b p-5"><h2 className="text-xl font-black text-[#052b57]">{en ? "Latest calculation detail" : "최신 산정 결과 상세"}</h2><p className="mt-1 text-sm text-slate-500">{data?.runs?.[0] ? `v${data.runs[0].version} · ${data.runs[0].calculatedBy || "-"} · ${data.runs[0].calculatedAt || "-"}` : (en ? "No version detail yet." : "표시할 산정 버전이 아직 없습니다.")}</p></div><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-100"><tr>{(en ? ["Activity", "Period", "Quantity", "Factor", "Formula", "Emission"] : ["활동자료", "기간", "활동량", "배출계수", "산정식", "배출량"]).map((x) => <th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{data?.items?.map((x, i) => <tr className="border-t" key={`${x.name}-${i}`}><td className="p-3"><strong>{x.name}</strong><small className="block text-slate-500">{x.category}</small></td><td className="p-3">{x.period}</td><td className="p-3">{x.quantity} {x.unit}</td><td className="p-3">{x.factorName}<small className="block text-slate-500">{x.factorSource} · {x.factorValue}/{x.factorUnit}</small></td><td className="p-3 font-mono">{x.formula}</td><td className="p-3 font-bold">{Number(x.emissionValue).toFixed(8)} tCO₂e</td></tr>)}{!loading && !data?.items?.length && <tr><td colSpan={6} className="p-10 text-center text-slate-500">{en ? "No calculated rows for the latest version." : "최신 버전에 표시할 산정 행이 없습니다."}</td></tr>}</tbody></table></section>
      <section className="mt-5 rounded-xl border bg-white p-5"><h2 className="text-xl font-black text-[#052b57]">{en ? "Calculation version history" : "산정 버전 이력"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data?.runs?.map((run) => <article className="rounded-lg border p-4" key={run.id}><div className="flex justify-between gap-3"><strong>v{run.version}</strong><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">{run.status}</span></div><p className="mt-2 text-xl font-black">{Number(run.totalEmission).toFixed(6)} {run.resultUnit}</p><p className="mt-2 text-xs text-slate-500">{run.calculatedBy || "-"} · {run.calculatedAt || "-"}</p><p className="mt-1 text-xs text-slate-500">{en ? "Submission IDs" : "제출 ID"}: {run.submissionIds || "-"}</p></article>)}{!loading && !data?.runs?.length && <p className="text-slate-500">{en ? "No calculation history." : "산정 이력이 없습니다."}</p>}</div></section>
    </>}
  </CommonPageContainer>;
}
