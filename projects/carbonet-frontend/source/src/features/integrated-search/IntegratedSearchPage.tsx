import { FormEvent, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { buildSearchCandidates, SearchCandidate } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import { HomePayload } from "../home-entry/homeEntryTypes";

const GROUPS = ["menu", "work", "post"] as const;
const labels = (en: boolean) => ({ menu: en ? "Menus" : "메뉴", work: en ? "Work" : "업무", post: en ? "Posts" : "게시글" });

export function IntegratedSearchPage() {
  const en = isEnglish();
  const content = en ? LOCALIZED_CONTENT.en : LOCALIZED_CONTENT.ko;
  const initial = new URLSearchParams(window.location.search).get("q") || "";
  const [draft, setDraft] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [scopes, setScopes] = useState<Record<SearchCandidate["tone"], boolean>>({ menu: true, work: true, post: true });
  const state = useAsyncValue<HomePayload>(() => fetchHomePayload(), [en], { initialValue: { isLoggedIn: false, isEn: en, homeMenu: [] }, onError: () => undefined });
  const candidates = useMemo(() => buildSearchCandidates(content, state.value?.homeMenu || [], en), [content, en, state.value?.homeMenu]);
  const needle = query.trim().toLocaleLowerCase();
  const results = useMemo(() => candidates.filter((item) => scopes[item.tone] && (!needle || `${item.label} ${item.description || ""}`.toLocaleLowerCase().includes(needle))), [candidates, needle, scopes]);
  const copy = labels(en);

  function search(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    setQuery(next);
    window.history.replaceState({}, "", `${window.location.pathname}${next ? `?q=${encodeURIComponent(next)}` : ""}`);
  }

  return <div className="min-h-screen bg-white text-slate-900">
    <header className="border-b-2 border-[#052b57] bg-white"><div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
      <button className="flex items-center gap-3 text-left" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#052b57] text-white"><span className="material-symbols-outlined">eco</span></span><span><strong className="block text-lg">{en ? "Carbon Management Platform" : "탄소중립 통합플랫폼"}</strong><span className="block text-xs text-slate-500">{en ? "Public Service" : "환경부"}</span></span></button>
      <div className="flex items-center gap-3 text-sm font-bold"><a href={buildLocalizedPath("/home", "/en/home")}>{en ? "Home" : "홈"}</a><a className="rounded-lg border border-[#246beb] px-4 py-2 text-[#164f86]" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{en ? "Sign in" : "로그인"}</a></div>
    </div></header>
    <div className="border-b border-blue-100 bg-blue-50/70"><div className="mx-auto max-w-7xl px-4 py-3 text-sm text-slate-600 lg:px-8"><a className="font-bold" href={buildLocalizedPath("/home", "/en/home")}>{en ? "Home" : "홈"}</a><span className="mx-2">›</span>{en ? "Integrated Search" : "통합검색"}</div></div>
    <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-14">
      <h1 className="text-3xl font-black tracking-tight text-[#052b57] lg:text-4xl">{en ? "Integrated Search" : "통합검색"}</h1>
      <form className="mx-auto mt-8 flex max-w-4xl gap-2" onSubmit={search}><label className="sr-only" htmlFor="integrated-search-input">{en ? "Search keyword" : "검색어"}</label><input autoFocus className="min-h-14 min-w-0 flex-1 rounded-lg border-2 border-[#246beb] px-5 text-base outline-none focus:ring-4 focus:ring-blue-100" id="integrated-search-input" onChange={(event) => setDraft(event.target.value)} placeholder={en ? "Enter a search term" : "검색어를 입력해 주세요"} value={draft} /><button className="inline-flex min-h-14 min-w-24 items-center justify-center gap-2 rounded-lg bg-[#246beb] px-6 font-black text-white hover:bg-[#164f86]" type="submit"><span className="material-symbols-outlined">search</span>{en ? "Search" : "검색"}</button></form>
      <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center gap-2 text-sm"><strong className="mr-1 text-[#052b57]">{en ? "Popular" : "인기 검색어"}</strong>{content.popularTags.map((tag) => <button className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold hover:bg-blue-50 hover:text-[#164f86]" key={tag.label} onClick={() => { const value = tag.query || tag.label; setDraft(value); setQuery(value); }} type="button">{tag.label}</button>)}</div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-lg border border-slate-200 bg-slate-50 p-5 lg:sticky lg:top-5"><h2 className="text-lg font-black text-[#052b57]">{en ? "Search Scope" : "검색 범위"}</h2><label className="mt-5 flex cursor-pointer items-center gap-3 font-bold"><input checked={GROUPS.every((key) => scopes[key])} className="h-5 w-5 accent-[#246beb]" onChange={(event) => setScopes({ menu: event.target.checked, work: event.target.checked, post: event.target.checked })} type="checkbox" />{en ? "All" : "전체"}</label>{GROUPS.map((key) => <label className="mt-4 flex cursor-pointer items-center gap-3" key={key}><input checked={scopes[key]} className="h-5 w-5 accent-[#246beb]" onChange={(event) => setScopes((current) => ({ ...current, [key]: event.target.checked }))} type="checkbox" />{copy[key]}</label>)}<button className="mt-6 w-full rounded-lg border border-slate-400 bg-white py-2.5 font-bold hover:bg-slate-100" onClick={() => { setDraft(""); setQuery(""); setScopes({ menu: true, work: true, post: true }); }} type="button">{en ? "Reset" : "초기화"}</button></aside>
        <div><p className="border-b-2 border-[#052b57] pb-4 text-xl font-black">{en ? "Search results" : "전체 검색결과"} <strong className="text-[#246beb]">{results.length}</strong>{en ? "" : "건"}</p>{state.loading ? <p className="py-16 text-center text-slate-500">{en ? "Loading search index..." : "검색 색인을 불러오는 중입니다."}</p> : GROUPS.map((tone) => { const items = results.filter((item) => item.tone === tone); return <section className="py-7" key={tone}><div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#246beb]">{{ menu: "grid_view", work: "task_alt", post: "article" }[tone]}</span><h2 className="text-xl font-black">{copy[tone]} <span className="text-[#246beb]">{items.length}</span>{en ? "" : "건"}</h2></div><div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">{items.length ? items.slice(0, 10).map((item) => <a className="group flex items-start gap-4 px-2 py-5 hover:bg-blue-50/60" href={item.href} key={`${tone}-${item.label}-${item.href}`}><span className="material-symbols-outlined mt-0.5 text-[#246beb]">{{ menu: "menu", work: "check_box", post: "description" }[tone]}</span><span className="min-w-0 flex-1"><strong className="block text-base group-hover:text-[#164f86] group-hover:underline">{item.label}</strong>{item.description ? <span className="mt-1 line-clamp-2 block text-sm leading-6 text-slate-600">{item.description}</span> : null}<span className="mt-2 block truncate text-xs text-slate-400">{item.href}</span></span><span className="material-symbols-outlined text-slate-400">chevron_right</span></a>) : <p className="py-10 text-center text-slate-500">{en ? "No matching results." : "일치하는 결과가 없습니다."}</p>}</div>{items.length > 10 ? <p className="mt-3 text-right text-sm font-bold text-[#164f86]">{en ? `${items.length - 10} more results` : `외 ${items.length - 10}건`}</p> : null}</section>; })}</div>
      </div>
    </main>
  </div>;
}
