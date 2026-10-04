import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { isEnglish } from "../../lib/navigation/runtime";
import { buildResilientCsrfHeaders } from "../../lib/api/core";

type Project = { id: string; name: string; site?: string; period?: string; status?: string };
type Stage = { id: string; label: string; included: boolean; rationale: string };
type WorkspaceRecord = { version?: number; workflowStatus?: string; payload?: Record<string, unknown> | string };

const PROJECTS_API = "/home/api/emission-projects?page=1&size=100";
const SCOPE_API = "/admin/api/admin/lca-workspaces/LCA_SCOPE";
const WRITE_AUTHORIZATION_READY = false;
const STAGES: Array<[string, string, string]> = [
  ["raw-material", "원료 채취·가공", "Raw material acquisition"],
  ["inbound-transport", "원료 운송", "Inbound transportation"],
  ["manufacturing", "제조·조립", "Manufacturing and assembly"],
  ["packaging", "포장·보관", "Packaging and storage"],
  ["distribution", "제품 유통·출하", "Distribution and delivery"],
  ["use", "제품 사용", "Product use"],
  ["end-of-life", "수거·재활용·폐기", "Collection, recycling, and disposal"],
];
const initialStages = (): Stage[] => STAGES.map(([id, ko]) => ({ id, label: ko, included: id !== "use", rationale: "" }));

function readPayload(record?: WorkspaceRecord): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}

