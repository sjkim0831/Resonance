import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HeaderMobileMenu, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import { HomePayload } from "../home-entry/homeEntryTypes";

type ProjectRow = {
  id: string; name: string; site: string; period: string; scope: string; owner: string;
  progress: number; step: string; due?: string; dueDate?: string; status: "진행" | "검증" | "완료";
};

type ProjectPayload = { items: ProjectRow[]; total: number; page: number; size: number; summary: Array<{ status: string; count: number }>; sites: string[] };

const PROJECTS: ProjectRow[] = [
  { id: "PRJ-2026-001", name: "2026년 정기 온실가스 배출량 산정", site: "울산 제1사업장", period: "2026.01–12", scope: "Scope 1·2", owner: "김민준", progress: 72, step: "데이터 검증", due: "D-5", status: "검증" },
  { id: "PRJ-2026-002", name: "포항 사업장 분기 배출량 관리", site: "포항 제1사업장", period: "2026 Q2", scope: "Scope 1·2·3", owner: "이서연", progress: 46, step: "활동자료 수집", due: "D-12", status: "진행" },
  { id: "PRJ-2026-003", name: "광양 공정 배출량 재산정", site: "광양 제2사업장", period: "2026.01–06", scope: "Scope 1", owner: "박지훈", progress: 88, step: "검토·승인", due: "D-2", status: "검증" },
  { id: "PRJ-2025-018", name: "2025년 연간 배출량 확정", site: "전 사업장", period: "2025.01–12", scope: "Scope 1·2·3", owner: "최유진", progress: 100, step: "보고서 완료", due: "완료", status: "완료" },
  { id: "PRJ-2026-004", name: "인천 물류센터 배출량 산정", site: "인천 물류센터", period: "2026 Q2", scope: "Scope 1·2", owner: "정도현", progress: 31, step: "증빙자료 등록", due: "D-18", status: "진행" },
  { id: "PRJ-2026-005", name: "부산 사업장 전력 사용량 검증", site: "부산 사업장", period: "2026.04–06", scope: "Scope 2", owner: "한지우", progress: 64, step: "배출량 산정", due: "D-8", status: "진행" }
];

