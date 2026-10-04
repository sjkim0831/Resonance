import { useEffect, useMemo, useState } from "react";
import { CommonPageContainer } from "../../components/common-design/CommonDesignPrimitives";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type Project = { id: string; name: string; site?: string; period?: string; periodStart?: string; periodEnd?: string };
type Factor = { id: string; name: string; category: string; unit: string; value: number; source: string };
type Activity = {
  id: number; name: string; category: string; period: string; quantity: number; unit: string; note: string;
  submissionId: number; factorId?: string; factorName?: string; factorValue?: number; factorUnit?: string;
  factorSource?: string; mappingMethod?: string; confidence?: number; unitMatch?: boolean; decisionReason?: string;
};
type Payload = {
  project: Project; activityCount: number; unmappedCount: number; incompatibleUnitCount: number;
  acceptedSubmissionCount: number; actorRoles: string[]; factors: Factor[]; sourceItems: Activity[];
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`);
  return body as T;
}

function href(path: string) { return buildLocalizedPath(path, `/en${path}`); }

export function EmissionFactorReferencePage() {
  const en = isEnglish();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [projectId, setProjectId] = useState(() => new URLSearchParams(location.search).get("projectId") || "");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setProjectsLoading(true);
    fetch(buildLocalizedPath("/home/api/emission-projects?page=1&size=100", "/en/home/api/emission-projects?page=1&size=100"), {
      credentials: "include", cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal,
    }).then(readJson<{ items?: Project[] }>)
      .then(body => { setProjects(body.items || []); setProjectError(""); })
      .catch(err => { if (!controller.signal.aborted) setProjectError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!controller.signal.aborted) setProjectsLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!projectId) { setData(null); setError(""); setLoading(false); return; }
    const controller = new AbortController();
    setData(null); setLoading(true); setError(""); setMessage("");
    const endpoint = buildLocalizedPath(`/home/api/emission-projects/${encodeURIComponent(projectId)}/calculation`, `/en/home/api/emission-projects/${encodeURIComponent(projectId)}/calculation`);
    fetch(endpoint, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal })
      .then(readJson<Payload>)
      .then(body => { if (!controller.signal.aborted) setData(body); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId]);

  function selectProject(value: string) {
    setProjectId(value);
    const params = new URLSearchParams(location.search);
    if (value) params.set("projectId", value); else params.delete("projectId");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
  }

  const categories = useMemo(() => [...new Set((data?.sourceItems || []).map(row => row.category).filter(Boolean))].sort(), [data]);
  const rows = useMemo(() => (data?.sourceItems || []).filter(row => {
    const text = `${row.name} ${row.category} ${row.note} ${row.factorName || ""}`.toLocaleLowerCase();
    return (!query || text.includes(query.toLocaleLowerCase())) && (!category || row.category === category);
  }), [data, query, category]);
  const visibleFactors = useMemo(() => (data?.factors || []).filter(factor => {
    const text = `${factor.name} ${factor.category} ${factor.unit} ${factor.source}`.toLocaleLowerCase();
    return !query || text.includes(query.toLocaleLowerCase());
  }), [data, query]);
  const canMap = Boolean(data?.actorRoles?.includes("CALCULATOR") && data.acceptedSubmissionCount > 0);

  async function map(row: Activity, factorId: string) {
    if (!factorId || !reason.trim()) return;
    setSavingId(row.id); setError(""); setMessage("");
    try {
      const endpoint = buildLocalizedPath(`/home/api/emission-projects/${encodeURIComponent(projectId)}/activities/${row.id}/factor`, `/en/home/api/emission-projects/${encodeURIComponent(projectId)}/activities/${row.id}/factor`);
      await readJson(await fetch(endpoint, {
        method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, reason: reason.trim() }),
      }));
      setMessage(en ? "Factor decision saved. The audit history was updated." : "배출계수와 변경 사유를 저장했고 감사 이력을 갱신했습니다.");
      const refreshUrl = buildLocalizedPath(`/home/api/emission-projects/${encodeURIComponent(projectId)}/calculation`, `/en/home/api/emission-projects/${encodeURIComponent(projectId)}/calculation`);
      setData(await readJson<Payload>(await fetch(refreshUrl, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })));
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSavingId(null); }
  }

  const selected = projects.find(project => project.id === projectId);
  const calcHref = href(`/emission/calculation?projectId=${encodeURIComponent(projectId)}`);
  const activityHref = href(`/emission/activity-data?projectId=${encodeURIComponent(projectId)}`);

  return <CommonPageContainer className="min-w-0 overflow-x-hidden">
    <header className="my-6 rounded-xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
      <p className="text-sm font-black text-blue-800">{en ? "EMISSION BASIS · FACTOR REFERENCE" : "탄소배출 관리 · 산정 기준"}</p>
      <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h1 className="text-3xl font-black text-[#052b57]">{en ? "Methodology & emission factors" : "산정 기준·배출계수"}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{en ? "Review accepted activity data and apply an authorized factor with its source, unit and reason before calculation." : "접수된 활동자료에 적용할 배출계수의 값·단위·출처를 확인하고, 변경 사유와 함께 프로젝트에 적용합니다."}</p></div>
        <label className="w-full min-w-64 max-w-md text-sm font-bold text-slate-800">{en ? "Project" : "프로젝트 선택"}
          <select className="mt-2 h-11 w-full rounded-lg border border-slate-400 bg-white px-3" value={projectId} onChange={event => selectProject(event.target.value)}>
            <option value="">{en ? "Select a project" : "프로젝트를 선택하세요"}</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.id}</option>)}
          </select>
        </label>
      </div>
    </header>

    {(projectError || error) && <div className="my-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert"><strong>{en ? "Could not load or save data" : "자료를 불러오거나 저장하지 못했습니다"}</strong><p className="mt-1">{projectError || error}</p><a className="mt-2 inline-block font-bold underline" href={href(`/signin/loginView?returnUrl=${encodeURIComponent(location.pathname + location.search)}`)}>{en ? "Sign in and retry" : "로그인 확인 후 다시 시도"}</a></div>}
    {message && <p className="my-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 font-bold text-emerald-900" role="status">{message}</p>}

    {!projectId && <section className="rounded-xl border bg-white p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-xl font-black text-[#052b57]">{en ? "Choose a project to review its factor basis" : "배출계수를 확인할 프로젝트를 선택하세요"}</h2><p className="mt-1 text-sm text-slate-600">{en ? "Only projects available to your account are listed." : "현재 계정에 접근 권한이 있는 프로젝트만 표시됩니다."}</p></div>{!projectsLoading && <strong className="text-sm text-slate-600">{projects.length}{en ? " projects" : "개 프로젝트"}</strong>}</div>
      {projectsLoading ? <p className="py-8 text-center" role="status">{en ? "Loading projects…" : "프로젝트를 불러오는 중입니다…"}</p> : projectError ? null : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-100"><tr>{(en ? ["Project", "Site", "Period", "Action"] : ["프로젝트", "사업장", "산정 기간", "업무"]).map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{projects.map(project => <tr className="border-t" key={project.id}><td className="p-3"><strong>{project.name}</strong><small className="block text-slate-500">{project.id}</small></td><td className="p-3">{project.site || "—"}</td><td className="p-3">{project.period || (project.periodStart && project.periodEnd ? `${project.periodStart} ~ ${project.periodEnd}` : "—")}</td><td className="p-3"><button className="min-h-10 rounded-lg bg-[#003675] px-4 font-bold text-white" onClick={() => selectProject(project.id)}>{en ? "Review factors" : "계수 확인"}</button></td></tr>)}{!projects.length && <tr><td className="p-8 text-center text-slate-600" colSpan={4}>{en ? "No accessible projects." : "접근 가능한 프로젝트가 없습니다."}</td></tr>}</tbody></table></div>}
    </section>}

    {projectId && loading && <p className="rounded-lg border bg-white p-8 text-center" role="status">{en ? "Loading project basis and accepted activities…" : "프로젝트 기준과 접수된 활동자료를 불러오는 중입니다…"}</p>}
    {projectId && !loading && data && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={en ? "Project calculation context" : "프로젝트 산정 기준 요약"}>
        {[[en ? "Project / site" : "프로젝트·사업장", `${data.project.name} · ${data.project.site}`], [en ? "Period" : "산정 기간", selected?.period || (selected?.periodStart && selected?.periodEnd ? `${selected.periodStart} ~ ${selected.periodEnd}` : "—")], [en ? "Accepted submissions" : "접수 제출본", data.acceptedSubmissionCount], [en ? "Unmapped / unit mismatch" : "미매핑·단위 불일치", `${data.unmappedCount} / ${data.incompatibleUnitCount}`]].map(([label, value]) => <div className="rounded-xl border bg-white p-4" key={String(label)}><span className="block text-sm text-slate-600">{label}</span><strong className="mt-1 block text-lg text-[#052b57]">{value}</strong></div>)}
      </section>
      {!data.acceptedSubmissionCount && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4"><strong>{en ? "No accepted activity snapshot is available" : "관리자가 접수한 활동자료가 아직 없습니다"}</strong><p className="mt-1 text-sm">{en ? "Submit activity data and wait for manager acceptance before factor decisions." : "활동자료를 제출하고 관리자 접수가 완료된 뒤 계수를 적용할 수 있습니다."}</p><a className="mt-2 inline-block font-bold text-blue-800 underline" href={activityHref}>{en ? "Open activity data" : "활동자료 화면 열기"} →</a></div>}
      {data.acceptedSubmissionCount > 0 && !canMap && <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">{en ? "Your account does not have the calculator role for this project." : "현재 계정에 이 프로젝트의 산정 담당자 권한이 없어 계수를 변경할 수 없습니다."}</p>}
      <section className="mt-5 overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-5"><div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end"><div><h2 className="text-xl font-black text-[#052b57]">{en ? "Accepted activity factor mapping" : "접수 활동자료별 배출계수"}</h2><p className="mt-1 text-sm text-slate-600">{en ? "Select the factor per accepted row. Each change is validated and logged by the server." : "접수된 각 자료의 연료·활동량·단위·증빙을 확인한 뒤 계수를 선택하세요. 저장과 권한 검증은 서버에서 처리합니다."}</p></div><strong className="text-sm text-slate-600">{en ? `${data.sourceItems.length} rows` : `${data.sourceItems.length}건`}</strong></div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_15rem]"><label className="text-sm font-bold">{en ? "Search activity" : "활동자료 검색"}<input className="mt-1 h-10 w-full rounded border px-3 font-normal" value={query} onChange={event => setQuery(event.target.value)} placeholder={en ? "Name, category, evidence" : "자료명·구분·증빙 식별정보"}/></label><label className="text-sm font-bold">{en ? "Category" : "자료 구분"}<select className="mt-1 h-10 w-full rounded border px-3 font-normal" value={category} onChange={event => setCategory(event.target.value)}><option value="">{en ? "All categories" : "전체 구분"}</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label></div>
          {canMap && <label className="mt-3 block text-sm font-bold">{en ? "Reason for applying or changing factors" : "계수 적용·변경 사유"}<input className="mt-1 h-10 w-full rounded border px-3 font-normal" value={reason} onChange={event => setReason(event.target.value)} placeholder={en ? "Required; record the basis for this decision" : "필수 입력 · 선택 근거 또는 변경 사유를 기록하세요"}/></label>}
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-100"><tr>{(en ? ["Activity / period", "Quantity", "Evidence", "Factor and value", "Source / unit check", "Calculation preview"] : ["활동자료·기간", "활동량", "증빙 근거", "배출계수·값", "출처·단위 확인", "산정 미리보기"]).map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr className="border-t align-top" key={row.id}><td className="p-3"><strong>{row.name}</strong><small className="mt-1 block text-slate-500">{row.category} · {row.period} · #{row.submissionId}</small></td><td className="p-3 font-bold">{row.quantity} {row.unit}</td><td className="max-w-56 p-3 text-slate-700">{row.note || "—"}</td><td className="p-3"><select aria-label={`${row.name} 배출계수`} className="h-10 min-w-72 rounded border px-2" disabled={!canMap || !reason.trim() || savingId !== null} value={row.factorId || ""} onChange={event => event.target.value !== row.factorId && void map(row, event.target.value)}><option value="">{en ? "Select factor" : "배출계수 선택"}</option>{data.factors.map(factor => <option key={factor.id} value={factor.id}>{factor.name} · {factor.value} / {factor.unit}</option>)}</select>{row.decisionReason && <small className="mt-1 block max-w-72 text-slate-500">{row.mappingMethod || "—"} · {row.decisionReason}</small>}{savingId === row.id && <small role="status" className="mt-1 block text-blue-800">{en ? "Saving…" : "저장 중…"}</small>}</td><td className="p-3"><strong>{row.factorSource || "—"}</strong><small className={`mt-1 block font-bold ${row.unitMatch === false ? "text-red-700" : row.unitMatch === true ? "text-emerald-700" : "text-amber-700"}`}>{row.factorUnit ? `${row.unit} → ${row.factorUnit} · ${row.unitMatch === false ? (en ? "Mismatch" : "불일치") : row.unitMatch === true ? (en ? "Compatible" : "호환 확인") : (en ? "Check required" : "호환 확인 필요")}` : (en ? "No factor selected" : "계수 미선택")}</small>{row.confidence != null && <small className="mt-1 block text-slate-500">{en ? "Mapping confidence" : "매핑 신뢰도"}: {Math.round(Number(row.confidence) * 100)}%</small>}</td><td className="p-3 font-mono">{row.factorValue != null && row.unitMatch === true ? `${row.quantity} × ${row.factorValue} = ${(Number(row.quantity) * Number(row.factorValue)).toFixed(8)} tCO₂e` : "—"}</td></tr>)}{!rows.length && <tr><td className="p-10 text-center text-slate-600" colSpan={6}>{data.sourceItems.length ? (en ? "No rows match these filters." : "검색 조건에 맞는 자료가 없습니다.") : (en ? "No manager-accepted activity rows." : "관리자 접수가 완료된 활동자료가 없습니다.")}</td></tr>}</tbody></table></div>
      </section>
      <section className="mt-4 overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between gap-3 border-b p-5"><div><h2 className="text-lg font-black text-[#052b57]">{en ? "Available emission factor references" : "적용 가능한 배출계수 기준 목록"}</h2><p className="mt-1 text-sm text-slate-600">{en ? "Values and sources returned for this project by the calculation service." : "이 프로젝트 산정 API가 제공한 계수값과 출처입니다. 기준정보 원본 등록·개정은 관리자 업무에서 관리합니다."}</p></div><strong>{visibleFactors.length}{en ? " factors" : "개"}</strong></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-100"><tr>{(en ? ["Factor", "Category", "Value / unit", "Source"] : ["배출계수", "구분", "계수값·단위", "출처"]).map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{visibleFactors.map(factor => <tr className="border-t" key={factor.id}><td className="p-3 font-bold">{factor.name}<small className="block text-slate-500">{factor.id}</small></td><td className="p-3">{factor.category || "—"}</td><td className="p-3">{factor.value} / {factor.unit}</td><td className="p-3">{factor.source || "—"}</td></tr>)}{!visibleFactors.length && <tr><td className="p-8 text-center text-slate-600" colSpan={4}>{data.factors.length ? (en ? "No factors match this search." : "검색 결과가 없습니다.") : (en ? "No factor references are currently available for this project." : "이 프로젝트에서 조회 가능한 배출계수가 없습니다.")}</td></tr>}</tbody></table></div>
      </section>
      <div className="mt-5 flex flex-wrap justify-between gap-3"><details className="min-w-[18rem] flex-1 rounded-xl border bg-white p-4"><summary className="cursor-pointer font-black text-[#052b57]">{en ? "Work guide and checks" : "업무 도움말·검수 기준"}</summary><ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700"><li>{en ? "Select the correct project and period." : "프로젝트와 산정기간을 먼저 확인합니다."}</li><li>{en ? "Compare activity, unit, factor source, and effective scope." : "활동자료·단위·계수 출처와 적용 범위를 대조합니다."}</li><li>{en ? "Enter a decision reason, save the factor, then reload to confirm." : "선택 사유를 입력하고 저장한 뒤 새로고침해 적용값을 확인합니다."}</li><li>{en ? "Resolve missing factors and unit mismatches before calculating." : "미매핑과 단위 불일치를 해소한 뒤 산정을 진행합니다."}</li></ol></details><a className="inline-flex min-h-11 items-center rounded-lg border border-blue-800 bg-white px-5 font-black text-blue-900" href={calcHref}>{en ? "Continue to calculation" : "배출량 산정으로 이동"} →</a></div>
      <details className="mt-3 rounded-xl border bg-white p-4"><summary className="cursor-pointer font-black text-[#052b57]">{en ? "QA checks" : "QA 검증 항목"}</summary><p className="mt-2 text-sm text-slate-700">{en ? "Confirm project scope, accepted submission, activity-to-factor mapping, factor source and value, unit compatibility, decision reason, role authorization, persistence after refresh, and calculation handoff." : "프로젝트 범위·접수 버전·활동자료별 계수·출처·값·단위 호환성·변경 사유·산정 권한·새로고침 후 저장값·산정 화면 연결을 확인합니다."}</p></details>
    </>}
  </CommonPageContainer>;
}
