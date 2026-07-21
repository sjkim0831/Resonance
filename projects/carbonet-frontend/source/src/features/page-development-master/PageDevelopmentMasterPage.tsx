import { useCallback, useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GovernanceCompressionNav } from "../admin-system/GovernanceCompressionNav";

type Row = Record<string, unknown>;
type Payload = { success?: boolean; summary?: Row; processes?: Row[]; items?: Row[]; message?: string };
type Detail = { item?: Row; designGate?: Row; bindings?: Row[]; capabilities?: Row[]; fields?: Row[]; tests?: Row[] };
const value = (row: Row | undefined, key: string) => {
  const raw = row?.[key];
  if (raw == null) return "";
  if (typeof raw === "object") return JSON.stringify(raw, null, 2);
  return String(raw);
};
const statusTone = (status: string) => status === "PASSED" || status === "VERIFIED" || status === "DEPLOYED" || status === "CUSTOMER_READY" || status === "CONNECTED"
  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
  : status === "IMPLEMENTED" || status === "DESIGNED" || status === "DEFINED"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : status.includes("REQUIRED") || status.includes("REVIEW") || status === "PLANNED" || status === "NOT_CONNECTED"
      ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-slate-50 text-slate-700 border-slate-200";

export function PageDevelopmentMasterPage() {
  const en = isEnglish();
  const base = buildLocalizedPath("/admin/api/system/actor-process/page-development-master", "/en/admin/api/system/actor-process/page-development-master");
  const [data, setData] = useState<Payload>({ items: [], processes: [], summary: {} });
  const [query, setQuery] = useState("");
  const [processCode, setProcessCode] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams({ query, processCode, status });
      const response = await fetch(`${base}?${params}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "개발 마스터 조회에 실패했습니다.");
      setData(body); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "개발 마스터 조회에 실패했습니다."); }
    finally { setBusy(false); }
  }, [base, processCode, query, status]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 180); return () => window.clearTimeout(timer); }, [load]);
  const open = async (row: Row) => {
    setSelected(row); setDetail(null);
    try {
      const response = await fetch(`${base}/${value(row, "itemId")}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "상세 조회에 실패했습니다.");
      setDetail(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "상세 조회에 실패했습니다."); }
  };
  const summary = data.summary ?? {};
  const cards = useMemo(() => [["전체 페이지", "total"], ["고객 사용 가능", "customerReady"], ["설계 게이트 통과", "designGatePassed"], ["설계 게이트 실패", "designGateFailed"], ["설계 보완", "designRequired"], ["프론트 개발", "frontendRequired"], ["백엔드 개발", "backendRequired"], ["테스트 필요", "testRequired"], ["메뉴 연결", "menuConnected"], ["권한 정의", "permissionDefined"]] as const, []);

  return <AdminPageShell breadcrumbs={[{ label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") }, { label: "시스템 관리" }, { label: "페이지 개발 마스터" }]} title={en ? "Page Development Master" : "페이지 개발 마스터"}>
    <GovernanceCompressionNav activeId="actor-process" en={en} />
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white">
        <p className="text-sm font-bold text-blue-200">SERVICE DELIVERY MASTER</p>
        <h2 className="mt-1 text-2xl font-black">사용 순서에 따라 한 페이지씩 설계·개발·검증합니다.</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-50">액터와 프로세스가 같은 화면을 여러 번 사용해도 화면은 한 번만 개발하고 관계는 모두 추적합니다. 권한은 계정의 역할과 데이터 범위를 기준으로 페이지·기능에 매핑합니다.</p>
      </section>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([label, key]) => <article className="rounded-xl border bg-white p-4" key={key}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl text-[#052b57]">{value(summary, key) || "0"}</strong></article>)}</section>
      <section className="grid gap-3 rounded-2xl border bg-white p-4 lg:grid-cols-[1.3fr_1fr_0.8fr_auto]">
        <label className="text-sm font-bold text-slate-700">화면·URL·액터 검색<input className="mt-2 h-11 w-full rounded-lg border px-3" value={query} onChange={event => setQuery(event.target.value)} placeholder="화면명, URL, 액터, 프로세스" /></label>
        <label className="text-sm font-bold text-slate-700">프로세스<select className="mt-2 h-11 w-full rounded-lg border bg-white px-3" value={processCode} onChange={event => setProcessCode(event.target.value)}><option value="">전체 프로세스</option>{(data.processes ?? []).map(row => <option key={value(row, "processCode")} value={value(row, "processCode")}>{value(row, "processName")}</option>)}</select></label>
        <label className="text-sm font-bold text-slate-700">상태<select className="mt-2 h-11 w-full rounded-lg border bg-white px-3" value={status} onChange={event => setStatus(event.target.value)}><option value="">전체 상태</option><option>REVIEW_REQUIRED</option><option>PLANNED</option><option>IMPLEMENTED</option><option>VERIFIED</option><option>CUSTOMER_READY</option></select></label>
        <button type="button" onClick={() => void load()} className="min-h-11 self-end rounded-lg bg-[#246beb] px-5 font-bold text-white">{busy ? "조회 중" : "새로고침"}</button>
      </section>
      <section className="overflow-hidden rounded-2xl border bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1900px] text-left text-sm"><thead className="bg-slate-50"><tr>{["순서","페이지·경로","액터","프로세스","개발 항목","프론트","백엔드","테스트","메뉴","권한","미리보기","다음 작업"].map(head => <th className="border-b px-3 py-3 font-black text-slate-600" key={head}>{head}</th>)}</tr></thead><tbody>{(data.items ?? []).map(row => <tr className="border-b align-top hover:bg-blue-50/40" key={value(row, "itemId")}>
        <td className="px-3 py-3"><button type="button" onClick={() => void open(row)} className="rounded-lg bg-[#052b57] px-3 py-2 font-black text-white">{value(row, "sequenceNo")}</button></td>
        <td className="max-w-[300px] px-3 py-3"><button type="button" onClick={() => void open(row)} className="text-left font-black text-blue-700 hover:underline">{value(row, "screenName")}</button><code className="mt-1 block break-all text-xs text-slate-500">{value(row, "routePath")}</code></td>
        <CellButton row={row} label={value(row, "actorCodes") || "미연결"} status={value(row, "actorCodes") ? "DEFINED" : "REVIEW_REQUIRED"} onOpen={open}/>
        <CellButton row={row} label={`${value(row, "processCodes") || "미연결"} · ${value(row, "processStepCount")}단계`} status={value(row, "processCodes") ? "DEFINED" : "REVIEW_REQUIRED"} onOpen={open}/>
        <CellButton row={row} label={`설계 ${value(row, "designStatus")} · 게이트 ${value(row, "designGateScore")}점 · ${value(row, "designGateIssues") || "문제 없음"}`} status={value(row, "designGateStatus")} onOpen={open}/>
        <CellButton row={row} label={value(row, "frontendStatus")} status={value(row, "frontendStatus")} onOpen={open}/>
        <CellButton row={row} label={`${value(row, "backendStatus")} · 기능 ${value(row, "capabilityCount")}`} status={value(row, "backendStatus")} onOpen={open}/>
        <CellButton row={row} label={value(row, "testStatus")} status={value(row, "testStatus")} onOpen={open}/>
        <CellButton row={row} label={`${value(row, "menuName") || "메뉴 미연결"}${value(row, "menuCode") ? ` (${value(row, "menuCode")})` : ""}`} status={value(row, "menuStatus")} onOpen={open}/>
        <CellButton row={row} label={`${value(row, "permissionName")} · ${value(row, "permissionCode")}`} status={value(row, "permissionStatus")} onOpen={open}/>
        <td className="px-3 py-3"><a href={value(row, "routePath")} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-blue-300 px-3 py-2 font-bold text-blue-700">화면 열기</a></td>
        <td className="max-w-[280px] px-3 py-3 text-sm leading-6 text-slate-700">{value(row, "nextAction")}</td>
      </tr>)}</tbody></table></div></section>
    </div>
    {selected && <DetailModal selected={selected} detail={detail} onClose={() => { setSelected(null); setDetail(null); }} />}
  </AdminPageShell>;
}

function CellButton({ row, label, status, onOpen }: { row: Row; label: string; status: string; onOpen: (row: Row) => Promise<void> }) {
  return <td className="max-w-[240px] px-3 py-3"><button type="button" onClick={() => void onOpen(row)} className="w-full text-left"><span className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone(status)}`}>{status}</span><span className="mt-2 block break-words text-xs leading-5 text-slate-700">{label}</span></button></td>;
}

function DetailModal({ selected, detail, onClose }: { selected: Row; detail: Detail | null; onClose: () => void }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-3" role="dialog" aria-modal="true" aria-labelledby="development-detail-title" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white p-5"><div><p className="text-sm font-bold text-blue-700">#{value(selected, "sequenceNo")} PAGE DEVELOPMENT DETAIL</p><h2 id="development-detail-title" className="mt-1 text-xl font-black text-[#052b57]">{value(selected, "screenName")}</h2><code className="text-xs text-slate-500">{value(selected, "routePath")}</code></div><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 font-bold">닫기</button></header>
    {!detail ? <p className="p-8 text-center font-bold text-slate-600">세부 계약을 불러오는 중입니다.</p> : <div className="space-y-5 p-5">
      <DesignGatePanel gate={detail.designGate ?? {}} />
      <DetailSection title="액터·프로세스·업무 단계" rows={detail.bindings ?? []} keys={[["processName","프로세스"],["stepName","단계"],["actorName","액터"],["audience","대상"],["completionContract","완료 계약"]]}/>
      <DetailSection title="백엔드·기능 계약" rows={detail.capabilities ?? []} keys={[["capabilityName","기능"],["capabilityType","유형"],["implementationStatus","상태"],["commandContract","명령 계약"],["errorContract","오류 계약"]]}/>
      <DetailSection title="화면 컬럼·DB 계보" rows={detail.fields ?? []} keys={[["fieldName","컬럼"],["controlType","컴포넌트"],["apiProperty","API 속성"],["sourceTable","DB 테이블"],["sourceColumn","DB 컬럼"],["lineageStatus","계보"]]}/>
      <DetailSection title="테스트 시나리오" rows={detail.tests ?? []} keys={[["caseName","시나리오"],["caseType","유형"],["caseStatus","상태"]]}/>
      <div className="flex flex-wrap gap-2"><a href={`/admin/system/page-design-studio?itemId=${encodeURIComponent(value(selected, "itemId"))}`} className="rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white">전문 설계 스튜디오</a><a href={value(selected, "routePath")} target="_blank" rel="noreferrer" className="rounded-lg bg-[#246beb] px-4 py-3 font-bold text-white">실제 화면 미리보기</a><a href={`/admin/system/actor-process?process=${encodeURIComponent(value(selected, "processCodes").split(",")[0] || "")}`} className="rounded-lg border border-blue-300 px-4 py-3 font-bold text-blue-700">액터·프로세스에서 보기</a></div>
    </div>}
  </section></div>;
}

function DesignGatePanel({ gate }: { gate: Row }) {
  const checks = [
    ["actorPassed", "액터"], ["processPassed", "프로세스 단계"], ["contractPassed", "전문 설계 계약"],
    ["lineagePassed", "입출력 데이터 계보"], ["transitionPassed", "상태 전이"], ["authorityPassed", "권한"],
    ["versionPassed", "버전·감사"], ["exceptionPassed", "예외·복구"],
    ["adminCounterpartPassed", "관리자 대응"], ["testPassed", "독립 테스트"]
  ] as const;
  return <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-black text-[#052b57]">설계 완전성 게이트</h3><strong className={`rounded-full border px-3 py-1 text-sm ${statusTone(value(gate, "status"))}`}>{value(gate, "status") || "FAILED"} · {value(gate, "score") || "0"}점</strong></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{checks.map(([key, label]) => { const passed = value(gate, key) === "true"; return <div key={key} className={`rounded-lg border p-3 text-xs font-bold ${passed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{passed ? "통과" : "보완 필요"} · {label}</div>; })}</div>
    {value(gate, "issues") && <p className="mt-3 break-words rounded-lg bg-white p-3 text-xs font-bold text-amber-800">차단 사유: {value(gate, "issues")}</p>}
  </section>;
}

function DetailSection({ title, rows, keys }: { title: string; rows: Row[]; keys: [string, string][] }) {
  return <section className="overflow-hidden rounded-xl border"><header className="flex items-center justify-between border-b bg-slate-50 px-4 py-3"><h3 className="font-black text-[#052b57]">{title}</h3><span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold">{rows.length}</span></header>{rows.length === 0 ? <p className="p-4 text-sm text-amber-800">등록된 계약이 없습니다. 이 페이지 개발 전에 설계를 보완해야 합니다.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr>{keys.map(([, label]) => <th className="border-b px-3 py-3 text-xs font-bold text-slate-500" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-b last:border-0" key={index}>{keys.map(([key]) => <td className="max-w-[360px] break-words px-3 py-3 align-top text-xs leading-5" key={key}>{value(row, key) || "-"}</td>)}</tr>)}</tbody></table></div>}</section>;
}
