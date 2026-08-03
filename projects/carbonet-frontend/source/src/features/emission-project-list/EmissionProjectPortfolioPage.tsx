import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HeaderMobileMenu, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import type { HomePayload } from "../home-entry/homeEntryTypes";

type Project = {
  id: string;
  name: string;
  site: string;
  period: string;
  scope: string;
  owner: string;
  progress: number;
  step: string;
  due?: string;
  dueDate?: string;
  status: "진행" | "검증" | "완료";
};

type Payload = {
  items: Project[];
  total: number;
  summary: Array<{ status: string; count: number }>;
  sites: string[];
};

const FALLBACK: Project[] = [
  { id: "PRJ-2026-001", name: "2026년 정기 온실가스 배출량 산정", site: "울산 제1사업장", period: "2026.01–12", scope: "Scope 1·2", owner: "김민준", progress: 72, step: "데이터 검증", due: "D-5", status: "검증" },
  { id: "PRJ-2026-002", name: "포항 사업장 분기 배출량 관리", site: "포항 제1사업장", period: "2026 Q2", scope: "Scope 1·2·3", owner: "이서연", progress: 46, step: "활동자료 수집", due: "D-12", status: "진행" },
  { id: "PRJ-2026-003", name: "광양 공정 배출량 재산정", site: "광양 제2사업장", period: "2026.01–06", scope: "Scope 1", owner: "박지훈", progress: 88, step: "검토·승인", due: "D-2", status: "검증" },
  { id: "PRJ-2025-018", name: "2025년 연간 배출량 확정", site: "전 사업장", period: "2025.01–12", scope: "Scope 1·2·3", owner: "최유진", progress: 100, step: "보고서 완료", due: "완료", status: "완료" },
  { id: "PRJ-2026-004", name: "인천 물류센터 배출량 산정", site: "인천 물류센터", period: "2026 Q2", scope: "Scope 1·2", owner: "정도현", progress: 31, step: "증빙자료 등록", due: "D-18", status: "진행" },
];

const stepOrder = ["기본정보", "활동자료", "산정", "검증", "승인", "보고·인증"];

function stageOf(project: Project) {
  const value = project.step;
  if (project.status === "완료" || /보고서|인증/.test(value)) return 5;
  if (/승인|검토/.test(value)) return 4;
  if (/검증/.test(value)) return 3;
  if (/산정|배출계수/.test(value)) return 2;
  if (/활동|증빙|자료/.test(value)) return 1;
  return 0;
}

