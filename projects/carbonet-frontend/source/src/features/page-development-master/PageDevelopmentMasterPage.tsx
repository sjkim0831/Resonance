import { useCallback, useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GovernanceCompressionNav } from "../admin-system/GovernanceCompressionNav";

type Row = Record<string, unknown>;
type Payload = { summary?: Row; processes?: Row[]; items?: Row[]; templateStandards?: Row[]; message?: string };
type Detail = { item?: Row; designGate?: Row; bindings?: Row[]; capabilities?: Row[]; fields?: Row[]; tests?: Row[] };
type View = "control" | "matrix" | "canvas" | "workbench";

const value = (row: Row | undefined, key: string) => {
  const raw = row?.[key];
  return raw == null ? "" : typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
};
const numberValue = (row: Row | undefined, key: string) => Number(value(row, key) || 0);
const passed = (status: string) => ["PASSED", "VERIFIED", "DEPLOYED", "CUSTOMER_READY", "CONNECTED", "APPROVED"].includes(status);
const tone = (status: string) => passed(status)
  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
  : ["IMPLEMENTED", "DESIGNED", "DEFINED"].includes(status)
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-amber-200 bg-amber-50 text-amber-800";

export function PageDevelopmentMasterPage() {
  const en = isEnglish();
  const base = buildLocalizedPath("/admin/api/system/actor-process/page-development-master", "/en/admin/api/system/actor-process/page-development-master");
  const [data, setData] = useState<Payload>({ items: [], processes: [], summary: {} });
  const [query, setQuery] = useState("");
  const [processCode, setProcessCode] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<View>("control");
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
      if (!response.ok) throw new Error(body.message || "개발 관제 데이터를 불러오지 못했습니다.");
      setData(body);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "개발 관제 데이터를 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, [base, processCode, query, status]);

  const open = useCallback(async (row: Row, nextView?: View) => {
    setSelected(row);
    setDetail(null);
    if (nextView) setView(nextView);
    try {
      const response = await fetch(`${base}/${value(row, "itemId")}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "상세 계약을 불러오지 못했습니다.");
      setDetail(body);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "상세 계약을 불러오지 못했습니다.");
    }
  }, [base]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  const items = data.items ?? [];
  useEffect(() => {
    if (!selected && items[0]) void open(items[0]);
  }, [items, open, selected]);

  const summary = data.summary ?? {};
  const cards = useMemo(() => [
    ["전체 페이지", "total"], ["고객 사용 가능", "customerReady"], ["설계 통과", "designGatePassed"],
    ["설계 차단", "designGateFailed"], ["프론트 필요", "frontendRequired"], ["백엔드 필요", "backendRequired"],
    ["테스트 필요", "testRequired"], ["메뉴 연결", "menuConnected"],
  ] as const, []);
  const tabs: Array<[View, string, string]> = [
    ["control", "개발 관제판", "전체 우선순위와 상태"],
    ["matrix", "설계·구현 매트릭스", "계약 누락 교차 검증"],
    ["canvas", "프로세스·데이터 캔버스", "선택 범위 계보"],
    ["workbench", "화면 워크벤치", "설계·미리보기·작업"],
  ];

  return <AdminPageShell
    breadcrumbs={[{ label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") }, { label: "시스템 관리" }, { label: "플랫폼 개발 관제" }]}
    title={en ? "Platform Development Control Center" : "플랫폼 개발 관제"}
  >
    <GovernanceCompressionNav activeId="actor-process" en={en} />
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white">
        <p className="text-sm font-bold text-blue-200">DESIGN → GENERATE → VERIFY → DELIVER</p>
        <h2 className="mt-1 text-2xl font-black">1천 화면을 하나의 계약과 네 가지 관점으로 관리합니다.</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-50">목록은 전체 규모를 빠르게 찾고, 매트릭스는 누락을 차단하며, 캔버스는 선택한 프로세스의 데이터 계보를 추적하고, 워크벤치는 실제 화면과 설계를 함께 검토합니다.</p>
      </section>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {cards.map(([label, key]) => <article className="rounded-xl border bg-white p-4" key={key}>
          <span className="text-xs font-bold text-slate-500">{label}</span>
          <strong className="mt-1 block text-2xl text-[#052b57]">{value(summary, key) || "0"}</strong>
        </article>)}
      </section>
      <section className="grid gap-3 rounded-2xl border bg-white p-4 lg:grid-cols-[1.3fr_1fr_0.8fr_auto]">
        <label className="text-sm font-bold text-slate-700">화면·URL·액터 검색<input className="mt-2 h-11 w-full rounded-lg border px-3" value={query} onChange={event => setQuery(event.target.value)} placeholder="화면명, URL, 액터, 프로세스" /></label>
        <label className="text-sm font-bold text-slate-700">프로세스<select className="mt-2 h-11 w-full rounded-lg border bg-white px-3" value={processCode} onChange={event => setProcessCode(event.target.value)}><option value="">전체 프로세스</option>{(data.processes ?? []).map(row => <option key={value(row, "processCode")} value={value(row, "processCode")}>{value(row, "processName")}</option>)}</select></label>
        <label className="text-sm font-bold text-slate-700">상태<select className="mt-2 h-11 w-full rounded-lg border bg-white px-3" value={status} onChange={event => setStatus(event.target.value)}><option value="">전체 상태</option><option>REVIEW_REQUIRED</option><option>PLANNED</option><option>IMPLEMENTED</option><option>VERIFIED</option><option>CUSTOMER_READY</option></select></label>
        <button type="button" onClick={() => void load()} className="min-h-11 self-end rounded-lg bg-[#246beb] px-5 font-bold text-white">{busy ? "조회 중" : "새로고침"}</button>
      </section>
      <nav className="grid gap-2 rounded-2xl border bg-white p-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="개발 관제 화면 전환">
        {tabs.map(([id, label, description]) => <button key={id} type="button" onClick={() => setView(id)} className={`rounded-xl border px-4 py-3 text-left ${view === id ? "border-[#246beb] bg-blue-50 text-[#052b57]" : "border-transparent text-slate-600 hover:bg-slate-50"}`}>
          <strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs">{description}</span>
        </button>)}
      </nav>
      {view === "control" && <ControlBoard items={items} onOpen={open} />}
      {view === "matrix" && <ContractMatrix items={items} onOpen={open} />}
      {view === "canvas" && <LineageCanvas selected={selected} detail={detail} onSelectScreen={() => setView("workbench")} />}
      {view === "workbench" && <ScreenWorkbench selected={selected} detail={detail} />}
      <TemplateCoverage rows={data.templateStandards ?? []} />
    </div>
  </AdminPageShell>;
}

function ControlBoard({ items, onOpen }: { items: Row[]; onOpen: (row: Row, view?: View) => Promise<void> }) {
  return <section className="overflow-hidden rounded-2xl border bg-white">
    <header className="flex items-center justify-between border-b bg-slate-50 px-5 py-4"><div><h3 className="font-black text-[#052b57]">전체 페이지 개발 순서</h3><p className="mt-1 text-xs text-slate-600">전체는 가벼운 목록으로 탐색하고 상세 계약은 선택할 때만 조회합니다.</p></div><strong className="rounded-full bg-slate-200 px-3 py-1 text-sm">{items.length}개</strong></header>
    <div className="overflow-x-auto"><table className="w-full min-w-[1500px] text-left text-sm"><thead className="bg-white"><tr>{["순서", "페이지·경로", "액터·프로세스", "설계", "프론트", "백엔드", "테스트", "메뉴·권한", "다음 작업"].map(head => <th className="border-b px-3 py-3 font-black text-slate-600" key={head}>{head}</th>)}</tr></thead>
      <tbody>{items.map(row => <tr className="border-b align-top hover:bg-blue-50/40" key={value(row, "itemId")}>
        <td className="px-3 py-3"><button type="button" onClick={() => void onOpen(row, "workbench")} className="rounded-lg bg-[#052b57] px-3 py-2 font-black text-white">{value(row, "sequenceNo")}</button></td>
        <td className="max-w-[310px] px-3 py-3"><button type="button" onClick={() => void onOpen(row, "workbench")} className="text-left font-black text-blue-700 hover:underline">{value(row, "screenName")}</button><code className="mt-1 block break-all text-xs text-slate-500">{value(row, "routePath")}</code></td>
        <td className="max-w-[280px] px-3 py-3 text-xs leading-5"><b>{value(row, "actorCodes") || "미연결"}</b><span className="block text-slate-600">{value(row, "processCodes") || "프로세스 미연결"} · {value(row, "processStepCount")}단계</span></td>
        <Status status={value(row, "designGateStatus")} note={`${value(row, "designGateScore")}점`} />
        <Status status={value(row, "frontendStatus")} />
        <Status status={value(row, "backendStatus")} note={`기능 ${value(row, "capabilityCount")}`} />
        <Status status={value(row, "testStatus")} />
        <td className="max-w-[250px] px-3 py-3 text-xs leading-5"><b>{value(row, "menuName") || "메뉴 미연결"}</b><span className="block text-slate-600">{value(row, "permissionCode") || "권한 미정의"}</span></td>
        <td className="max-w-[260px] px-3 py-3 text-xs leading-5 text-slate-700">{value(row, "nextAction")}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

function ContractMatrix({ items, onOpen }: { items: Row[]; onOpen: (row: Row, view?: View) => Promise<void> }) {
  const columns: Array<[string, string]> = [["actorCodes", "액터"], ["processCodes", "프로세스"], ["designGateStatus", "설계"], ["frontendStatus", "프론트"], ["backendStatus", "백엔드"], ["testStatus", "테스트"], ["menuStatus", "메뉴"], ["permissionStatus", "권한"]];
  return <section className="overflow-hidden rounded-2xl border bg-white">
    <header className="border-b bg-slate-50 px-5 py-4"><h3 className="font-black text-[#052b57]">설계·구현 계약 매트릭스</h3><p className="mt-1 text-xs text-slate-600">빈 칸과 보완 상태는 자동 생성 차단 사유입니다. 화면을 선택하면 워크벤치에서 원인을 확인합니다.</p></header>
    <div className="overflow-auto"><table className="w-full min-w-[1200px] text-left text-xs"><thead><tr>{["페이지", ...columns.map(([, label]) => label)].map(head => <th className="sticky top-0 border-b bg-white px-3 py-3 font-black" key={head}>{head}</th>)}</tr></thead><tbody>{items.map(row => <tr className="border-b hover:bg-blue-50/40" key={value(row, "itemId")}><td className="max-w-[300px] px-3 py-3"><button className="text-left font-black text-blue-700" type="button" onClick={() => void onOpen(row, "workbench")}>{value(row, "screenName")}</button><code className="block break-all text-[11px] text-slate-500">{value(row, "routePath")}</code></td>{columns.map(([key]) => { const current = value(row, key); const ok = key === "actorCodes" || key === "processCodes" ? Boolean(current) : passed(current); return <td className="px-3 py-3" key={key}><span className={`inline-flex min-w-20 justify-center rounded-full border px-2 py-1 font-bold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{current || "MISSING"}</span></td>; })}</tr>)}</tbody></table></div>
  </section>;
}