export function EmissionLcaSystemBoundaryPage() {
  const en = isEnglish();
  const tr = useCallback((ko: string, english: string) => en ? english : ko, [en]);
  const projectUrl = en ? `/en${PROJECTS_API}` : PROJECTS_API;
  const scopeUrl = en ? `/en${SCOPE_API}` : SCOPE_API;
  const requestedId = new URLSearchParams(window.location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<WorkspaceRecord[]>([]);
  const [projectId, setProjectId] = useState(requestedId);
  const [boundaryType, setBoundaryType] = useState("CRADLE_TO_GATE");
  const [geography, setGeography] = useState("");
  const [referencePeriod, setReferencePeriod] = useState("");
  const [cutoffPercent, setCutoffPercent] = useState("1");
  const [cutoffRule, setCutoffRule] = useState("");
  const [allocationRule, setAllocationRule] = useState("물리적 인과관계 우선");
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [projectResponse, scopeResponse] = await Promise.all([
        fetch(projectUrl, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } }),
        fetch(scopeUrl, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } }),
      ]);
      const [projectBody, scopeBody] = await Promise.all([
        projectResponse.json().catch(() => ({})) as Promise<{ items?: Array<Record<string, unknown>>; message?: string }>,
        scopeResponse.json().catch(() => ({})) as Promise<{ records?: WorkspaceRecord[]; message?: string }>,
      ]);
      if (!projectResponse.ok) throw new Error(projectBody.message || tr(`프로젝트 조회 실패 (${projectResponse.status})`, `Project lookup failed (${projectResponse.status})`));
      if (!scopeResponse.ok) throw new Error(scopeBody.message || tr(`시스템 경계 권한 조회 실패 (${scopeResponse.status})`, `Could not verify system-boundary access (${scopeResponse.status})`));
      const available = (projectBody.items || []).map((item) => ({ id: String(item.id || ""), name: String(item.name || item.id || ""), site: String(item.site || ""), period: String(item.period || ""), status: String(item.status || "") })).filter((item) => item.id);
      const saved = Array.isArray(scopeBody.records) ? scopeBody.records : [];
      setProjects(available); setRecords(saved);
      const chosen = available.some((p) => p.id === projectId) ? projectId : available.some((p) => p.id === requestedId) ? requestedId : available[0]?.id || "";
      setProjectId(chosen);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("화면을 불러오지 못했습니다.", "Could not load the page.")); }
    finally { setLoading(false); }
  }, [projectId, projectUrl, requestedId, scopeUrl, tr]);

  useEffect(() => { void load(); }, [load]);
  const selected = projects.find((p) => p.id === projectId) || null;
  const saved = useMemo(() => records.find((record) => String(readPayload(record).projectId || "") === projectId), [projectId, records]);

  useEffect(() => {
    const payload = readPayload(saved);
    const source = payload.boundary && typeof payload.boundary === "object" ? payload.boundary as Record<string, unknown> : {};
    if (!saved) {
      setBoundaryType("CRADLE_TO_GATE"); setGeography(selected?.site || ""); setReferencePeriod(selected?.period || ""); setCutoffPercent("1"); setCutoffRule(""); setAllocationRule("물리적 인과관계 우선"); setStages(initialStages()); return;
    }
    setBoundaryType(String(source.type || "CRADLE_TO_GATE")); setGeography(String(source.geography || "")); setReferencePeriod(String(source.referencePeriod || ""));
    setCutoffPercent(String(source.cutoffPercent ?? "1")); setCutoffRule(String(source.cutoffRule || "")); setAllocationRule(String(source.allocationRule || ""));
    if (Array.isArray(source.stages)) setStages(STAGES.map(([id, ko, english]) => {
      const row = (source.stages as Array<Record<string, unknown>>).find((x) => x?.id === id);
      return { id, label: tr(ko, english), included: row?.included !== false, rationale: String(row?.rationale || "") };
    }));
    else setStages(initialStages().map((row) => ({ ...row, label: tr(STAGES.find(([id]) => id === row.id)?.[1] || row.label, STAGES.find(([id]) => id === row.id)?.[2] || row.label) })));
  }, [saved, selected, tr]);

  const updateStage = (id: string, patch: Partial<Stage>) => setStages((current) => current.map((stage) => stage.id === id ? { ...stage, ...patch } : stage));
  const includedCount = stages.filter((stage) => stage.included).length;
  const validate = () => {
    if (!selected) return tr("접근 가능한 프로젝트를 선택하세요.", "Select an accessible project.");
    if (!geography.trim() || !referencePeriod.trim()) return tr("평가 지역과 기준 기간을 입력하세요.", "Enter the geography and reference period.");
    if (!cutoffPercent.trim() || Number(cutoffPercent) < 0 || Number(cutoffPercent) > 100) return tr("절단 기준은 0~100%로 입력하세요.", "Cut-off must be between 0 and 100%.");
    if (!stages.some((stage) => stage.included)) return tr("최소 한 개의 생애주기 단계를 포함해야 합니다.", "Include at least one life-cycle stage.");
    if (stages.some((stage) => !stage.included && !stage.rationale.trim())) return tr("제외한 단계마다 제외 사유를 적으세요.", "Give a reason for each excluded stage.");
    if (Number(cutoffPercent) > 0 && !cutoffRule.trim()) return tr("절단 기준의 적용 방법과 근거를 적으세요.", "Describe the cut-off method and its rationale.");
    if (!allocationRule.trim()) return tr("다기능 공정의 배분 원칙을 적으세요.", "Specify an allocation rule for multifunctional processes.");
    return "";
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = validate();
    if (message) { setError(message); return; }
    setError(tr("프로젝트별 저장 권한 검사가 서버에 반영되기 전까지 저장은 잠겨 있습니다.", "Saving is disabled until project-scoped authorization is installed on the server."));
  };

  return <main id="main-content" className="min-h-[calc(100vh-15rem)] bg-[#f4f7fa] px-4 py-7 text-[var(--kr-gov-text-primary)] sm:px-6 lg:px-8" data-ui-page="lca-system-boundary" data-testid="lca-system-boundary">
    <div className="mx-auto max-w-7xl space-y-5">
      <nav aria-label={tr("현재 위치", "Breadcrumb")} className="text-sm text-slate-600"><a className="text-[var(--kr-gov-blue)] underline" href="/emission/lca?menu=H1030101">{tr("제품 LCA", "Product LCA")}</a><span className="mx-2">›</span><a className="text-[var(--kr-gov-blue)] underline" href={`/lca/product-process${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}>{tr("제품·공정 정보", "Product and process")}</a><span className="mx-2">›</span><b className="text-slate-900">{tr("시스템 경계", "System boundary")}</b></nav>
      <header className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-sm font-bold text-[var(--kr-gov-blue)]">{tr("제품 LCA · 목표와 범위", "Product LCA · Goal and scope")}</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#052b57] sm:text-3xl">{tr("시스템 경계 설정", "System boundary definition")}</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{tr("선택한 제품의 생애주기에서 평가에 포함할 공정과 제외할 공정을 정하고, 지역·기간·절단 기준·배분 원칙을 기록합니다.", "Define included and excluded life-cycle processes and record geography, period, cut-off criteria, and allocation rules.")}</p><ol className="mt-5 grid gap-2 sm:grid-cols-4">{[tr("프로젝트 선택", "Select project"), tr("제품·공정 확인", "Review product/process"), tr("경계·제외 근거", "Set boundary and exclusions"), tr("검증·다음 단계", "Validate and continue")].map((label, i) => <li key={label} className={`flex items-center gap-3 rounded-lg border p-3 ${i === 2 ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--kr-gov-blue)] text-xs font-black text-white">{i + 1}</span><span className="text-sm font-bold text-slate-700">{label}</span></li>)}</ol></header>
      {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div> : null}
      {notice ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div> : null}
      {!WRITE_AUTHORIZATION_READY ? <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{tr("저장 보호: 서버가 LCA_SCOPE의 프로젝트별 쓰기 권한을 검사하도록 반영되기 전까지 저장은 비활성화되어 있습니다.", "Saving is locked until the server enforces project-scoped write access for LCA_SCOPE.")}</div> : null}
      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><label className="block text-sm font-bold text-slate-700">{tr("대상 프로젝트", "Project")}<select value={projectId} onChange={(event) => { const value = event.target.value; setProjectId(value); const url = new URL(window.location.href); value ? url.searchParams.set("projectId", value) : url.searchParams.delete("projectId"); window.history.replaceState({}, "", url); }} disabled={loading || projects.length === 0} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3">{projects.length === 0 ? <option value="">{loading ? tr("프로젝트 조회 중…", "Loading projects…") : tr("접근 가능한 프로젝트 없음", "No accessible projects")}</option> : projects.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}</select></label><div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-bold">{tr("새로고침", "Refresh")}</button><span className="inline-flex min-h-11 items-center rounded-lg bg-blue-50 px-4 text-sm font-bold text-blue-900">{includedCount}/{stages.length} {tr("단계 포함", "stages included")}</span></div>{selected ? <p className="md:col-span-2 text-xs text-slate-500">{selected.name} · {selected.site || tr("지역 미지정", "Geography not set")} · {selected.period || tr("기간 미지정", "Period not set")}</p> : null}</section>

      <form className="space-y-5" onSubmit={submit}>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><p className="text-xs font-bold text-blue-700">01 · {tr("평가범위", "Assessment scope")}</p><h2 className="mt-1 text-lg font-black text-[#052b57]">{tr("경계 기준", "Boundary criteria")}</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-bold text-slate-700">{tr("생애주기 범위", "Life-cycle scope")}<select value={boundaryType} onChange={(e) => setBoundaryType(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3"><option value="CRADLE_TO_GATE">{tr("원료부터 제조공장 출하까지", "Cradle to gate")}</option><option value="CRADLE_TO_GRAVE">{tr("원료부터 폐기까지", "Cradle to grave")}</option><option value="CRADLE_TO_CRADLE">{tr("원료부터 재활용 순환까지", "Cradle to cradle")}</option><option value="GATE_TO_GATE">{tr("공정 구간만 평가", "Gate to gate")}</option></select></label>
          <label className="text-sm font-bold text-slate-700">{tr("평가 지역", "Geography")} *<input required value={geography} onChange={(e) => setGeography(e.target.value)} placeholder={tr("예: 대한민국, 부산 사업장", "e.g. Republic of Korea, Busan site")} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
          <label className="text-sm font-bold text-slate-700">{tr("기준 기간", "Reference period")} *<input required value={referencePeriod} onChange={(e) => setReferencePeriod(e.target.value)} placeholder="2025-01-01 ~ 2025-12-31" className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
          <label className="text-sm font-bold text-slate-700">{tr("절단 기준 (%)", "Cut-off (%)")} *<input required type="number" min="0" max="100" step="0.1" value={cutoffPercent} onChange={(e) => setCutoffPercent(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-2">{tr("절단 기준 적용 방법·근거", "Cut-off method and rationale")} *<textarea required value={cutoffRule} onChange={(e) => setCutoffRule(e.target.value)} rows={3} placeholder={tr("질량·에너지·환경영향 기여도 기준과 자료 출처, 제외 영향의 검토 방법", "State mass, energy, or impact basis, data sources, and how excluded impacts are screened.")} className="mt-1 block w-full rounded-md border border-slate-300 p-3" /></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-2">{tr("다기능 공정 배분 원칙", "Multifunctional process allocation")} *<textarea required value={allocationRule} onChange={(e) => setAllocationRule(e.target.value)} rows={3} placeholder={tr("물리적 인과관계 우선, 불가할 때 경제적 배분 및 근거 기록", "Prioritize physical causality; document economic allocation where needed.")} className="mt-1 block w-full rounded-md border border-slate-300 p-3" /></label>
        </div></section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5"><p className="text-xs font-bold text-blue-700">02 · {tr("포함·제외 판단", "Inclusion and exclusion")}</p><h2 className="mt-1 text-lg font-black text-[#052b57]">{tr("생애주기 단계별 경계", "Life-cycle stage boundaries")}</h2><p className="mt-1 text-sm text-slate-600">{tr("제외 단계는 이유를 남겨야 하며, 제품 공정 흐름과 맞는지 검토하세요.", "Provide a reason for every excluded stage and check consistency with the product process flow.")}</p></div>
          <div className="divide-y divide-slate-200">{stages.map((stage) => {
            const label = STAGES.find(([id]) => id === stage.id);
            return <article key={stage.id} className="grid gap-3 p-4 md:grid-cols-[minmax(13rem,0.8fr)_10rem_minmax(15rem,1.2fr)] md:items-center">
              <label className="flex items-center gap-3 font-bold text-slate-800"><input type="checkbox" checked={stage.included} onChange={(e) => updateStage(stage.id, { included: e.target.checked })} className="h-5 w-5 accent-blue-800" /><span>{tr(label?.[1] || stage.label, label?.[2] || stage.label)}</span></label>
              <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${stage.included ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{stage.included ? tr("경계에 포함", "Included") : tr("경계에서 제외", "Excluded")}</span>
              <label className="text-xs font-bold text-slate-600">{stage.included ? tr("공정·자료 출처·연결", "Process, data source, and link") : tr("제외 근거 (필수)", "Exclusion rationale (required)")}<input value={stage.rationale} onChange={(e) => updateStage(stage.id, { rationale: e.target.value })} required={!stage.included} placeholder={stage.included ? tr("공정명 또는 제품·공정 화면의 연결 자료", "Process or linked product/process evidence") : tr("누락 자료, 기여도, 대체 가능성 등 근거", "Missing data, contribution, or substitution rationale")} className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-medium" /></label>
            </article>;
          })}</div>
        </section>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-black text-[#052b57]">{tr("경계 검토 기준", "Boundary review checks")}</h2><ul className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2"><li>✓ {tr("기능단위와 평가 범위가 일치하는지 확인", "Check boundary consistency with the functional unit")}</li><li>✓ {tr("공정 투입·산출 흐름의 경계 통과 지점 확인", "Check process flows crossing the boundary")}</li><li>✓ {tr("제외 단계마다 사유와 절단 기준 근거 기록", "Record each exclusion and cut-off rationale")}</li><li>✓ {tr("지역·기간·배분 규칙을 데이터 범위와 일치", "Align geography, period, and allocation with data")}</li></ul></section>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm font-bold text-slate-700">{saved ? tr(`저장된 경계 · v${saved.version ?? "?"} · ${saved.workflowStatus || "DRAFT"}`, `Saved boundary · v${saved.version ?? "?"} · ${saved.workflowStatus || "DRAFT"}`) : tr("저장된 시스템 경계가 없습니다.", "No saved boundary record.")}</p><div className="flex gap-2"><a href={`/lca/product-process${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`} className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 text-sm font-bold">{tr("이전: 제품·공정", "Back: product/process")}</a><a href={`/emission/lca?menu=H1030105${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`} className="inline-flex min-h-11 items-center rounded-md border border-blue-200 px-4 text-sm font-bold text-blue-800">{tr("다음: 기능 단위", "Next: functional unit")}</a><button type="submit" disabled={!WRITE_AUTHORIZATION_READY || loading || !selected} className="min-h-11 rounded-md bg-[var(--kr-gov-blue)] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{tr("경계 저장", "Save boundary")}</button></div></section>
      </form>
      <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"><summary className="cursor-pointer font-bold text-[#052b57]">{tr("업무 안내·도움말", "Work guide and help")}</summary><div className="mt-3 grid gap-3 md:grid-cols-3"><p><b>{tr("입력", "Inputs")}</b><br />{tr("제품 공정, 평가 지역, 기준 기간, 생애주기 단계, 절단 기준, 배분 원칙", "Product process, geography, period, life-cycle stages, cut-off, and allocation")}</p><p><b>{tr("출력", "Outputs")}</b><br />{tr("프로젝트별 시스템 경계 정의와 단계 포함·제외 근거", "Project-scoped boundary definition and inclusion/exclusion rationale")}</p><p><b>{tr("다음 업무", "Next task")}</b><br />{tr("기능 단위 정의 후 인벤토리 자료 수집", "Define the functional unit, then collect inventory data")}</p></div></details>
    </div>
  </main>;
}
