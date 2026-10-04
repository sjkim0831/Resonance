import { useEffect, useState } from "react";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { compareDefinitions, type ComparisonRow, type DefinitionRow } from "./workflowComparison";

export function WorkflowDefinitionComparison() {
  const [rows, setRows] = useState<ComparisonRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  async function load() {
    setBusy(true); setRows(null); setError("");
    try {
      const read = async (url: string) => {
        const response = await fetch(url, { credentials: "include", cache: "no-store" });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error(`조회 불가: ${url} (HTTP ${response.status}). 인증 및 API 응답을 확인하세요.`);
        return response.json();
      };
      const [reference, managed] = await Promise.all([
        read(buildLocalizedPath("/home/api/emission-tasks?compact=false", "/en/home/api/emission-tasks?compact=false")),
        read(buildLocalizedPath("/admin/api/system/actor-process/dashboard/core", "/en/admin/api/system/actor-process/dashboard/core"))
      ]);
      const arrays = [reference.processCatalog, reference.processCatalogSteps, managed.processes, managed.steps];
      if (!arrays.every(Array.isArray)) throw new Error("정의 목록 필드가 누락되어 비교를 중단했습니다. 빈 목록으로 간주하지 않습니다.");
      for (const [index, items] of arrays.entries()) if (!items.every((r: DefinitionRow) => r && typeof r.processCode === "string" && r.processCode.length > 0 && (index % 2 === 0 || typeof r.stepCode === "string" && r.stepCode.length > 0))) throw new Error("정의 식별자가 누락되어 비교를 중단했습니다.");
      setRows([...compareDefinitions(reference.processCatalog, managed.processes, false), ...compareDefinitions(reference.processCatalogSteps, managed.steps, true)]);
      setCheckedAt(new Date().toLocaleString());
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  const visible = rows?.filter(r => `${r.processCode} ${r.stepCode} ${r.name}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="workflow-comparison-title">
    <h2 id="workflow-comparison-title" className="text-xl font-bold">전체 업무 보기 기준 · 프로세스·절차 관리</h2>
    <p className="my-3 text-sm text-slate-600">업무 길잡이 모달의 processCatalog/processCatalogSteps와 관리 정의를 코드로 대조합니다. 실행 큐 자체를 전역 정의로 취급하지 않습니다. 관리 전용 항목은 비활성·폐기·표시 정책을 별도 확인해야 하며 자동 삭제하지 않습니다. API 목록과 실제 모달의 추가 필터·표시 순서는 구분합니다.</p>
    <div className="flex flex-wrap gap-3"><label>코드·명칭 검색 <input className="min-h-11 rounded border px-3" value={query} onChange={e => setQuery(e.target.value)} /></label><button className="min-h-11 rounded border px-4 font-bold" disabled={busy} onClick={() => void load()}>{busy ? "대조 중…" : "양쪽 다시 조회"}</button></div>
    {error && <p role="alert" className="mt-3 text-red-700">{error} 일치 여부는 미확인입니다.</p>}
    {rows && <><p role="status" className="my-3">비교 행 {rows.length} · 일치 {rows.filter(r => r.status === "MATCH").length} · 검토 필요 {rows.filter(r => r.status !== "MATCH").length} · 조회 시각 {checkedAt}</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">전체 업무 정의와 관리자 정의 비교 결과</caption><thead><tr>{["프로세스 / 절차", "명칭", "대조 결과", "차이 필드", "관리 화면"].map(h => <th className="border-b p-3" key={h} scope="col">{h}</th>)}</tr></thead><tbody>{visible?.map((r, i) => <tr key={`${r.key}:${i}`}><td className="border-b p-3">{r.processCode}<br />{r.stepCode}</td><td className="border-b p-3">{r.name}</td><td className="border-b p-3">{r.status}</td><td className="border-b p-3">{r.differences.join(", ") || "—"}</td><td className="border-b p-3"><a className="text-blue-700 underline" href={buildLocalizedPath("/admin/system/actor-process", "/en/admin/system/actor-process") + `?tab=${r.stepCode ? "steps" : "processes"}&process=${encodeURIComponent(r.processCode)}`}>{r.stepCode ? "소속 절차 관리" : "프로세스 관리"}</a><br /><a className="text-blue-700 underline" href={buildLocalizedPath("/admin/system/process-workspace", "/en/admin/system/process-workspace") + `?processCode=${encodeURIComponent(r.processCode)}`}>작업공간</a></td></tr>)}</tbody></table></div></>}
  </section>;
}
