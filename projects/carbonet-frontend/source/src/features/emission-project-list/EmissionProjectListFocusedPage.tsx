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
  progress: number; step: string; due: string; status: "진행" | "검증" | "완료";
};

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
  const payload = payloadState.value || emptyPayload;

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  const rows = useMemo(() => PROJECTS.filter((row) => {
    const matchesKeyword = !keyword.trim() || `${row.id} ${row.name} ${row.site} ${row.owner}`.toLowerCase().includes(keyword.trim().toLowerCase());
    return matchesKeyword && (!status || row.status === status) && (!site || row.site === site);
  }), [keyword, site, status]);
  const sites = Array.from(new Set(PROJECTS.map((row) => row.site)));

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
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-[#246beb]">{en ? "Carbon Emission Management" : "탄소배출 관리"}</p><h1 className="mt-1 text-3xl font-black text-[#052b57]">{en ? "Emission Projects" : "배출량 프로젝트"}</h1><p className="mt-2 text-sm text-slate-600">{en ? "Find a project and continue its next required task." : "프로젝트를 찾아 현재 단계의 다음 업무를 진행합니다."}</p></div><a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#246beb] px-5 font-black text-white hover:bg-[#164f86]" href={buildLocalizedPath("/emission/project/create", "/en/emission/project/create")}><span className="material-symbols-outlined">add</span>{en ? "New Project" : "새 프로젝트 등록"}</a></div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_180px_210px_auto]"><label className="text-sm font-bold text-slate-700">{en ? "Search" : "검색"}<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100" onChange={(event) => setKeyword(event.target.value)} placeholder={en ? "Project, site, owner" : "프로젝트명, 사업장, 담당자"} value={keyword} /></label><label className="text-sm font-bold text-slate-700">{en ? "Status" : "상태"}<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">{en ? "All" : "전체"}</option><option value="진행">{en ? "In progress" : "진행"}</option><option value="검증">{en ? "Verification" : "검증"}</option><option value="완료">{en ? "Complete" : "완료"}</option></select></label><label className="text-sm font-bold text-slate-700">{en ? "Site" : "사업장"}<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" onChange={(event) => setSite(event.target.value)} value={site}><option value="">{en ? "All sites" : "전체 사업장"}</option>{sites.map((item) => <option key={item}>{item}</option>)}</select></label><button className="mt-auto h-11 rounded-lg border border-slate-400 bg-white px-5 font-bold hover:bg-slate-50" onClick={() => { setKeyword(""); setStatus(""); setSite(""); }} type="button">{en ? "Reset" : "초기화"}</button></div></section>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ label: en ? "All" : "전체", value: PROJECTS.length }, { label: en ? "In progress" : "진행", value: PROJECTS.filter((row) => row.status === "진행").length }, { label: en ? "Verification" : "검증", value: PROJECTS.filter((row) => row.status === "검증").length }, { label: en ? "Complete" : "완료", value: PROJECTS.filter((row) => row.status === "완료").length }].map((item) => <div className="rounded-lg border border-slate-200 bg-white px-5 py-4" key={item.label}><span className="text-sm font-bold text-slate-500">{item.label}</span><strong className="ml-3 text-xl font-black text-[#052b57]">{item.value}</strong></div>)}</div>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-black">{en ? "Project List" : "프로젝트 목록"}</h2><span className="text-sm font-bold text-slate-500">{rows.length}{en ? " projects" : "건"}</span></div><div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-5 py-4">{en ? "Project" : "프로젝트"}</th><th className="px-4 py-4">{en ? "Site / Period" : "사업장·기간"}</th><th className="px-4 py-4">Scope</th><th className="px-4 py-4">{en ? "Owner" : "담당자"}</th><th className="px-4 py-4">{en ? "Progress" : "진행률"}</th><th className="px-4 py-4">{en ? "Current Step" : "현재 단계"}</th><th className="px-4 py-4">{en ? "Due" : "마감"}</th><th className="px-4 py-4 text-center">{en ? "Action" : "업무"}</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr className="hover:bg-blue-50/40" key={row.id}><td className="px-5 py-5"><strong className="block text-[#052b57]">{row.name}</strong><span className="mt-1 block text-xs text-slate-400">{row.id}</span></td><td className="px-4 py-5"><span className="block font-bold">{row.site}</span><span className="mt-1 block text-xs text-slate-500">{row.period}</span></td><td className="px-4 py-5">{row.scope}</td><td className="px-4 py-5 font-bold">{row.owner}</td><td className="px-4 py-5"><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#246beb]" style={{ width: `${row.progress}%` }} /></div><strong>{row.progress}%</strong></div></td><td className="px-4 py-5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.status === "완료" ? "bg-emerald-100 text-emerald-700" : row.status === "검증" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700"}`}>{row.step}</span></td><td className="px-4 py-5 font-black text-slate-700">{row.due}</td><td className="px-4 py-5 text-center"><a className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#052b57] px-4 font-bold text-white hover:bg-[#246beb]" href={buildLocalizedPath(`/emission/project/detail?id=${row.id}`, `/en/emission/project/detail?id=${row.id}`)}>{en ? "Open" : "프로젝트 열기"}</a></td></tr>)}</tbody></table></div>{rows.length === 0 ? <p className="py-14 text-center text-slate-500">{en ? "No projects match the filters." : "조건에 맞는 프로젝트가 없습니다."}</p> : null}</section>
    </main>
  </div></>;
}