function LineageCanvas({ selected, detail, onSelectScreen }: { selected: Row | null; detail: Detail | null; onSelectScreen: () => void }) {
  if (!selected) return <Empty message="목록 또는 매트릭스에서 화면을 선택하세요." />;
  const actors = unique(detail?.bindings ?? [], "actorName");
  const steps = detail?.bindings ?? [];
  const fields = detail?.fields ?? [];
  const capabilities = detail?.capabilities ?? [];
  const nodes = [
    ...actors.slice(0, 4).map((name, index) => ({ label: name, kind: "액터", x: 30, y: 50 + index * 92 })),
    ...steps.slice(0, 6).map((row, index) => ({ label: value(row, "stepName") || value(row, "processName"), kind: "업무 단계", x: 270, y: 50 + index * 92 })),
    { label: value(selected, "screenName"), kind: "화면", x: 550, y: 142 },
    ...capabilities.slice(0, 5).map((row, index) => ({ label: value(row, "capabilityName"), kind: "API·기능", x: 830, y: 50 + index * 92 })),
    ...fields.slice(0, 5).map((row, index) => ({ label: `${value(row, "sourceTable") || "DB"} · ${value(row, "sourceColumn") || value(row, "fieldName")}`, kind: "데이터", x: 1110, y: 50 + index * 92 })),
  ];
  return <section className="overflow-hidden rounded-2xl border bg-white">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-5 py-4"><div><h3 className="font-black text-[#052b57]">프로세스·데이터 계보 캔버스</h3><p className="mt-1 text-xs text-slate-600">액터 → 업무 단계 → 화면 → API·기능 → DB 컬럼 순으로 선택 화면의 계약을 표현합니다.</p></div><button type="button" onClick={onSelectScreen} className="rounded-lg bg-[#246beb] px-4 py-2 text-sm font-bold text-white">워크벤치 열기</button></header>
    <div className="overflow-auto bg-[#f5f7fa] p-4"><div className="relative h-[620px] min-w-[1420px] rounded-xl border bg-white" style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" /></marker></defs>{nodes.slice(0, -1).map((node, index) => { const next = nodes[index + 1]; return next ? <line key={index} x1={node.x + 210} y1={node.y + 35} x2={next.x} y2={next.y + 35} stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrow)" /> : null; })}</svg>
      {nodes.map((node, index) => <article key={`${node.kind}-${index}`} className="absolute w-[210px] rounded-xl border border-blue-200 bg-white p-3 shadow-sm" style={{ left: node.x, top: node.y }}><span className="text-[11px] font-bold text-blue-600">{node.kind}</span><strong className="mt-1 block break-words text-sm text-[#052b57]">{node.label || "계약 미등록"}</strong></article>)}
    </div></div>
    <footer className="border-t px-5 py-3 text-xs text-slate-600">전체 1천 화면을 한 번에 그리지 않고 선택 범위만 렌더링하여 브라우저 성능을 유지합니다. 필드 {fields.length}개 · 기능 {capabilities.length}개 · 단계 {steps.length}개</footer>
  </section>;
}

