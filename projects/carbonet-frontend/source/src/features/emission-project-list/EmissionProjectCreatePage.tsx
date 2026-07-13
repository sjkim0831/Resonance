import { FormEvent, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";

const EMPTY_FORM = { name: "", site: "", period: "", scope: "Scope 1·2", owner: "", dueDate: "" };

export function EmissionProjectCreatePage() {
  const en = isEnglish();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const homeState = useAsyncValue(() => fetchHomePayload(), [en]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch(buildLocalizedPath("/home/api/emission-projects", "/en/home/api/emission-projects"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || (en ? "Could not save the project." : "프로젝트를 저장하지 못했습니다."));
      navigate(buildLocalizedPath("/emission/project_list", "/en/emission/project_list"));
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  }

  const fields = [["name", en ? "Project name" : "프로젝트명", true], ["site", en ? "Site" : "사업장", false], ["period", en ? "Calculation period" : "산정 기간", false], ["owner", en ? "Owner" : "담당자", false], ["dueDate", en ? "Due date" : "마감일", false]] as const;
  return <><HomeInlineStyles en={en} /><div className="min-h-screen bg-[#f6f8fb] text-[var(--kr-gov-text-primary)]">
    <header className="border-b-2 border-[#001e40] bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center px-4 lg:px-8"><HeaderBrand content={content} en={en} /><HeaderDesktopNav en={en} homeMenu={homeState.value?.homeMenu || []} /></div></header>
    <main className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
      <nav className="mb-5 text-sm text-slate-500"><a href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>{en ? "Emission projects" : "배출량 프로젝트"}</a><span className="mx-2">/</span><strong>{en ? "New project" : "새 프로젝트 등록"}</strong></nav>
      <p className="text-sm font-bold text-[#246beb]">{en ? "Carbon Emission Management" : "탄소배출 관리"}</p><h1 className="mt-1 text-3xl font-black text-[#052b57]">{en ? "New Emission Project" : "새 배출량 프로젝트 등록"}</h1><p className="mt-2 text-sm text-slate-600">{en ? "Enter the basic information required to begin emission management." : "배출량 자료 수집과 산정을 시작하기 위한 기본 정보를 입력합니다."}</p>
      <form className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" onSubmit={submit}><div className="grid gap-5 p-6 sm:grid-cols-2">
        {fields.map(([key,label,wide]) => <label className={`text-sm font-bold text-slate-700 ${wide ? "sm:col-span-2" : ""}`} key={key}>{label}{key === "name" ? <span className="ml-1 text-red-600">*</span> : null}<input className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 font-normal focus:border-[#246beb] focus:ring-2 focus:ring-blue-100" required={key === "name"} type={key === "dueDate" ? "date" : "text"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
        <label className="text-sm font-bold text-slate-700">Scope<select className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" value={form.scope} onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value }))}><option>Scope 1</option><option>Scope 2</option><option>Scope 1·2</option><option>Scope 1·2·3</option></select></label>
        {message ? <p className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p> : null}
      </div><footer className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5"><a className="inline-flex min-h-12 items-center rounded-lg border border-slate-300 bg-white px-6 font-bold" href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>{en ? "Cancel" : "취소"}</a><button className="min-h-12 rounded-lg bg-[#246beb] px-7 font-black text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save project" : "프로젝트 등록")}</button></footer></form>
    </main>
  </div></>;
}