export function EmissionProjectPortfolioPage() {
  const en = isEnglish();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const emptyHome = useMemo<HomePayload>(() => ({ isLoggedIn: false, isEn: en, homeMenu: [] }), [en]);
  const home = useAsyncValue<HomePayload>(() => fetchHomePayload(), [en], { initialValue: emptyHome, onError: () => undefined });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [site, setSite] = useState("");
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  const initial = useMemo<Payload>(() => ({ items: FALLBACK, total: FALLBACK.length, summary: [], sites: [...new Set(FALLBACK.map((item) => item.site))] }), []);
  const state = useAsyncValue<Payload>(async () => {
    const query = new URLSearchParams({ keyword, status, site, page: "1", size: "100" });
    const response = await fetch(`${buildLocalizedPath("/home/api/emission-projects", "/en/home/api/emission-projects")}?${query}`, { credentials: "include" });
    if (!response.ok) throw new Error(en ? "Could not load the portfolio." : "프로젝트 포트폴리오를 불러오지 못했습니다.");
    return response.json();
  }, [en, keyword, status, site], { initialValue: initial });

  const data = state.value || initial;
  const projects = data.items || [];
  const active = projects.filter((item) => item.status !== "완료");
  const attention = projects.filter((item) => item.status !== "완료" && (item.progress < 50 || item.status === "검증"));
  const average = active.length ? Math.round(active.reduce((sum, item) => sum + item.progress, 0) / active.length) : 0;
  const stages = stepOrder.map((label, index) => ({ label, count: projects.filter((item) => stageOf(item) === index).length }));
  const siteRows = useMemo(() => {
    const map = new Map<string, Project[]>();
    projects.forEach((item) => map.set(item.site, [...(map.get(item.site) || []), item]));
    return [...map.entries()].map(([name, rows]) => ({ name, count: rows.length, active: rows.filter((item) => item.status !== "완료").length, progress: Math.round(rows.reduce((sum, item) => sum + item.progress, 0) / rows.length) })).sort((a, b) => b.count - a.count);
  }, [projects]);

  const text = en ? {
    eyebrow: "Carbon Emission Management", title: "Emission Project Portfolio", desc: "Monitor assigned projects, risks, milestones and deliverables, then open the next required task.",
    list: "Open project list", newProject: "New project", all: "Total projects", active: "Active", review: "Review pending", complete: "Reports completed", progress: "Average progress",
    pipeline: "Portfolio pipeline", attention: "Projects requiring attention", sites: "Site portfolio", outputs: "Report & certificate readiness", open: "Open workspace",
  } : {
    eyebrow: "탄소배출 관리", title: "배출량 프로젝트 포트폴리오", desc: "담당 프로젝트의 위험·단계·산출물을 종합 점검하고 다음 필수 업무로 바로 진입합니다.",
    list: "프로젝트 목록", newProject: "새 프로젝트", all: "전체 프로젝트", active: "진행 중", review: "검증·승인 대기", complete: "보고서 완료", progress: "평균 진행률",
    pipeline: "프로젝트 단계 현황", attention: "조치가 필요한 프로젝트", sites: "사업장 포트폴리오", outputs: "보고서·인증서 준비 현황", open: "업무공간 열기",
  };

  return <><HomeInlineStyles en={en} /><div className="min-h-screen bg-[#f4f7fb] text-[var(--kr-gov-text-primary)]">
    <a className="skip-link" href="#portfolio-main">{content.skipLink}</a>
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-[#001e40] bg-white"><div className="mx-auto max-w-7xl px-4 lg:px-8"><div className="relative flex h-16 items-center"><div className="h-11 w-11 shrink-0 xl:hidden" aria-hidden="true" /><HeaderBrand content={content} en={en} /><HeaderDesktopNav en={en} homeMenu={home.value?.homeMenu || []} /><div className="ml-auto flex items-center gap-2"><button className="hidden rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold xl:block" onClick={() => navigate(en ? "/emission/project-portfolio" : "/en/emission/project-portfolio")} type="button">{en ? "KO" : "EN"}</button>{home.value?.isLoggedIn ? <button className="hidden rounded-lg bg-[#246beb] px-4 py-2.5 font-bold text-white xl:block" onClick={() => void session.logout()} type="button">{content.logout}</button> : null}<button aria-label={content.openAllMenu} className="flex h-11 w-11 items-center justify-center rounded border border-slate-300 xl:hidden" onClick={() => setMobileMenuOpen(true)} type="button"><span className="material-symbols-outlined">menu</span></button></div></div></div></header>
    <div className="h-16" aria-hidden="true" />
    <div className={`${mobileMenuOpen ? "" : "hidden"} fixed inset-0 z-[70] xl:hidden`}><button className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} type="button" /><HeaderMobileMenu content={content} en={en} homeMenu={home.value?.homeMenu || []} isLoggedIn={Boolean(home.value?.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={session.logout} /></div>

    <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8" id="portfolio-main">
      <section className="overflow-hidden rounded-3xl bg-[#052b57] px-6 py-8 text-white shadow-xl lg:px-10"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-bold text-blue-200">{text.eyebrow}</p><h1 className="mt-2 text-3xl font-black tracking-tight lg:text-4xl">{text.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100 lg:text-base">{text.desc}</p></div><div className="flex flex-wrap gap-2"><a className="inline-flex min-h-11 items-center rounded-lg border border-white/40 px-4 font-bold hover:bg-white/10" href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>{text.list}</a><a className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 font-black text-[#052b57]" href={buildLocalizedPath("/emission/project/create", "/en/emission/project/create")}><span className="material-symbols-outlined">add</span>{text.newProject}</a></div></div></section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        [text.all, data.total || projects.length, "folder_open"], [text.active, active.length, "play_circle"], [text.review, projects.filter((item) => item.status === "검증").length, "fact_check"], [text.complete, projects.filter((item) => item.status === "완료").length, "workspace_premium"], [text.progress, `${average}%`, "monitoring"],
      ].map(([label, value, icon]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={String(label)}><span className="material-symbols-outlined text-[#246beb]">{icon}</span><span className="ml-2 text-sm font-bold text-slate-500">{label}</span><strong className="mt-3 block text-3xl font-black text-[#052b57]">{value}</strong></article>)}</section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 lg:grid-cols-[1fr_190px_220px_auto]"><label className="text-sm font-bold">{en ? "Search" : "검색"}<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" onChange={(event) => setKeyword(event.target.value)} placeholder={en ? "Project, site, owner" : "프로젝트명, 사업장, 담당자"} value={keyword} /></label><label className="text-sm font-bold">{en ? "Status" : "상태"}<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">{en ? "All" : "전체"}</option><option value="진행">{en ? "Active" : "진행"}</option><option value="검증">{en ? "Review" : "검증"}</option><option value="완료">{en ? "Complete" : "완료"}</option></select></label><label className="text-sm font-bold">{en ? "Site" : "사업장"}<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" onChange={(event) => setSite(event.target.value)} value={site}><option value="">{en ? "All sites" : "전체 사업장"}</option>{data.sites.map((item) => <option key={item}>{item}</option>)}</select></label><button className="mt-auto h-11 rounded-lg border border-slate-300 px-4 font-bold" onClick={() => { setKeyword(""); setStatus(""); setSite(""); }} type="button">{en ? "Reset" : "초기화"}</button></div></section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-[#052b57]">{text.pipeline}</h2><span className="text-sm font-bold text-slate-500">{projects.length}{en ? " projects" : "개 프로젝트"}</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{stages.map((stage, index) => <article className="relative rounded-xl border border-slate-200 bg-slate-50 p-4" key={stage.label}><span className="text-xs font-black text-[#246beb]">STEP {index + 1}</span><strong className="mt-2 block text-sm text-[#052b57]">{stage.label}</strong><span className="mt-4 block text-2xl font-black">{stage.count}</span>{index < stages.length - 1 ? <span className="material-symbols-outlined absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white text-slate-300 lg:block">chevron_right</span> : null}</article>)}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-[#052b57]">{text.outputs}</h2><div className="mt-5 space-y-4">{[[en ? "Calculation locked" : "산정 결과 확정", projects.filter((item) => item.progress >= 85).length], [en ? "Report ready" : "보고서 준비", projects.filter((item) => stageOf(item) >= 4).length], [en ? "Certificate issued" : "인증서 발급", projects.filter((item) => item.status === "완료").length]].map(([label, count], index) => <div key={String(label)}><div className="flex justify-between text-sm font-bold"><span>{label}</span><strong>{count}/{projects.length}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${index === 2 ? "bg-emerald-500" : "bg-[#246beb]"}`} style={{ width: `${projects.length ? (Number(count) / projects.length) * 100 : 0}%` }} /></div></div>)}</div></section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b px-6 py-5"><h2 className="text-xl font-black text-[#052b57]">{text.attention}</h2><span className="rounded-full bg-red-50 px-3 py-1 text-sm font-black text-red-700">{attention.length}</span></div><div className="divide-y">{attention.slice(0, 6).map((project) => <article className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center" key={project.id}><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-[#052b57]">{project.name}</strong><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{project.step}</span></div><p className="mt-1 text-sm text-slate-500">{project.site} · {project.owner} · {project.period}</p></div><div className="flex items-center gap-3"><strong className="text-sm">{project.progress}%</strong><a className="inline-flex min-h-10 items-center rounded-lg bg-[#246beb] px-4 text-sm font-bold text-white" href={buildLocalizedPath(`/emission/project/detail?id=${project.id}`, `/en/emission/project/detail?id=${project.id}`)}>{text.open}</a></div></article>)}{!attention.length ? <p className="p-8 text-center text-slate-500">{en ? "No projects require immediate action." : "즉시 조치가 필요한 프로젝트가 없습니다."}</p> : null}</div></section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b px-6 py-5"><h2 className="text-xl font-black text-[#052b57]">{text.sites}</h2></div><div className="divide-y">{siteRows.slice(0, 6).map((row) => <article className="px-6 py-4" key={row.name}><div className="flex items-center justify-between"><div><strong className="text-[#052b57]">{row.name}</strong><p className="mt-1 text-xs text-slate-500">{row.count}{en ? " total" : "개"} · {row.active}{en ? " active" : "개 진행"}</p></div><strong>{row.progress}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#246beb]" style={{ width: `${row.progress}%` }} /></div></article>)}</div></section>
      </div>
      {state.loading ? <p aria-live="polite" className="mt-5 rounded-xl bg-blue-50 p-4 text-center font-bold text-blue-800">{en ? "Loading portfolio..." : "포트폴리오를 불러오는 중입니다."}</p> : null}
      {state.error ? <div className="mt-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"><strong>{state.error}</strong><button className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white" onClick={() => void state.reload()} type="button">{en ? "Retry" : "다시 시도"}</button></div> : null}
    </main>
  </div></>;
}