function ScreenWorkbench({ selected, detail }: { selected: Row | null; detail: Detail | null }) {
  if (!selected) return <Empty message="검토할 화면을 선택하세요." />;
  const route = value(selected, "routePath");
  return <section className="overflow-hidden rounded-2xl border bg-white">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b bg-slate-50 px-5 py-4"><div><p className="text-xs font-bold text-blue-700">SCREEN WORKBENCH</p><h3 className="mt-1 text-lg font-black text-[#052b57]">{value(selected, "screenName")}</h3><code className="text-xs text-slate-500">{route}</code></div><div className="flex flex-wrap gap-2"><a href={`/admin/system/page-design-studio?itemId=${encodeURIComponent(value(selected, "itemId"))}`} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">설계 수정</a><a href={route} target="_blank" rel="noreferrer" className="rounded-lg bg-[#246beb] px-4 py-2 text-sm font-bold text-white">새 창에서 열기</a></div></header>
    <div className="grid min-h-[720px] xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
      <div className="border-b bg-slate-100 p-3 xl:border-b-0 xl:border-r"><div className="h-[680px] overflow-hidden rounded-xl border bg-white"><iframe title={`${value(selected, "screenName")} 미리보기`} src={route} className="h-full w-full" /></div></div>
      <aside className="space-y-4 overflow-y-auto p-4 xl:max-h-[720px]">
        {!detail ? <p className="rounded-xl bg-slate-50 p-5 text-sm font-bold">상세 계약을 불러오는 중입니다.</p> : <>
          <Gate gate={detail.designGate ?? {}} />
          <Compact title="액터·프로세스" rows={detail.bindings ?? []} primary="stepName" secondary="actorName" />
          <Compact title="기능·API" rows={detail.capabilities ?? []} primary="capabilityName" secondary="implementationStatus" />
          <Compact title="필드·DB 계보" rows={detail.fields ?? []} primary="fieldName" secondary="lineageStatus" />
          <Compact title="테스트" rows={detail.tests ?? []} primary="caseName" secondary="caseStatus" />
        </>}
      </aside>
    </div>
  </section>;
}

function Gate({ gate }: { gate: Row }) {
  const score = numberValue(gate, "score");
  return <section className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="flex items-center justify-between"><h4 className="font-black text-[#052b57]">설계 완전성</h4><span className={`rounded-full border px-3 py-1 text-xs font-bold ${tone(value(gate, "status"))}`}>{value(gate, "status") || "FAILED"} · {score}점</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-[#246beb]" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div>{value(gate, "issues") && <p className="mt-3 text-xs leading-5 text-amber-800">{value(gate, "issues")}</p>}</section>;
}

function Compact({ title, rows, primary, secondary }: { title: string; rows: Row[]; primary: string; secondary: string }) {
  return <section className="overflow-hidden rounded-xl border"><header className="flex items-center justify-between border-b bg-slate-50 px-4 py-3"><h4 className="font-black text-[#052b57]">{title}</h4><span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold">{rows.length}</span></header><div className="max-h-44 overflow-y-auto">{rows.length ? rows.map((row, index) => <div className="border-b px-4 py-3 text-xs last:border-0" key={index}><b className="block text-slate-800">{value(row, primary) || "-"}</b><span className="mt-1 block text-slate-500">{value(row, secondary) || "-"}</span></div>) : <p className="p-4 text-xs text-amber-800">등록된 계약이 없습니다.</p>}</div></section>;
}

function Status({ status, note }: { status: string; note?: string }) {
  return <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tone(status)}`}>{status || "MISSING"}</span>{note && <span className="mt-1 block text-xs text-slate-500">{note}</span>}</td>;
}

function TemplateCoverage({ rows }: { rows: Row[] }) {
  const approved = rows.filter(row => value(row, "standardStatus") === "APPROVED").length;
  return <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-[#052b57]">공통 화면 유형 승인</h3><p className="mt-1 text-xs text-slate-600">승인된 공통 유형만 대량 생성에 사용합니다.</p></div><strong className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-800">{approved} / {rows.length} 승인</strong></div></section>;
}

function Empty({ message }: { message: string }) {
  return <section className="rounded-2xl border border-dashed bg-white p-12 text-center"><strong className="text-[#052b57]">{message}</strong></section>;
}

function unique(rows: Row[], key: string) {
  return [...new Set(rows.map(row => value(row, key)).filter(Boolean))];
}
