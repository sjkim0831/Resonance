import { useState } from "react";

/** Controlled selection: filtering never discards a previously selected site. */
export function ParticipatingSiteGrid({ sites, selected, onChange, en = false }: {
  sites: string[]; selected: string[]; onChange: (sites: string[]) => void; en?: boolean;
}) {
  const [query, setQuery] = useState("");
  const unique = [...new Set(sites)];
  const visible = unique.filter(site => site.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const all = visible.length > 0 && visible.every(site => selected.includes(site));
  const toggle = (site: string) => onChange(selected.includes(site) ? selected.filter(value => value !== site) : [...selected, site]);
  return <section className="rounded-lg border border-slate-300 bg-white p-5" aria-label={en ? "Participating sites" : "참여 사업장"}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-bold">{en ? "Participating sites *" : "참여 사업장 *"}</h2>
      <label className="flex items-center gap-2 text-sm">{en ? "Search" : "사업장 검색"}<input className="h-10 rounded border border-slate-400 px-3" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <p className="mb-3 text-sm text-slate-600">{en ? "Select one or more sites. These sites will be used for activity data and results." : "1개 이상 선택하세요. 선택한 사업장은 배출원 설정·활동자료 입력·결과 조회에 연결됩니다."}</p>
    <div className="max-h-64 overflow-auto border-y border-slate-300">
      <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50"><tr>
        <th className="w-20 p-3"><input type="checkbox" aria-label={en ? "Select search results" : "검색 결과 전체 선택"} checked={all} disabled={!visible.length} onChange={() => onChange(all ? selected.filter(site => !visible.includes(site)) : [...new Set([...selected, ...visible])])} /></th>
        <th className="p-3">{en ? "Site name" : "사업장명"}</th>
      </tr></thead><tbody>{visible.map(site => <tr key={site} className="border-t border-slate-200"><td className="p-3"><input type="checkbox" aria-label={site} checked={selected.includes(site)} onChange={() => toggle(site)} /></td><td className="p-3"><button type="button" className="text-left" onClick={() => toggle(site)}>{site}</button></td></tr>)}
      {!visible.length && <tr><td colSpan={2} className="p-6 text-center text-slate-600">{en ? "No sites found." : "조회된 사업장이 없습니다."}</td></tr>}</tbody></table>
    </div>
    <p className="mt-3 text-sm" role="status">{en ? `${unique.length} sites · ${selected.length} selected` : `전체 ${unique.length}개 · 선택 ${selected.length}개`}</p>
  </section>;
}
