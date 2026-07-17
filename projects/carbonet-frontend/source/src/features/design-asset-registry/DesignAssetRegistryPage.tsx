import { useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type Row = Record<string, unknown>;
type Payload = {
  counts?: Record<string, number>;
  themes?: Row[];
  classSets?: Row[];
  sections?: Row[];
  components?: Row[];
  designs?: Row[];
  syncRuns?: Row[];
};
type Kind = "theme" | "section" | "component" | "design";

const META: Record<Kind, { ko: string; en: string; key: keyof Payload; icon: string; columns: Array<[string, string, string]> }> = {
  theme: { ko: "테마 관리", en: "Theme Management", key: "themes", icon: "palette", columns: [["themeId","테마 ID","Theme ID"],["themeName","테마명","Name"],["themeType","유형","Type"],["isDefault","기본","Default"],["isActive","활성","Active"]] },
  section: { ko: "섹션 관리", en: "Section Management", key: "sections", icon: "view_agenda", columns: [["sectionId","섹션 ID","Section ID"],["sectionName","섹션명","Name"],["sectionType","영역","Zone"],["layoutContract","레이아웃 계약","Layout contract"],["designReference","테마","Theme"]] },
  component: { ko: "컴포넌트 관리", en: "Component Management", key: "components", icon: "widgets", columns: [["componentId","컴포넌트 ID","Component ID"],["componentName","컴포넌트명","Name"],["componentType","유형","Type"],["ownerDomain","도메인","Domain"],["designReference","테마","Theme"]] },
  design: { ko: "디자인 관리", en: "Design Management", key: "designs", icon: "design_services", columns: [["designAssetId","디자인 ID","Design ID"],["pageId","화면 ID","Page ID"],["routePath","경로","Route"],["domainCode","도메인","Domain"],["layoutVersion","레이아웃 버전","Layout version"],["designTokenVersion","테마","Theme"]] },
};

function currentKind(): Kind {
  const path = window.location.pathname;
  if (path.includes("section-management")) return "section";
  if (path.includes("component-management")) return "component";
  if (path.includes("design-management")) return "design";
  return "theme";
}

export function DesignAssetRegistryPage() {
  const en = isEnglish();
  const kind = currentKind();
  const meta = META[kind];
  const [payload, setPayload] = useState<Payload>({});
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const size = 50;
  useEffect(() => {
    fetch(buildLocalizedPath("/admin/api/system/actor-process/design-assets", "/en/admin/api/system/actor-process/design-assets"), { credentials: "include" })
      .then(async response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then(value => { setPayload(value); setError(""); })
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);
  const allRows = Array.isArray(payload[meta.key]) ? payload[meta.key] as Row[] : [];
  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return term ? allRows.filter(row => Object.values(row).some(value => String(value ?? "").toLowerCase().includes(term))) : allRows;
  }, [allRows, keyword]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const rows = filtered.slice((page - 1) * size, page * size);
  const nav: Array<[Kind,string,string]> = [["theme","테마","Themes"],["section","섹션","Sections"],["component","컴포넌트","Components"],["design","디자인","Designs"]];
  const href = (target: Kind) => buildLocalizedPath(`/admin/system/${target}-management`, `/en/admin/system/${target}-management`);
  return <AdminPageShell breadcrumbs={[{label:en?"Home":"홈",href:buildLocalizedPath("/admin/","/en/admin/")},{label:en?"System":"시스템"},{label:en?meta.en:meta.ko}]} sidebarVariant="system" title={en?meta.en:meta.ko}>
    <AdminWorkspacePageFrame>
      <nav className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3" aria-label={en?"Design asset registry":"디자인 자산 레지스트리"}>{nav.map(([id,ko,labelEn])=><a className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-bold ${kind===id?"bg-[#246beb] text-white":"bg-slate-100 text-slate-700"}`} href={href(id)} key={id}><span className="material-symbols-outlined text-lg">{META[id].icon}</span>{en?labelEn:ko}</a>)}</nav>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(["themes","sections","components","designs"] as const).map(key=><div className="rounded-xl border border-slate-200 bg-white p-5" key={key}><p className="text-sm font-bold text-slate-500">{key}</p><strong className="mt-2 block text-3xl text-[#052b57]">{Number(payload.counts?.[key] ?? (Array.isArray(payload[key])?payload[key]!.length:0)).toLocaleString()}</strong></div>)}</section>
      {error?<p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-800" role="alert">{en?"Failed to load the DB asset registry: ":"DB 자산 레지스트리를 불러오지 못했습니다: "}{error}</p>:null}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><label className="w-full max-w-xl text-sm font-bold">{en?"Search registered assets":"등록 자산 검색"}<input className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3" value={keyword} onChange={event=>{setKeyword(event.target.value);setPage(1);}} placeholder={en?"ID, name, route, domain...":"ID, 이름, 경로, 도메인..."}/></label><p className="font-bold text-slate-600">{filtered.length.toLocaleString()} {en?"registered":"건 등록"}</p></div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-100"><tr>{meta.columns.map(([key,ko,labelEn])=><th className="px-4 py-3" key={key}>{en?labelEn:ko}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr className="border-t" key={String(row[meta.columns[0][0]] ?? index)}>{meta.columns.map(([key])=><td className="max-w-md break-words px-4 py-3" key={key}>{String(row[key] ?? "-")}</td>)}</tr>)}{!rows.length?<tr><td className="p-12 text-center text-slate-500" colSpan={meta.columns.length}>{en?"No registered assets.":"등록된 자산이 없습니다."}</td></tr>:null}</tbody></table></div>
        <footer className="flex items-center justify-between border-t px-5 py-4"><button className="min-h-10 rounded-lg border px-4 disabled:opacity-40" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>{en?"Previous":"이전"}</button><strong>{page} / {pageCount}</strong><button className="min-h-10 rounded-lg border px-4 disabled:opacity-40" disabled={page>=pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>{en?"Next":"다음"}</button></footer>
      </section>
      {payload.syncRuns?.[0]?<p className="text-xs text-slate-500">{en?"Latest sync":"최근 동기화"}: {String(payload.syncRuns[0].executedAt ?? "-")} · {String(payload.syncRuns[0].registeredCount ?? 0)} {en?"assets":"건"}</p>:null}
    </AdminWorkspacePageFrame>
  </AdminPageShell>;
}

export default DesignAssetRegistryPage;
