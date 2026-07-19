import { useCallback, useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

type Json = Record<string, unknown>;
type Capability = { code: string; endpoint: string; mode: string };
type Catalog = { available?: boolean; readCapabilities?: Capability[]; actionCapabilities?: Capability[]; security?: string };
const record = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const list = (value: unknown): Json[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Json[] : [];
const text = (row: Json, key: string) => String(row[key] ?? "");

const LINKS: Record<string, string> = {
  status: "/admin/system/resources", cockpit: "/admin/monitoring/center", "body-framework": "/admin/system/actor-process",
  deployments: "/admin/system/git-build-monitoring", "self-evolving": "/admin/system/builder-studio",
  "model-runtime": "/admin/system/ai-hangar", "model-hangar": "/admin/system/ai-hangar", rag: "/admin/system/ai-hangar",
  "ai-teams": "/admin/system/actor-process", "hermes-sessions": "/admin/system/hermes-workflow",
  "local-models": "/admin/system/ai-hangar", storage: "/admin/system/resources", incidents: "/admin/system/infra"
};

export function OpsCapabilityBridgePage() {
  const en = isEnglish();
  const base = buildLocalizedPath("/admin/api/system/ops-bridge", "/en/admin/api/system/ops-bridge");
  const [catalog, setCatalog] = useState<Catalog>({});
  const [active, setActive] = useState("body-framework");
  const [payload, setPayload] = useState<Json>({});
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [action, setAction] = useState("");
  const [actionBody, setActionBody] = useState("{}");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCatalog = useCallback(async () => {
    const response = await fetch(base, { credentials: "include" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Ops capability catalog failed");
    setCatalog(body);
  }, [base]);
  const load = useCallback(async (code: string) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${base}/read/${code}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Ops capability failed");
      setPayload(record(body.data)); setActive(code);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }, [base]);
  useEffect(() => { void loadCatalog().then(() => load("body-framework")).catch((reason) => setMessage(String(reason))); }, [load, loadCatalog]);

  const layers = useMemo(() => list(payload.layers), [payload]);
  const selected = layers[selectedLayer] || {};
  async function execute() {
    if (!action || !window.confirm(en ? "Execute this guarded Ops action?" : "승인된 Ops 작업을 실행하시겠습니까?")) return;
    setBusy(true); setMessage("");
    try {
      const parsed = JSON.parse(actionBody) as Json;
      const response = await fetch(`${base}/action/${action}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Ops action failed");
      setMessage(JSON.stringify(result.data, null, 2));
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  return <AdminPageShell breadcrumbs={[{ label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") }, { label: en ? "System" : "시스템 관리" }, { label: en ? "Ops Capabilities" : "Ops 통합 관제" }]} title={en ? "Resonance Ops Capability Center" : "Resonance Ops 통합 관제"}>
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white">
        <p className="text-sm font-bold text-blue-200">RESONANCE ORGANISM CONTROL PLANE</p>
        <h2 className="mt-1 text-2xl font-black">{en ? "All Ops capabilities inside the governed platform" : "분리되어 있던 /ops 기능을 관리 시스템 안에서 사용합니다"}</h2>
        <p className="mt-2 max-w-4xl text-sm text-blue-50">{en ? "Server-side tokens, an explicit allowlist, administrator sessions, and approval-required actions protect the bridge." : "토큰은 서버에만 보관하고, 허용된 기능만 관리자 세션과 승인 확인을 거쳐 실행합니다."}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label={en ? "Read capabilities" : "조회 기능"} value={catalog.readCapabilities?.length || 0}/><Metric label={en ? "Guarded actions" : "승인 실행 기능"} value={catalog.actionCapabilities?.length || 0}/><Metric label={en ? "Bridge" : "연동 상태"} value={catalog.available ? "READY" : "SETUP"}/></div>
      </section>

      {message && <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">{message}</pre>}
      <nav className="flex flex-wrap gap-2">{(catalog.readCapabilities || []).map((item) => <button className={`rounded-lg px-3 py-2 text-sm font-bold ${active === item.code ? "bg-[#246beb] text-white" : "border bg-white text-slate-700"}`} disabled={busy} key={item.code} onClick={() => void load(item.code)} type="button">{item.code}</button>)}</nav>

      {active === "body-framework" ? <section className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
        <article className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between"><div><p className="text-xs font-black text-blue-700">ARTIFICIAL BODY AI SYSTEM</p><h3 className="text-xl font-black text-[#052b57]">시스템 신체 지도</h3></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">{layers.length}계층</span></div>
          <div className="relative mx-auto mt-5 min-h-[590px] max-w-2xl">
            <svg aria-label="인공 신체 시스템 계층도" className="absolute left-1/2 top-2 h-[560px] w-56 -translate-x-1/2 text-blue-100" viewBox="0 0 220 560" role="img"><circle cx="110" cy="55" r="42" fill="currentColor"/><rect x="72" y="98" width="76" height="190" rx="38" fill="currentColor"/><rect x="28" y="112" width="42" height="230" rx="21" fill="currentColor"/><rect x="150" y="112" width="42" height="230" rx="21" fill="currentColor"/><rect x="73" y="275" width="55" height="250" rx="26" fill="currentColor"/><rect x="92" y="275" width="55" height="250" rx="26" fill="currentColor"/></svg>
            <div className="relative grid grid-cols-2 gap-x-32 gap-y-3 pt-4">{layers.map((layer, index) => <button aria-pressed={index === selectedLayer} className={`min-h-14 rounded-xl border p-3 text-left text-sm ${index === selectedLayer ? "border-[#246beb] bg-blue-50" : "bg-white hover:border-blue-300"} ${index % 2 ? "translate-y-7" : ""}`} key={`${text(layer,"order")}-${index}`} onClick={() => setSelectedLayer(index)} type="button"><strong className="block text-[#052b57]">{text(layer,"order")}. {text(layer,"name")}</strong><span className="text-xs text-slate-500">{text(layer,"domain")} · {text(layer,"status")}</span></button>)}</div>
          </div>
        </article>
        <article className="rounded-2xl border bg-white p-5"><p className="text-xs font-black text-blue-700">SELECTED ORGAN</p><h3 className="mt-1 text-xl font-black text-[#052b57]">{text(selected,"name") || "계층을 선택하세요"}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text(selected,"ops")}</p><dl className="mt-5 grid gap-3 sm:grid-cols-2"><Fact label="Domain" value={text(selected,"domain")}/><Fact label="Status" value={text(selected,"status")}/><Fact label="Signals" value={text(record(selected.coverage),"signals")}/><Fact label="Actions" value={text(record(selected.coverage),"actions")}/></dl><h4 className="mt-5 font-black text-[#052b57]">연결 팀</h4><p className="mt-2 text-sm text-slate-700">{Array.isArray(selected.teams) ? selected.teams.join(", ") : "-"}</p><a className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#246beb] px-5 font-bold text-white" href="/admin/system/actor-process">액터·프로세스 지도 열기</a></article>
      </section> : <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-black text-[#052b57]">{active}</h3><a className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-800" href={LINKS[active] || "/admin/system/infra"}>관련 Resonance 화면</a></div><pre className="mt-4 max-h-[650px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(payload, null, 2)}</pre></section>}

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-black text-amber-950">{en ? "Approval-required Ops actions" : "승인 필요 Ops 작업"}</h3><p className="mt-1 text-sm text-amber-900">{en ? "Only allowlisted operations are relayed. Review the JSON request before execution." : "허용 목록에 등록된 작업만 전달됩니다. 실행 전에 요청 JSON을 검토하세요."}</p><div className="mt-4 grid gap-3 lg:grid-cols-[240px_1fr_auto]"><select className="h-11 rounded-lg border bg-white px-3" value={action} onChange={(event) => setAction(event.target.value)}><option value="">작업 선택</option>{(catalog.actionCapabilities || []).map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select><textarea aria-label="작업 요청 JSON" className="min-h-24 rounded-lg border bg-white p-3 font-mono text-sm" onChange={(event) => setActionBody(event.target.value)} value={actionBody}/><button className="h-11 rounded-lg bg-amber-700 px-5 font-black text-white disabled:opacity-40" disabled={!action || busy} onClick={() => void execute()} type="button">검토 후 실행</button></div></section>
    </div>
  </AdminPageShell>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-white/10 p-4"><span className="text-sm text-blue-100">{label}</span><strong className="mt-1 block text-2xl">{value}</strong></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 font-bold text-slate-800">{value || "-"}</dd></div>; }
