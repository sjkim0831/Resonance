import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { isEnglish } from "../../lib/navigation/runtime";
import { buildResilientCsrfHeaders } from "../../lib/api/core";

type WorkspaceRecord = {
  workspaceId?: string;
  businessKey?: string;
  workflowStatus?: string;
  assignedActor?: string;
  version?: number;
  updatedAt?: string;
  payload?: Record<string, unknown> | string;
};

const ENDPOINT = "/admin/api/admin/lca-workspaces/LCA_PROJECT";
const STANDARDS = ["ISO 14040/14044", "ISO 14067", "GHG Protocol Product Standard", "기타"];
const statusLabels: Record<string, string> = {
  DRAFT: "작성 중", VALIDATED: "검증 완료", SUBMITTED: "검토 요청", APPROVED: "승인", REJECTED: "보완 요청"
};

function payloadOf(record: WorkspaceRecord): Record<string, unknown> {
  if (record.payload && typeof record.payload === "object") return record.payload;
  if (typeof record.payload === "string") {
    try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

function recordCommands(status: string): string[] {
  if (status === "DRAFT") return ["VALIDATE"];
  if (status === "VALIDATED") return ["SUBMIT", "REOPEN"];
  if (status === "SUBMITTED") return ["APPROVE", "REJECT"];
  if (status === "REJECTED") return ["REOPEN"];
  return [];
}

function localizedStatus(status: string, en: boolean) {
  if (!en) return statusLabels[status] || status || "상태 미지정";
  return ({ DRAFT: "Draft", VALIDATED: "Validated", SUBMITTED: "Review requested", APPROVED: "Approved", REJECTED: "Changes requested" } as Record<string, string>)[status] || status || "Not set";
}

export function EmissionLcaMigrationPage() {
  const en = isEnglish();
  const menuCode = new URLSearchParams(window.location.search).get("menu") || "H1030101";
  const isProductProcessMenu = menuCode === "H1030103";
    const isSystemBoundaryMenu = menuCode === "H1030104";
    const isFunctionalUnitMenu = menuCode === "H1030105";
    const isMaterialsMenu = menuCode === "H1030201";
    const isEnergySteamMenu = menuCode === "H1030202";
    const isTransportMenu = menuCode === "H1030203";
    const isProductsByproductsMenu = menuCode === "H1030204";
    const isWasteEmissionsMenu = menuCode === "H1030205";
    const isLciDataMappingMenu = menuCode === "H1030206";
    const isLciCalculationMenu = menuCode === "H1030301";
  const isLciaImpactAssessmentMenu = menuCode === "H1030302";
  const isProcessContributionMenu = menuCode === "H1030303";
  const isMaterialContributionMenu = menuCode === "H1030304";
  const isSensitivityAnalysisMenu = menuCode === "H1030305";
  const showStatusView = menuCode === "H1030101";
  const [records, setRecords] = useState<WorkspaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("workspaceId") || "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [businessKey, setBusinessKey] = useState("");
  const [projectName, setProjectName] = useState("");
  const [productFamily, setProductFamily] = useState("");
  const [standard, setStandard] = useState(STANDARDS[0]);
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    if (!isProductProcessMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/product-process`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isProductProcessMenu]);

  useEffect(() => {
    if (!isSystemBoundaryMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/system-boundary`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isSystemBoundaryMenu]);

  useEffect(() => {
    if (!isFunctionalUnitMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/functional-unit`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isFunctionalUnitMenu]);

  useEffect(() => {
    if (!isMaterialsMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/materials`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isMaterialsMenu]);

  useEffect(() => {
    if (!isEnergySteamMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/energy-steam`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isEnergySteamMenu]);

  useEffect(() => {
    if (!isTransportMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/transport`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isTransportMenu]);

  useEffect(() => {
    if (!isProductsByproductsMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/products-byproducts`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isProductsByproductsMenu]);

  useEffect(() => {
    if (!isWasteEmissionsMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/waste-emissions`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isWasteEmissionsMenu]);

  useEffect(() => {
    if (!isLciDataMappingMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/data-mapping`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isLciDataMappingMenu]);

  useEffect(() => {
    if (!isLciCalculationMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/calculation`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isLciCalculationMenu]);

  useEffect(() => {
    if (!isLciaImpactAssessmentMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/impact-assessment`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isLciaImpactAssessmentMenu]);

  useEffect(() => {
    if (!isProcessContributionMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/process-contribution-analysis`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isProcessContributionMenu]);

  useEffect(() => {
    if (!isMaterialContributionMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/material-contribution-analysis`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isMaterialContributionMenu]);

  useEffect(() => {
    if (!isSensitivityAnalysisMenu) return;
    const params = new URLSearchParams(window.location.search);
    const target = new URL(`${window.location.pathname.startsWith("/en/") ? "/en" : ""}/lca/sensitivity-analysis`, window.location.origin);
    const projectId = params.get("projectId");
    if (projectId) target.searchParams.set("projectId", projectId);
    window.location.replace(`${target.pathname}${target.search}`);
  }, [isSensitivityAnalysisMenu]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(ENDPOINT, {
        credentials: "include", cache: "no-store",
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
      });
      const body = await response.json().catch(() => ({})) as { records?: WorkspaceRecord[]; message?: string };
      if (!response.ok) throw new Error(body.message || `LCA 프로젝트 조회 실패 (${response.status})`);
      setRecords(Array.isArray(body.records) ? body.records : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (en ? "Could not load LCA projects." : "LCA 프로젝트를 불러오지 못했습니다."));
    } finally { setLoading(false); }
  }, [en]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return records.filter((record) => {
      const payload = payloadOf(record);
      const haystack = [record.workspaceId, record.businessKey, record.workflowStatus, payload.projectName, payload.productFamily, payload.standard]
        .map((value) => String(value || "").toLocaleLowerCase()).join(" ");
      return !needle || haystack.includes(needle);
    });
  }, [query, records]);

  const openForm = () => {
    const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8).toUpperCase() || Date.now().toString(36).toUpperCase();
    setBusinessKey(`LCA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${suffix}`);
    setProjectName(""); setProductFamily(""); setTargetDate(""); setStandard(STANDARDS[0]);
    setNotice(""); setError(""); setFormOpen(true);
  };

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!businessKey.trim() || !projectName.trim() || !productFamily.trim() || !standard || !targetDate) {
      setError(en ? "Complete all required fields." : "필수 항목을 모두 입력해 주세요."); return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST", credentials: "include",
        headers: await buildResilientCsrfHeaders({ "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }),
        body: JSON.stringify({
          businessKey: businessKey.trim(), assignedActor: "LCA_PROJECT_OWNER",
          payload: { projectName: projectName.trim(), productFamily: productFamily.trim(), standard, targetDate }
        })
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message || `LCA 프로젝트 저장 실패 (${response.status})`);
      setFormOpen(false); setNotice(en ? "LCA project saved. The server created the initial workflow version." : "LCA 프로젝트를 저장했습니다. 서버에 최초 업무 버전이 생성되었습니다.");
      await loadRecords();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (en ? "Save failed." : "저장하지 못했습니다."));
    } finally { setSaving(false); }
  };

  const executeCommand = async (record: WorkspaceRecord, command: string) => {
    if (!record.workspaceId) return;
    setError(""); setNotice("");
    try {
      const response = await fetch(`${ENDPOINT}/${encodeURIComponent(record.workspaceId)}/commands`, {
        method: "POST", credentials: "include",
        headers: await buildResilientCsrfHeaders({ "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }),
        body: JSON.stringify({ command, evidence: { screen: "emission-lca-project-hub", businessKey: record.businessKey || "" } })
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message || `상태 전이 실패 (${response.status})`);
      setNotice(en ? `Workflow action ${command} completed.` : `${command} 상태 전이를 요청했습니다.`);
      await loadRecords();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (en ? "Workflow action failed." : "상태 전이에 실패했습니다."));
    }
  };

  const count = (status: string) => records.filter((item) => item.workflowStatus === status).length;
  const tr = (ko: string, english: string) => en ? english : ko;
  const statusText = (status: string) => ({
    DRAFT: tr("프로젝트 정보 작성", "Project setup"),
    VALIDATED: tr("검토 요청 가능", "Ready for review"),
    SUBMITTED: tr("검토·승인 대기", "Review and approval"),
    APPROVED: tr("프로젝트 등록 승인", "Project approved"),
    REJECTED: tr("보완 후 재검토", "Changes requested")
  } as Record<string, string>)[status] || tr("상태 확인 필요", "Status needs review");

  if (isProductProcessMenu) return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center" role="status">
      <h1 className="text-xl font-black text-[#052b57]">{tr("제품·공정 정보 화면으로 이동합니다.", "Opening product and process information.")}</h1>
      <p className="mt-2 text-sm text-slate-600">{tr("잠시만 기다려 주세요.", "Please wait.")}</p>
    </main>
  );
    if (isSystemBoundaryMenu) return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center" role="status">
      <h1 className="text-xl font-black text-[#052b57]">{tr("시스템 경계 화면으로 이동합니다.", "Opening system boundary definition.")}</h1>
      <p className="mt-2 text-sm text-slate-600">{tr("잠시만 기다려 주세요.", "Please wait.")}</p>
    </main>
    );
  if (isFunctionalUnitMenu) return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center" role="status">
      <h1 className="text-xl font-black text-[#052b57]">{tr("기능 단위 화면으로 이동합니다.", "Opening functional unit definition.")}</h1>
      <p className="mt-2 text-sm text-slate-600">{tr("잠시만 기다려 주세요.", "Please wait.")}</p>
    </main>
  );
  if (isMaterialsMenu) return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center" role="status">
      <h1 className="text-xl font-black text-[#052b57]">{tr("원료·보조재 화면으로 이동합니다.", "Opening materials inventory.")}</h1>
      <p className="mt-2 text-sm text-slate-600">{tr("잠시만 기다려 주세요.", "Please wait.")}</p>
    </main>
  );
  if (isEnergySteamMenu) return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center" role="status">
      <h1 className="text-xl font-black text-[#052b57]">{tr("에너지·스팀 화면으로 이동합니다.", "Opening energy and steam inventory.")}</h1>
      <p className="mt-2 text-sm text-slate-600">{tr("잠시만 기다려 주세요.", "Please wait.")}</p>
    </main>
  );

  return (
    <main id="main-content" className="min-h-[calc(100vh-15rem)] bg-[#f4f7fa] px-4 py-7 text-[var(--kr-gov-text-primary)] sm:px-6 lg:px-8" data-ui-page="lca-project-hub" data-testid="lca-project-hub">
      <div className="mx-auto max-w-7xl space-y-5">
        {showStatusView ? <>
          <header className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[var(--kr-gov-blue)]">{tr("제품 LCA", "Product LCA")}</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#052b57] sm:text-3xl">{tr("LCA 현황", "LCA status")}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{tr("등록된 LCA 프로젝트의 업무 상태와 담당 액터를 확인합니다. 프로젝트 기본정보 등록과 상태 변경은 LCA 프로젝트 메뉴에서 진행합니다.", "Review workflow status and assigned actors for registered LCA projects. Create or update project records in LCA Projects.")}</p>
              </div>
              <a className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--kr-gov-blue-hover)]" href="/emission/lca?menu=H1030102">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">folder_open</span>{tr("LCA 프로젝트 관리", "Manage LCA projects")}
              </a>
            </div>
            <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label={tr("LCA 업무 흐름", "LCA workflow")}>
              {[tr("프로젝트 등록", "Project setup"), tr("범위·기능단위 정의", "Define scope and unit"), tr("담당자 검토·승인", "Review and approval"), tr("제품·공정 자료 수집", "Collect product and process data")].map((step, index) => <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3" key={step}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-slate-700">{index + 1}</span><span className="text-sm font-bold text-slate-700">{step}</span></li>)}
            </ol>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label={tr("LCA 프로젝트 상태 집계", "LCA project status totals")}>
            {[[tr("전체", "All"), records.length], [tr("작성 중", "Draft"), count("DRAFT")], [tr("검토 가능", "Ready for review"), count("VALIDATED")], [tr("검토 대기", "In review"), count("SUBMITTED")], [tr("승인", "Approved"), count("APPROVED")]].map(([label, value]) => <article className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-4 shadow-sm" key={String(label)}><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-1 text-2xl font-black text-[#052b57]">{loading ? "—" : value}</p></article>)}
          </section>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{error}</div> : null}
          {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800" role="status">{notice}</div> : null}

          <section className="overflow-hidden rounded-xl border border-[var(--kr-gov-border-light)] bg-white shadow-sm" aria-labelledby="lca-status-list-title">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 p-5">
              <div><h2 className="text-lg font-black text-[#052b57]" id="lca-status-list-title">{tr("프로젝트별 업무 현황", "Workflow status by project")}</h2><p className="mt-1 text-sm text-slate-600">{loading ? tr("서버 현황을 조회하고 있습니다.", "Loading workflow status from server.") : tr(`${records.length}건 · 서버 저장 업무 레코드`, `${records.length} persisted workflow records`)}</p></div>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-blue-200 bg-white px-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:bg-blue-50" onClick={() => void loadRecords()} type="button" disabled={loading}><span className="material-symbols-outlined text-lg" aria-hidden="true">refresh</span>{tr("현황 새로고침", "Refresh status")}</button>
            </div>
            <div className="overflow-x-auto"><table className="min-w-[700px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-600"><tr>{[tr("프로젝트", "Project"), tr("현재 업무 상태", "Current workflow status"), tr("담당 액터", "Assigned actor"), tr("버전·갱신일", "Version · updated"), tr("이동", "Open")].map((head) => <th className="px-4 py-3" key={String(head)}>{head}</th>)}</tr></thead>
              <tbody>{filtered.map((record) => {
                const payload = payloadOf(record);
                const status = String(record.workflowStatus || "");
                const target = `/emission/lca?menu=H1030102${record.workspaceId ? `&workspaceId=${encodeURIComponent(record.workspaceId)}` : ""}`;
                return <tr className="border-t border-slate-200" key={record.workspaceId || record.businessKey}>
                  <td className="px-4 py-4"><strong className="block text-[#052b57]">{String(payload.projectName || record.businessKey || "—")}</strong><span className="mt-1 block text-xs text-slate-500">{record.businessKey || "—"}</span></td>
                  <td className="px-4 py-4"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{localizedStatus(status, en)}</span><span className="mt-1 block text-xs text-slate-500">{statusText(status)}</span></td>
                  <td className="px-4 py-4">{record.assignedActor || "—"}</td>
                  <td className="px-4 py-4">v{record.version ?? "—"}<span className="mt-1 block text-xs text-slate-500">{record.updatedAt || "—"}</span></td>
                  <td className="px-4 py-4"><a className="inline-flex min-h-9 items-center rounded-md border border-blue-200 px-3 text-xs font-bold text-[var(--kr-gov-blue)] hover:bg-blue-50" href={target}>{tr("프로젝트 관리", "Project details")}</a></td>
                </tr>;
              })}
              {!loading && filtered.length === 0 ? <tr><td className="px-4 py-12 text-center" colSpan={5}><p className="font-bold text-slate-700">{error ? tr("현황을 불러오지 못했습니다.", "Could not load status.") : tr("표시할 LCA 프로젝트가 없습니다.", "No LCA projects to display.")}</p><p className="mt-2 text-sm text-slate-500">{tr("프로젝트를 등록하면 서버에 저장된 업무 상태가 여기에 표시됩니다.", "Workflow status appears here after a project is registered.")}</p><a className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--kr-gov-blue)] px-4 text-sm font-bold text-white" href="/emission/lca?menu=H1030102">{tr("LCA 프로젝트 메뉴 열기", "Open LCA Projects")}</a></td></tr> : null}
              </tbody>
            </table></div>
          </section>
        </> : <>
        <header className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[var(--kr-gov-blue)]">{tr("제품 LCA · 프로젝트 시작", "Product LCA · Project setup")}</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#052b57] sm:text-3xl">{tr("LCA 프로젝트 관리", "LCA project management")}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{tr("제품 LCA 프로젝트의 기본정보를 등록하고, 프로젝트별 담당 액터와 업무 상태를 관리합니다.", "Register product LCA project details and manage assigned actors and workflow state.")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex min-h-11 items-center gap-2 rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-[var(--kr-gov-blue)] hover:bg-blue-50" onClick={() => void loadRecords()} type="button" disabled={loading}>
                <span className="material-symbols-outlined text-lg" aria-hidden="true">refresh</span>{tr("새로고침", "Refresh")}
              </button>
              <button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--kr-gov-blue-hover)]" onClick={openForm} type="button">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">add</span>{tr("LCA 프로젝트 등록", "Register LCA project")}
              </button>
            </div>
          </div>
          <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label={tr("LCA 프로젝트 진행 절차", "LCA project workflow")}>
            {["프로젝트 등록", "범위·기능단위 정의", "담당자 검토·승인", "제품·공정 자료 수집"].map((step, index) => (
              <li className={`flex items-center gap-3 rounded-lg border p-3 ${index === 0 ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`} key={step}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-slate-600"}`}>{index + 1}</span>
                <span className="text-sm font-bold text-slate-700">{tr(step, ["Register project", "Define scope & functional unit", "Review & approve", "Collect product/process data"][index])}</span>
              </li>
            ))}
          </ol>
        </header>

        {formOpen ? <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm" aria-labelledby="lca-project-form-title">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-[#052b57]" id="lca-project-form-title">{tr("새 LCA 프로젝트 기본정보", "New LCA project")}</h2><p className="mt-1 text-sm text-slate-600">{tr("저장 후 검증·검토 요청을 통해 업무 상태를 관리합니다.", "Save a draft, then validate it and request review through the workflow.")}</p></div><button className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-700" onClick={() => setFormOpen(false)} type="button">{tr("닫기", "Close")}</button></div>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={(event) => void createProject(event)}>
            <label className="text-sm font-bold text-slate-700">{tr("프로젝트 ID", "Project ID")}<input className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3 font-medium" required value={businessKey} onChange={(event) => setBusinessKey(event.target.value)} /></label>
            <label className="text-sm font-bold text-slate-700">{tr("프로젝트명", "Project name")}<input className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3 font-medium" required value={projectName} onChange={(event) => setProjectName(event.target.value)} /></label>
            <label className="text-sm font-bold text-slate-700">{tr("제품군", "Product family")}<input className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3 font-medium" required value={productFamily} onChange={(event) => setProductFamily(event.target.value)} /></label>
            <label className="text-sm font-bold text-slate-700">{tr("적용 표준", "Applicable standard")}<select className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-medium" required value={standard} onChange={(event) => setStandard(event.target.value)}>{STANDARDS.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">{tr("목표 완료일", "Target date")}<input className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3 font-medium" required type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
            <div className="flex items-end gap-2"><button className="min-h-11 rounded-md bg-[var(--kr-gov-blue)] px-5 text-sm font-bold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? tr("저장 중…", "Saving…") : tr("초안 저장", "Save draft")}</button><span className="pb-2 text-xs text-slate-500">{tr("담당 액터: LCA 프로젝트 책임자", "Actor: LCA project owner")}</span></div>
          </form>
        </section> : null}

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{error}{/401|403/.test(error) ? <p className="mt-1 font-normal">{tr("현재 계정에 LCA 프로젝트 업무 권한이 있는지 확인하세요. 서버가 권한을 최종 검사합니다.", "Check that your account has LCA project permissions. The server remains authoritative for access checks.")}</p> : null}</div> : null}
        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800" role="status">{notice}</div> : null}

        <section className="overflow-hidden rounded-xl border border-[var(--kr-gov-border-light)] bg-white shadow-sm" aria-labelledby="lca-project-list-title">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 p-5">
            <div><h2 className="text-lg font-black text-[#052b57]" id="lca-project-list-title">{tr("등록된 LCA 프로젝트", "Registered LCA projects")}</h2><p className="mt-1 text-sm text-slate-600">{loading ? tr("서버 데이터를 조회하고 있습니다.", "Loading server records.") : tr(`조회 ${filtered.length}건 · 실제 저장 레코드`, `${filtered.length} records · persisted server data`)}</p></div>
            <label className="w-full max-w-sm text-sm font-bold text-slate-700">{tr("프로젝트 검색", "Search projects")}<input className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3 font-medium" placeholder={tr("프로젝트명, ID, 제품군", "Name, ID, or product family")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-600"><tr>{[tr("프로젝트", "Project"), tr("제품군 · 표준", "Product · standard"), tr("담당 액터", "Owner actor"), tr("상태 · 버전", "Status · version"), tr("목표 완료일", "Target date"), tr("업무", "Workflow")].map((head) => <th className="px-4 py-3" key={String(head)}>{head}</th>)}</tr></thead>
              <tbody>
                {filtered.map((record) => {
                  const payload = payloadOf(record);
                  const status = String(record.workflowStatus || "");
                  return <tr className="border-t border-slate-200 align-top" key={record.workspaceId || record.businessKey}>
                    <td className="px-4 py-4"><strong className="block text-[#052b57]">{String(payload.projectName || record.businessKey || "—")}</strong><span className="mt-1 block text-xs text-slate-500">{record.businessKey || "—"}</span></td>
                    <td className="px-4 py-4"><span className="block font-semibold">{String(payload.productFamily || "—")}</span><span className="mt-1 block text-xs text-slate-500">{String(payload.standard || "—")}</span></td>
                    <td className="px-4 py-4">{record.assignedActor || "—"}</td>
                    <td className="px-4 py-4"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{localizedStatus(status, en)}</span><span className="mt-1 block text-xs text-slate-500">v{record.version ?? "—"}</span></td>
                    <td className="px-4 py-4">{String(payload.targetDate || "—")}</td>
                    <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">{recordCommands(status).map((command) => <button className="min-h-8 rounded border border-blue-200 px-2.5 text-xs font-bold text-blue-800 hover:bg-blue-50" key={command} onClick={() => void executeCommand(record, command)} type="button">{{ VALIDATE: tr("검증", "Validate"), SUBMIT: tr("검토 요청", "Request review"), APPROVE: tr("승인", "Approve"), REJECT: tr("보완 요청", "Request changes"), REOPEN: tr("다시 열기", "Reopen") }[command]}</button>)}</div></td>
                  </tr>;
                })}
                {!loading && filtered.length === 0 ? <tr><td className="px-4 py-12 text-center" colSpan={6}><p className="font-bold text-slate-700">{query ? tr("검색 결과가 없습니다.", "No matching projects.") : tr("저장된 LCA 프로젝트가 없습니다.", "No LCA projects have been registered.")}</p><p className="mt-2 text-sm text-slate-500">{tr("프로젝트 등록 후 실제 저장 레코드가 이 목록에 표시됩니다.", "Register a project to create a server-backed record shown here.")}</p>{!query ? <button className="mt-4 min-h-10 rounded-md bg-[var(--kr-gov-blue)] px-4 text-sm font-bold text-white" onClick={openForm} type="button">{tr("첫 프로젝트 등록", "Register the first project")}</button> : null}</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-600">{tr("이 화면은 LCA_PROJECT 업무 API에서 조회한 실제 레코드만 표시합니다. 계산 결과·인증 지표·규제 일정은 해당 원장/API 연결이 확인되기 전까지 생성하지 않습니다.", "Only records returned by the LCA_PROJECT workflow API are shown. Calculation, certification, and regulatory metrics are omitted until their source APIs are verified.")}</div>
        </section>
        </>}
      </div>
    </main>
  );
}