export function EmissionProjectListMigrationPage() {
  const en = isEnglish();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const emptyPayload = useMemo<HomePayload>(() => ({ isLoggedIn: false, isEn: en, homeMenu: [] }), [en]);
  const payloadState = useAsyncValue<HomePayload>(() => fetchHomePayload(), [en], { initialValue: emptyPayload, onError: () => undefined });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [site, setSite] = useState("");
  const [pageIndex, setPageIndex] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", site: "", period: "", scope: "Scope 1·2", owner: "", dueDate: "" });
  const payload = payloadState.value || emptyPayload;
  const initialProjectPayload = useMemo<ProjectPayload>(() => ({ items: PROJECTS, total: PROJECTS.length, page: 1, size: 10, summary: [], sites: Array.from(new Set(PROJECTS.map((row) => row.site))) }), []);

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  const projectState = useAsyncValue<ProjectPayload>(async () => {
    const search = new URLSearchParams({ keyword, status, site, page: String(pageIndex) });
    const response = await fetch(`${buildLocalizedPath("/home/api/emission-projects", "/en/home/api/emission-projects")}?${search}`, { credentials: "include" });
    if (!response.ok) throw new Error(en ? "Could not load projects." : "프로젝트 목록을 불러오지 못했습니다.");
    return response.json();
  }, [en, keyword, status, site, pageIndex], { initialValue: initialProjectPayload });
  const projectData = projectState.value || { items: [], total: 0, page: 1, size: 10, summary: [], sites: [] };
  const rows = projectData.items;
  const sites = projectData.sites;
  const pageCount = Math.max(1, Math.ceil(projectData.total / 10));
  const countOf = (value: string) => Number(projectData.summary.find((item) => item.status === value)?.count || 0);

  async function saveProject() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(buildLocalizedPath("/home/api/emission-projects", "/en/home/api/emission-projects"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || (en ? "Save failed." : "저장하지 못했습니다."));
      setCreateOpen(false); setForm({ name: "", site: "", period: "", scope: "Scope 1·2", owner: "", dueDate: "" });
      await projectState.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  }

  async function deleteProject(row: ProjectRow) {
    if (!window.confirm(en ? `Delete ${row.name}?` : `‘${row.name}’ 프로젝트를 삭제하시겠습니까?`)) return;
    const response = await fetch(`${buildLocalizedPath("/home/api/emission-projects", "/en/home/api/emission-projects")}/${encodeURIComponent(row.id)}`, { method: "DELETE", credentials: "include" });
    const body = await response.json();
    if (!response.ok || !body.success) { window.alert(body.message || (en ? "Delete failed." : "삭제하지 못했습니다.")); return; }
    if (rows.length === 1 && pageIndex > 1) setPageIndex(pageIndex - 1); else await projectState.reload();
  }

  return <><HomeInlineStyles en={en} /><div className="min-h-screen bg-[#f6f8fb] text-[var(--kr-gov-text-primary)]">
    <a className="skip-link" href="#project-list-main">{content.skipLink}</a>
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-[#001e40] bg-white"><div className="mx-auto max-w-7xl px-4 lg:px-8"><div className="relative flex h-16 items-center">
      <div className="h-11 w-11 shrink-0 xl:hidden" aria-hidden="true" /><HeaderBrand content={content} en={en} /><HeaderDesktopNav en={en} homeMenu={payload.homeMenu || []} />
      <div className={`ml-auto flex shrink-0 items-center ${en ? "gap-2" : "gap-3"}`}><div className="hidden overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] xl:flex"><button className={`px-2 py-1 text-xs font-bold ${en ? "bg-white text-slate-600" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/emission/project_list")} type="button">KO</button><button className={`border-l border-slate-200 px-2 py-1 text-xs font-bold ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-slate-600"}`} onClick={() => navigate("/en/emission/project_list")} type="button">EN</button></div>
        {payload.isLoggedIn ? <button className="hidden rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-5 py-2.5 font-bold text-white xl:inline-flex" onClick={() => void session.logout()} type="button">{content.logout}</button> : <><a className="hidden rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-5 py-2.5 font-bold text-white xl:inline-flex" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a><a className="hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] px-5 py-2.5 font-bold text-[var(--kr-gov-blue)] xl:inline-flex" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a></>}
        <button aria-expanded={mobileMenuOpen} aria-label={content.openAllMenu} className="flex h-11 w-11 items-center justify-center rounded border border-slate-300 text-[var(--kr-gov-blue)] xl:hidden" onClick={() => setMobileMenuOpen(true)} type="button"><span className="material-symbols-outlined">menu</span></button>
      </div>
    </div></div></header><div className="h-16" aria-hidden="true" />
    <div className={`${mobileMenuOpen ? "" : "hidden"} fixed inset-0 z-[70] xl:hidden`}><button className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} type="button" /><HeaderMobileMenu content={content} en={en} homeMenu={payload.homeMenu || []} isLoggedIn={Boolean(payload.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={session.logout} /></div>

    <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8" id="project-list-main">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-[#246beb]">{en ? "Carbon Emission Management" : "탄소배출 관리"}</p><h1 className="mt-1 text-3xl font-black text-[#052b57]">{en ? "Emission Projects" : "배출량 프로젝트"}</h1><p className="mt-2 text-sm text-slate-600">{en ? "Find a project and continue its next required task." : "프로젝트를 찾아 현재 단계의 다음 업무를 진행합니다."}</p></div><button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#246beb] px-5 font-black text-white hover:bg-[#164f86]" onClick={() => { setMessage(""); setCreateOpen(true); }} type="button"><span className="material-symbols-outlined">add</span>{en ? "New Project" : "새 프로젝트 등록"}</button></div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_180px_210px_auto]"><label className="text-sm font-bold text-slate-700">{en ? "Search" : "검색"}<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100" onChange={(event) => setKeyword(event.target.value)} placeholder={en ? "Project, site, owner" : "프로젝트명, 사업장, 담당자"} value={keyword} /></label><label className="text-sm font-bold text-slate-700">{en ? "Status" : "상태"}<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">{en ? "All" : "전체"}</option><option value="진행">{en ? "In progress" : "진행"}</option><option value="검증">{en ? "Verification" : "검증"}</option><option value="완료">{en ? "Complete" : "완료"}</option></select></label><label className="text-sm font-bold text-slate-700">{en ? "Site" : "사업장"}<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" onChange={(event) => setSite(event.target.value)} value={site}><option value="">{en ? "All sites" : "전체 사업장"}</option>{sites.map((item) => <option key={item}>{item}</option>)}</select></label><button className="mt-auto h-11 rounded-lg border border-slate-400 bg-white px-5 font-bold hover:bg-slate-50" onClick={() => { setKeyword(""); setStatus(""); setSite(""); }} type="button">{en ? "Reset" : "초기화"}</button></div></section>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ label: en ? "All" : "전체", value: projectData.total }, { label: en ? "In progress" : "진행", value: countOf("진행") }, { label: en ? "Verification" : "검증", value: countOf("검증") }, { label: en ? "Complete" : "완료", value: countOf("완료") }].map((item) => <div className="rounded-lg border border-slate-200 bg-white px-5 py-4" key={item.label}><span className="text-sm font-bold text-slate-500">{item.label}</span><strong className="ml-3 text-xl font-black text-[#052b57]">{item.value}</strong></div>)}</div>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-black">{en ? "Project List" : "프로젝트 목록"}</h2><span className="text-sm font-bold text-slate-500">{projectData.total}{en ? " projects" : "건"}</span></div><div className="overflow-x-auto"><table className="min-w-[1120px] w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-5 py-4">{en ? "Project" : "프로젝트"}</th><th className="px-4 py-4">{en ? "Site / Period" : "사업장·기간"}</th><th className="px-4 py-4">Scope</th><th className="px-4 py-4">{en ? "Owner" : "담당자"}</th><th className="px-4 py-4">{en ? "Progress" : "진행률"}</th><th className="px-4 py-4">{en ? "Current Step" : "현재 단계"}</th><th className="px-4 py-4">{en ? "Due" : "마감"}</th><th className="px-4 py-4 text-center">{en ? "Action" : "업무"}</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr className="hover:bg-blue-50/40" key={row.id}><td className="px-5 py-5"><strong className="block text-[#052b57]">{row.name}</strong><span className="mt-1 block text-xs text-slate-400">{row.id}</span></td><td className="px-4 py-5"><span className="block font-bold">{row.site}</span><span className="mt-1 block text-xs text-slate-500">{row.period}</span></td><td className="px-4 py-5">{row.scope}</td><td className="px-4 py-5 font-bold">{row.owner}</td><td className="px-4 py-5"><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#246beb]" style={{ width: `${row.progress}%` }} /></div><strong>{row.progress}%</strong></div></td><td className="px-4 py-5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.status === "완료" ? "bg-emerald-100 text-emerald-700" : row.status === "검증" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700"}`}>{row.step}</span></td><td className="px-4 py-5 font-black text-slate-700">{row.dueDate || "-"}</td><td className="px-4 py-5"><div className="flex justify-center gap-2"><a className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#052b57] px-4 font-bold text-white hover:bg-[#246beb]" href={buildLocalizedPath(`/emission/project/detail?id=${row.id}`, `/en/emission/project/detail?id=${row.id}`)}>{en ? "Open" : "열기"}</a><button className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-300 px-3 font-bold text-red-700 hover:bg-red-50" onClick={() => void deleteProject(row)} type="button">{en ? "Delete" : "삭제"}</button></div></td></tr>)}</tbody></table></div>{projectState.loading ? <p className="py-10 text-center text-slate-500">{en ? "Loading..." : "불러오는 중입니다."}</p> : rows.length === 0 ? <p className="py-14 text-center text-slate-500">{en ? "No projects match the filters." : "조건에 맞는 프로젝트가 없습니다."}</p> : null}{pageCount > 1 ? <div className="flex justify-center gap-2 border-t border-slate-200 px-5 py-4">{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button className={`h-10 w-10 rounded-lg font-bold ${page === pageIndex ? "bg-[#246beb] text-white" : "border border-slate-300 bg-white"}`} key={page} onClick={() => setPageIndex(page)} type="button">{page}</button>)}</div> : null}</section>

      {createOpen ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"><section aria-modal="true" className="w-full max-w-2xl rounded-xl bg-white shadow-2xl" role="dialog"><header className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><h2 className="text-xl font-black text-[#052b57]">{en ? "New Emission Project" : "새 배출량 프로젝트 등록"}</h2><button aria-label={en ? "Close" : "닫기"} onClick={() => setCreateOpen(false)} type="button"><span className="material-symbols-outlined">close</span></button></header><div className="grid gap-4 p-6 sm:grid-cols-2">{([['name',en?'Project name':'프로젝트명'],['site',en?'Site':'사업장'],['period',en?'Calculation period':'산정기간'],['owner',en?'Owner':'담당자'],['dueDate',en?'Due date':'마감일']] as const).map(([key,label]) => <label className={`text-sm font-bold text-slate-700 ${key === 'name' ? 'sm:col-span-2' : ''}`} key={key}>{label}<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} type={key === 'dueDate' ? 'date' : 'text'} value={form[key]} /></label>)}<label className="text-sm font-bold text-slate-700">Scope<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value }))} value={form.scope}><option>Scope 1</option><option>Scope 2</option><option>Scope 1·2</option><option>Scope 1·2·3</option></select></label>{message ? <p className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p> : null}</div><footer className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4"><button className="min-h-11 rounded-lg border border-slate-300 px-5 font-bold" onClick={() => setCreateOpen(false)} type="button">{en ? "Cancel" : "취소"}</button><button className="min-h-11 rounded-lg bg-[#246beb] px-5 font-bold text-white disabled:opacity-50" disabled={saving} onClick={() => void saveProject()} type="button">{saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save" : "등록")}</button></footer></section></div> : null}
    </main>
  </div></>;
}
