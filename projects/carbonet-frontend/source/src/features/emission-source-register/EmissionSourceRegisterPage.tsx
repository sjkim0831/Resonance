import { useEffect, useMemo, useState } from "react";
import { CommonPageContainer } from "../../components/common-design/CommonDesignPrimitives";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type ProjectChoice = {
  id: string;
  name: string;
  site?: string;
  sites?: { id?: number; name: string }[];
  periodStart?: string;
  periodEnd?: string;
  status?: string;
  legacyPeriod?: string;
};
type ProjectList = { items?: ProjectChoice[]; total?: number; message?: string };
type SourceActivity = {
  id: number;
  name: string;
  siteName?: string;
  siteId?: number;
  category: string;
  period: string;
  quantity: number;
  unit: string;
  note?: string;
  factorId?: string;
  factorName?: string;
  mappingStatus?: string;
};
type ActivityPayload = {
  project?: { id: string; name: string; site?: string };
  sites?: { id: number; name: string }[];
  items?: SourceActivity[];
  collectionHealth?: { missingEvidenceCount?: number; invalidValueCount?: number };
  message?: string;
};

const localized = (ko: string, en: string) => buildLocalizedPath(ko, en);

export function EmissionSourceRegisterPage() {
  const en = isEnglish();
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const [projects, setProjects] = useState<ProjectChoice[]>([]);
  const [projectId, setProjectId] = useState(params.get("projectId") || "");
  const [payload, setPayload] = useState<ActivityPayload | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  const selectedProject = projects.find((project) => project.id === projectId);
  const activities = payload?.items || [];
  const siteSummary = payload?.sites?.length
    ? `${payload.sites.length}${en ? " sites" : "개 사업장"}`
    : selectedProject?.sites?.length
      ? `${selectedProject.sites.length}${en ? " sites" : "개 사업장"}`
      : selectedProject?.site || (en ? "Not specified" : "미지정");
  const unmappedCount = activities.filter((item) => !item.factorId).length;
  const missingEvidenceCount = payload?.collectionHealth?.missingEvidenceCount;

  async function loadProjects() {
    setLoadingProjects(true);
    setError("");
    try {
      const endpoint = localized(
        "/home/api/emission-projects?page=1&size=100",
        "/en/home/api/emission-projects?page=1&size=100",
      );
      const response = await fetch(endpoint, { credentials: "include", headers: { Accept: "application/json" } });
      const body = (await response.json()) as ProjectList;
      if (!response.ok) throw new Error(body.message || (en ? "Could not load accessible projects." : "접근 가능한 프로젝트를 불러오지 못했습니다."));
      const items = Array.isArray(body.items) ? body.items : [];
      setProjects(items);
      if (projectId && !items.some((item) => item.id === projectId)) setProjectId("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadActivities(id: string) {
    if (!id) {
      setPayload(null);
      return;
    }
    setLoadingData(true);
    setError("");
    try {
      const endpoint = localized(
        `/home/api/emission-projects/${encodeURIComponent(id)}/activities`,
        `/en/home/api/emission-projects/${encodeURIComponent(id)}/activities`,
      );
      const response = await fetch(endpoint, { credentials: "include", headers: { Accept: "application/json" } });
      const body = (await response.json()) as ActivityPayload;
      if (!response.ok) throw new Error(body.message || (en ? "Could not load project activity records." : "프로젝트 활동자료를 불러오지 못했습니다."));
      setPayload(body);
    } catch (reason) {
      setPayload(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => { void loadProjects(); }, []);
  useEffect(() => {
    const next = new URL(location.href);
    if (projectId) next.searchParams.set("projectId", projectId);
    else next.searchParams.delete("projectId");
    history.replaceState(history.state, "", next);
    void loadActivities(projectId);
  }, [projectId]);

  return (
    <CommonPageContainer>
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <nav className="text-sm text-slate-600" aria-label={en ? "Breadcrumb" : "현재 위치"}>
          <a className="font-bold text-blue-800 underline" href={localized("/emission/project_list", "/en/emission/project_list")}>{en ? "Emission management" : "탄소배출 관리"}</a>
          <span className="mx-2">›</span><span>{en ? "Emission sources & facilities" : "배출원·시설 관리"}</span>
        </nav>

        <header className="flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50 p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-bold text-blue-800">{en ? "Carbon emission management" : "탄소배출 관리"}</p>
            <h1 className="mt-1 text-3xl font-black text-[#052b57]">{en ? "Emission source & facility register" : "배출원·시설 관리"}</h1>
            <p className="mt-2 max-w-3xl text-slate-700">{en ? "Review project sites and recorded emission activities. Fixed equipment, meter, and calibration records require a dedicated server data contract." : "프로젝트 사업장과 등록된 배출 활동자료를 확인합니다. 고정 배출설비·계측기·교정 이력은 별도 서버 데이터 계약이 필요합니다."}</p>
          </div>
          <label className="w-full text-sm font-bold md:max-w-md">{en ? "Project" : "프로젝트 선택"}
            <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3" value={projectId} disabled={loadingProjects} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">{loadingProjects ? (en ? "Loading…" : "불러오는 중…") : (en ? "Select a project" : "프로젝트를 선택하세요")}</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.id}</option>)}
            </select>
          </label>
        </header>

        {error && <div className="rounded-lg border border-red-300 bg-red-50 p-4 font-semibold text-red-800" role="alert">{error}<button className="ml-3 underline" type="button" onClick={() => projectId ? void loadActivities(projectId) : void loadProjects()}>{en ? "Retry" : "다시 시도"}</button></div>}

        {!projectId ? (
          <section className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-[#052b57]">{en ? "Select a project to review its sources" : "배출원을 확인할 프로젝트를 선택하세요"}</h2>
            <p className="mt-2 text-slate-600">{en ? "Only projects available to your account are listed." : "현재 계정에 서버가 허용한 프로젝트만 목록에 표시됩니다."}</p>
            {!loadingProjects && projects.length === 0 && <p className="mt-5 rounded-lg bg-slate-50 p-5">{en ? "No accessible projects." : "접근 가능한 프로젝트가 없습니다."}</p>}
            {projects.length > 0 && <div className="mt-5 overflow-x-auto rounded-lg border text-left"><table className="w-full min-w-[700px]"><thead className="bg-slate-100"><tr>{(en ? ["Project", "Sites", "Period", "Action"] : ["프로젝트", "사업장", "산정 기간", "작업"]).map((item) => <th className="p-3" key={item}>{item}</th>)}</tr></thead><tbody>{projects.map((project) => <tr className="border-t" key={project.id}><td className="p-3"><strong>{project.name}</strong><small className="block text-slate-500">{project.id}</small></td><td className="p-3">{project.sites?.map((site) => site.name).join(", ") || project.site || "—"}</td><td className="p-3">{project.periodStart && project.periodEnd ? `${project.periodStart} ~ ${project.periodEnd}` : project.legacyPeriod || "—"}</td><td className="p-3"><button className="min-h-10 rounded-lg bg-[#003675] px-4 font-bold text-white" type="button" onClick={() => setProjectId(project.id)}>{en ? "Select" : "선택"}</button></td></tr>)}</tbody></table></div>}
          </section>
        ) : <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={en ? "Project source summary" : "프로젝트 배출원 요약"}>
            {[
              [en ? "Project" : "프로젝트", payload?.project?.name || selectedProject?.name || projectId],
              [en ? "Site scope" : "사업장 범위", siteSummary],
              [en ? "Activity records" : "활동자료 건수", String(activities.length)],
              [en ? "Unmapped activity" : "배출계수 미매핑", String(unmappedCount)],
            ].map(([label, value]) => <article className="rounded-xl border bg-white p-4 shadow-sm" key={label}><p className="text-sm text-slate-600">{label}</p><p className="mt-1 truncate text-xl font-black text-[#052b57]">{value}</p></article>)}
          </section>

          <section className="rounded-xl border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-xl font-black text-[#052b57]">{en ? "Project activity source ledger" : "프로젝트 배출 활동자료 원장"}</h2><p className="mt-1 text-sm text-slate-600">{en ? "These records are fetched from the project-scoped activity API; they are not fixed-asset registrations." : "프로젝트 범위 활동자료 API에서 조회한 결과입니다. 고정 자산·설비 등록 목록은 아닙니다."}</p></div>
              <div className="flex flex-wrap gap-2"><a className="inline-flex min-h-10 items-center rounded-lg border border-blue-300 px-4 font-bold text-blue-800" href={localized(`/emission/org-boundary?projectId=${encodeURIComponent(projectId)}`, `/en/emission/org-boundary?projectId=${encodeURIComponent(projectId)}`)}>{en ? "Boundary / sites" : "조직경계·사업장"}</a><a className="inline-flex min-h-10 items-center rounded-lg bg-[#003675] px-4 font-bold text-white" href={localized(`/emission/activity-data?projectId=${encodeURIComponent(projectId)}`, `/en/emission/activity-data?projectId=${encodeURIComponent(projectId)}`)}>{en ? "Open activity data" : "활동자료 열기"}</a></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left"><thead className="bg-slate-100 text-sm"><tr>{(en ? ["Emission activity", "Site", "Category", "Period", "Quantity", "Factor mapping", "Reference"] : ["배출 활동자료", "사업장", "구분", "기간", "활동량", "배출계수 매핑", "비고·참조"]).map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
                <tbody>{loadingData ? <tr><td className="p-8 text-center text-slate-600" colSpan={7}>{en ? "Loading project records…" : "프로젝트 자료를 불러오는 중입니다…"}</td></tr> : activities.map((item) => <tr className="border-t align-top" key={item.id}><td className="p-3 font-bold">{item.name}</td><td className="p-3">{item.siteName || "—"}</td><td className="p-3">{item.category || "—"}</td><td className="p-3">{item.period || "—"}</td><td className="p-3">{item.quantity} {item.unit}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.factorId ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{item.factorName || (en ? "Unmapped" : "미매핑")}</span></td><td className="p-3">{item.note || "—"}</td></tr>)}
                  {!loadingData && !activities.length && <tr><td className="p-8 text-center text-slate-600" colSpan={7}>{en ? "No activity records are registered for this project." : "이 프로젝트에 등록된 활동자료가 없습니다."}</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="border-t bg-slate-50 px-5 py-3 text-xs text-slate-600">{missingEvidenceCount === undefined ? (en ? "Evidence file completeness is checked in Activity Data." : "증빙 파일 완전성은 활동자료 화면에서 확인합니다.") : (en ? `Missing evidence files: ${missingEvidenceCount}` : `증빙 파일 누락: ${missingEvidenceCount}건`)} · {en ? "Meter/calibration records are not supplied by this API." : "계측기·교정 이력은 현재 API 제공 범위가 아닙니다."}</p>
          </section>
        </>}

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-xl border border-amber-300 bg-amber-50 p-4"><h2 className="font-black text-amber-950">{en ? "Scope limit" : "현재 구현 범위"}</h2><p className="mt-2 text-sm text-amber-950">{en ? "Project site and activity records only. No meter, fixed-source, calibration, or facility asset API was found." : "프로젝트 사업장과 활동자료 조회만 연결했습니다. 고정배출원·계측기·교정·설비자산 API는 확인되지 않았습니다."}</p></article>
          <article className="rounded-xl border bg-white p-4"><h2 className="font-black text-[#052b57]">{en ? "Next work" : "다음 업무"}</h2><p className="mt-2 text-sm text-slate-700">{en ? "Enter or verify monthly activity values and supporting evidence." : "월별 활동량과 증빙을 입력·검증합니다."}</p><a className="mt-3 inline-block font-bold text-blue-800 underline" href={localized(`/emission/activity-data?projectId=${encodeURIComponent(projectId)}`, `/en/emission/activity-data?projectId=${encodeURIComponent(projectId)}`)}>{en ? "Go to activity data" : "활동자료 처리로 이동"} →</a></article>
          <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-black text-[#052b57]">{en ? "Help / QA checks" : "화면 도움말 · QA 확인"}</summary><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700"><li>{en ? "Confirm the selected project and site boundary." : "선택한 프로젝트와 사업장 경계를 확인합니다."}</li><li>{en ? "Check activity units, period, evidence, and emission-factor mapping." : "활동자료 단위·기간·증빙·배출계수 매핑을 확인합니다."}</li><li>{en ? "Do not treat these activity rows as equipment or meter registrations." : "이 활동자료 행을 설비·계측기 등록으로 간주하지 않습니다."}</li></ul></details>
        </section>
      </main>
    </CommonPageContainer>
  );
}
