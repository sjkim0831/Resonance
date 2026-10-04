import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { isEnglish } from "../../lib/navigation/runtime";
import { buildResilientCsrfHeaders } from "../../lib/api/core";

type Project = {
  id: string;
  name: string;
  site?: string;
  period?: string;
  status?: string;
};

type ProcessRow = {
  processId: string;
  sequence: number;
  name: string;
  site: string;
  owner: string;
  inputName: string;
  inputAmount: string;
  inputUnit: string;
  outputName: string;
  outputAmount: string;
  outputUnit: string;
  note: string;
};

type WorkspaceRecord = {
  workspaceId?: string;
  businessKey?: string;
  workflowStatus?: string;
  assignedActor?: string;
  version?: number;
  updatedAt?: string;
  payload?: Record<string, unknown> | string;
};

const PRODUCT_PROCESS_API = "/admin/api/admin/lca-workspaces/LCA_PRODUCT_PROCESS";
const PROJECTS_API = "/home/api/emission-projects?page=1&size=100";
// Keep writes disabled until project-scoped backend authorization is installed.
const PROJECT_SCOPED_SAVE_API_READY = false;
const emptyProcess = (sequence: number): ProcessRow => ({
  processId: `PROC-${String(sequence).padStart(2, "0")}`,
  sequence,
  name: "",
  site: "",
  owner: "",
  inputName: "",
  inputAmount: "",
  inputUnit: "",
  outputName: "",
  outputAmount: "",
  outputUnit: "",
  note: "",
});

function payloadOf(record: WorkspaceRecord): Record<string, unknown> {
  if (record.payload && typeof record.payload === "object") return record.payload;
  if (typeof record.payload === "string") {
    try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

function mapProcessRows(value: unknown): ProcessRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return {
      processId: String(row.processId || `PROC-${String(index + 1).padStart(2, "0")}`),
      sequence: Number(row.sequence || index + 1),
      name: String(row.name || ""),
      site: String(row.site || ""),
      owner: String(row.owner || ""),
      inputName: String(row.inputName || ""),
      inputAmount: String(row.inputAmount ?? ""),
      inputUnit: String(row.inputUnit || ""),
      outputName: String(row.outputName || ""),
      outputAmount: String(row.outputAmount ?? ""),
      outputUnit: String(row.outputUnit || ""),
      note: String(row.note || ""),
    };
  }).sort((a, b) => a.sequence - b.sequence);
}

export function EmissionLcaProductProcessPage() {
  const en = isEnglish();
  const tr = useCallback((ko: string, english: string) => en ? english : ko, [en]);
  const projectApi = en ? `/en${PROJECTS_API}` : PROJECTS_API;
  const processApi = en ? `/en${PRODUCT_PROCESS_API}` : PRODUCT_PROCESS_API;
  const requestedProjectId = new URLSearchParams(window.location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(requestedProjectId);
  const [records, setRecords] = useState<WorkspaceRecord[]>([]);
  const [productName, setProductName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [productFamily, setProductFamily] = useState("");
  const [specification, setSpecification] = useState("");
  const [referenceFlow, setReferenceFlow] = useState("1");
  const [referenceUnit, setReferenceUnit] = useState("개");
  const [processRows, setProcessRows] = useState<ProcessRow[]>([emptyProcess(1)]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [projectResponse, processResponse] = await Promise.all([
        fetch(projectApi, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } }),
        fetch(processApi, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } }),
      ]);
      const [projectBody, processBody] = await Promise.all([
        projectResponse.json().catch(() => ({})) as Promise<{ items?: Array<Record<string, unknown>>; message?: string }>,
        processResponse.json().catch(() => ({})) as Promise<{ records?: WorkspaceRecord[]; message?: string }>,
      ]);
      if (!projectResponse.ok) throw new Error(projectBody.message || tr(`프로젝트 목록 조회 실패 (${projectResponse.status})`, `Could not load projects (${projectResponse.status})`));
      if (!processResponse.ok) throw new Error(processBody.message || tr(`제품·공정 업무 권한 확인 실패 (${processResponse.status})`, `Could not verify product/process access (${processResponse.status})`));
      const visibleProjects = Array.isArray(projectBody.items) ? projectBody.items.map((raw) => ({
        id: String(raw.id || ""),
        name: String(raw.name || raw.id || ""),
        site: String(raw.site || ""),
        period: String(raw.period || ""),
        status: String(raw.status || ""),
      })).filter((project) => project.id) : [];
      const visibleRecords = Array.isArray(processBody.records) ? processBody.records : [];
      setProjects(visibleProjects);
      setRecords(visibleRecords);
      const nextProjectId = visibleProjects.some((project) => project.id === projectId)
        ? projectId
        : visibleProjects.some((project) => project.id === requestedProjectId)
          ? requestedProjectId
        : visibleProjects[0]?.id || "";
      setProjectId(nextProjectId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr("화면 데이터를 불러오지 못했습니다.", "Could not load screen data."));
    } finally {
      setLoading(false);
    }
  }, [processApi, projectApi, projectId, requestedProjectId, tr]);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedProject = projects.find((project) => project.id === projectId) || null;
  const selectedRecord = useMemo(() => records.find((record) => String(payloadOf(record).projectId || "") === projectId) || null, [projectId, records]);

  useEffect(() => {
    if (!projectId) {
      setProductName(""); setProductCode(""); setProductFamily(""); setSpecification("");
      setReferenceFlow("1"); setReferenceUnit("개"); setProcessRows([emptyProcess(1)]); setSelectedVersion(null);
      return;
    }
    const payload = selectedRecord ? payloadOf(selectedRecord) : {};
    const product = payload.product && typeof payload.product === "object" ? payload.product as Record<string, unknown> : {};
    setProductName(String(product.name || ""));
    setProductCode(String(product.code || ""));
    setProductFamily(String(product.family || ""));
    setSpecification(String(product.specification || ""));
    setReferenceFlow(String(product.referenceFlow ?? "1"));
    setReferenceUnit(String(product.referenceUnit || "개"));
    setProcessRows(mapProcessRows(payload.processes).length ? mapProcessRows(payload.processes) : [emptyProcess(1)]);
    setSelectedVersion(selectedRecord?.version ?? null);
    setError(""); setNotice("");
  }, [projectId, selectedRecord]);

  const updateProcess = (index: number, key: keyof ProcessRow, value: string | number) => {
    setProcessRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  };

  const moveProcess = (index: number, direction: -1 | 1) => {
    setProcessRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((row, rowIndex) => ({ ...row, sequence: rowIndex + 1, processId: `PROC-${String(rowIndex + 1).padStart(2, "0")}` }));
    });
  };

  const validate = () => {
    if (!selectedProject) return tr("먼저 접근 가능한 프로젝트를 선택하세요.", "Select an accessible project first.");
    if (!productName.trim() || !productCode.trim() || !productFamily.trim() || !referenceFlow.trim() || !referenceUnit.trim()) return tr("제품명, 제품 코드, 제품군, 기준 흐름, 단위를 입력하세요.", "Enter product name, code, family, reference flow, and unit.");
    if (!processRows.length || processRows.some((row) => !row.name.trim() || !row.outputName.trim() || !row.outputAmount.trim() || !row.outputUnit.trim())) return tr("각 공정에 공정명과 산출물·수량·단위를 입력하세요.", "Each process needs a name and output name, quantity, and unit.");
    if (processRows.some((row) => row.inputAmount && Number(row.inputAmount) < 0 || row.outputAmount && Number(row.outputAmount) < 0)) return tr("투입·산출 수량은 0 이상으로 입력하세요.", "Input and output quantities must be zero or greater.");
    return "";
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!PROJECT_SCOPED_SAVE_API_READY) {
      setError(tr("프로젝트별 저장 권한 검사가 서버에 반영되기 전까지 저장은 잠겨 있습니다.", "Saving is disabled until project-scoped server authorization is installed."));
      return;
    }
    const validation = validate();
    if (validation) { setError(validation); return; }
    if (!selectedProject) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(processApi, {
        method: "POST", credentials: "include",
        headers: await buildResilientCsrfHeaders({ "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }),
        body: JSON.stringify({
          businessKey: `${selectedProject.id}::PRODUCT_PROCESS`,
          assignedActor: "LCA_PROCESS_MODELER",
          payload: {
            projectId: selectedProject.id,
            projectName: selectedProject.name,
            product: { name: productName.trim(), code: productCode.trim(), family: productFamily.trim(), specification: specification.trim(), referenceFlow: Number(referenceFlow), referenceUnit },
            processes: processRows.map((row, index) => ({ ...row, processId: `PROC-${String(index + 1).padStart(2, "0")}`, sequence: index + 1, name: row.name.trim(), inputName: row.inputName.trim(), outputName: row.outputName.trim() })),
            savedAtClient: new Date().toISOString(),
          },
        }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string; version?: number; workflowStatus?: string };
      if (!response.ok) throw new Error(body.message || tr(`저장 실패 (${response.status})`, `Save failed (${response.status})`));
      setNotice(tr("제품·공정 정보가 서버 업무 기록에 저장되었습니다.", "Product and process information was saved to the server workflow."));
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr("저장하지 못했습니다.", "Could not save changes."));
    } finally { setSaving(false); }
  };

  return (
    <main id="main-content" className="min-h-[calc(100vh-15rem)] bg-[#f4f7fa] px-4 py-7 text-[var(--kr-gov-text-primary)] sm:px-6 lg:px-8" data-ui-page="lca-product-process" data-testid="lca-product-process">
      <div className="mx-auto max-w-7xl space-y-5">
        <nav aria-label={tr("현재 위치", "Breadcrumb")} className="text-sm text-slate-600">
          <a className="text-[var(--kr-gov-blue)] underline" href="/emission/lca?menu=H1030101">{tr("제품 LCA", "Product LCA")}</a><span className="mx-2">›</span><a className="text-[var(--kr-gov-blue)] underline" href="/emission/lca?menu=H1030102">{tr("LCA 프로젝트", "LCA projects")}</a><span className="mx-2">›</span><span className="font-bold text-slate-900">{tr("제품·공정 정보", "Product and process")}</span>
        </nav>

        <header className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[var(--kr-gov-blue)]">{tr("제품 LCA · 목표와 범위 설정", "Product LCA · Goal and scope")}</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[#052b57] sm:text-3xl">{tr("제품·공정 정보", "Product and process information")}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{tr("프로젝트에 포함할 제품과 제조 공정, 공정별 투입·산출 흐름을 입력하고 버전으로 저장합니다.", "Define the product, manufacturing steps, and each process input/output for the selected project.")}</p>
            </div>
            <a className="inline-flex min-h-10 items-center rounded-md border border-blue-200 px-4 text-sm font-bold text-[var(--kr-gov-blue)] hover:bg-blue-50" href="/emission/lca?menu=H1030102">{tr("프로젝트 관리", "Project management")}</a>
          </div>
          <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label={tr("LCA 설계 순서", "LCA design sequence")}>
            {[tr("프로젝트 선택", "Select project"), tr("제품 사양", "Product definition"), tr("공정·흐름 입력", "Processes and flows"), tr("저장·검증", "Save and validate")].map((step, index) => <li key={step} className={`flex items-center gap-3 rounded-lg border p-3 ${index < 3 ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--kr-gov-blue)] text-xs font-black text-white">{index + 1}</span><span className="text-sm font-bold text-slate-700">{step}</span></li>)}
          </ol>
        </header>

        {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}{/401/.test(error) ? <p className="mt-1 font-normal">{tr("로그인 세션을 확인한 뒤 다시 시도하세요.", "Check your login session and try again.")}</p> : /403/.test(error) ? <p className="mt-1 font-normal">{tr("선택 프로젝트에 LCA 공정 모델러 권한이 할당되어야 합니다.", "The LCA process modeler role must be assigned to this project.")}</p> : null}</div> : null}
        {notice ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div> : null}
        {!PROJECT_SCOPED_SAVE_API_READY ? <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{tr("보안 보호: 개발 API는 액터 권한만 확인하고 프로젝트별 저장 범위는 아직 확인하지 않습니다. 서버 검증을 반영하기 전까지 저장을 잠갔습니다.", "Security hold: the development API currently checks the actor but not project-scoped write access. Saving is locked until server-side validation is installed.")}</div> : null}

        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block text-sm font-bold text-slate-700">{tr("대상 프로젝트", "Project")}
            <select className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium" value={projectId} onChange={(event) => { const value = event.target.value; setProjectId(value); const url = new URL(window.location.href); if (value) url.searchParams.set("projectId", value); else url.searchParams.delete("projectId"); window.history.replaceState({}, "", url); }} disabled={loading || projects.length === 0}>
              {projects.length === 0 ? <option value="">{loading ? tr("프로젝트 조회 중…", "Loading projects…") : tr("접근 가능한 프로젝트 없음", "No accessible projects")}</option> : null}
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.id}{project.site ? ` · ${project.site}` : ""}</option>)}
            </select>
          </label>
          <div className="flex gap-2"><button className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => void loadData()} type="button" disabled={loading}>{tr("새로고침", "Refresh")}</button><a className="inline-flex min-h-11 items-center rounded-md bg-[var(--kr-gov-blue)] px-4 text-sm font-bold text-white" href="/emission/project-portfolio">{tr("프로젝트 목록", "Project list")}</a></div>
          {selectedProject ? <p className="md:col-span-2 text-xs text-slate-500">{selectedProject.name} · {selectedProject.site || tr("사업장 미지정", "No site")} · {selectedProject.period || tr("기간 미지정", "Period not set")} · {selectedProject.status || tr("상태 확인 필요", "Status needs review")}</p> : null}
        </section>

        <form className="space-y-5" onSubmit={(event) => void save(event)}>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="lca-product-info-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">01 · {tr("제품 기준", "Product definition")}</p><h2 id="lca-product-info-title" className="mt-1 text-lg font-black text-[#052b57]">{tr("제품 정보", "Product information")}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{selectedVersion ? `v${selectedVersion}` : tr("초안", "New draft")}</span></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm font-bold text-slate-700">{tr("제품명", "Product name")} *<input required value={productName} onChange={(event) => setProductName(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3 font-medium" placeholder={tr("예: 재생 알루미늄 판재", "e.g. recycled aluminum sheet")} /></label>
              <label className="text-sm font-bold text-slate-700">{tr("제품 코드", "Product code")} *<input required value={productCode} onChange={(event) => setProductCode(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3 font-medium" placeholder="PRD-001" /></label>
              <label className="text-sm font-bold text-slate-700">{tr("제품군", "Product family")} *<input required value={productFamily} onChange={(event) => setProductFamily(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3 font-medium" placeholder={tr("예: 금속 소재", "e.g. metal materials")} /></label>
              <label className="text-sm font-bold text-slate-700 sm:col-span-2">{tr("규격·제품 설명", "Specification and description")}<input value={specification} onChange={(event) => setSpecification(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3 font-medium" placeholder={tr("재질, 등급, 크기 등 식별 가능한 규격", "Material, grade, dimensions, and other identifying specifications")} /></label>
              <div className="grid grid-cols-[1fr_1fr] gap-3"><label className="text-sm font-bold text-slate-700">{tr("기준 흐름", "Reference flow")} *<input required min="0.000001" step="any" type="number" value={referenceFlow} onChange={(event) => setReferenceFlow(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3 font-medium" /></label><label className="text-sm font-bold text-slate-700">{tr("단위", "Unit")} *<select value={referenceUnit} onChange={(event) => setReferenceUnit(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-medium">{["개", "kg", "t", "L", "m³", "kWh", "MJ"].map((unit) => <option key={unit}>{unit}</option>)}</select></label></div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{tr("기능 단위와 시스템 경계는 다음 설계 단계에서 정의합니다. 여기서는 제품 식별과 공정 연결에 필요한 기준 흐름만 기록합니다.", "Functional unit and system boundary are defined in the next design step. This page records product identity and its reference flow.")}</p>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="lca-process-list-title">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">02 · {tr("공정 순서와 제품 흐름", "Process order and product flows")}</p><h2 id="lca-process-list-title" className="mt-1 text-lg font-black text-[#052b57]">{tr("제조 공정", "Manufacturing processes")}</h2><p className="mt-1 text-sm text-slate-600">{tr("공정 순서대로 입력·산출물과 수량 단위를 연결합니다.", "Enter each process in order and link its input/output flow and units.")}</p></div><button className="min-h-10 rounded-md border border-blue-200 px-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:bg-blue-50" onClick={() => setProcessRows((rows) => [...rows, emptyProcess(rows.length + 1)])} type="button" disabled={!projectId}>+ {tr("공정 추가", "Add process")}</button></div>
            <div className="space-y-4 p-5">
              {processRows.map((row, index) => <article key={row.processId} className="rounded-lg border border-slate-200 bg-slate-50 p-4" data-process-sequence={index + 1}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--kr-gov-blue)] text-sm font-black text-white">{index + 1}</span><label className="text-sm font-bold text-slate-700">{tr("공정명", "Process name")} *<input required value={row.name} onChange={(event) => updateProcess(index, "name", event.target.value)} className="ml-2 min-h-10 w-60 max-w-full rounded-md border border-slate-300 bg-white px-3 font-medium" placeholder={tr("예: 용해·주조", "e.g. melting and casting")} /></label></div><div className="flex gap-1"><button type="button" onClick={() => moveProcess(index, -1)} disabled={index === 0} className="min-h-9 rounded border border-slate-300 bg-white px-2 text-xs font-bold disabled:opacity-40" aria-label={tr("앞으로 이동", "Move earlier")}>↑</button><button type="button" onClick={() => moveProcess(index, 1)} disabled={index === processRows.length - 1} className="min-h-9 rounded border border-slate-300 bg-white px-2 text-xs font-bold disabled:opacity-40" aria-label={tr("뒤로 이동", "Move later")}>↓</button><button type="button" onClick={() => setProcessRows((rows) => rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index).map((item, rowIndex) => ({ ...item, sequence: rowIndex + 1, processId: `PROC-${String(rowIndex + 1).padStart(2, "0")}` })) : [emptyProcess(1)])} className="min-h-9 rounded border border-red-200 bg-white px-2 text-xs font-bold text-red-700">{tr("삭제", "Remove")}</button></div></div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="text-xs font-bold text-slate-600">{tr("사업장", "Site")}<input value={row.site} onChange={(event) => updateProcess(index, "site", event.target.value)} className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm font-medium" placeholder={selectedProject?.site || tr("사업장", "Site")} /></label>
                  <label className="text-xs font-bold text-slate-600">{tr("공정 담당자", "Process owner")}<input value={row.owner} onChange={(event) => updateProcess(index, "owner", event.target.value)} className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm font-medium" placeholder={tr("담당 액터 또는 팀", "Actor or team")} /></label>
                  <label className="text-xs font-bold text-slate-600">{tr("공정 설명", "Process note")}<input value={row.note} onChange={(event) => updateProcess(index, "note", event.target.value)} className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm font-medium" placeholder={tr("공정 조건·설비", "Conditions or equipment")} /></label>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <fieldset className="rounded-lg border border-slate-200 bg-white p-3"><legend className="px-1 text-xs font-black text-slate-700">{tr("투입 흐름", "Input flow")}</legend><div className="grid gap-2 sm:grid-cols-[1fr_0.75fr_0.55fr]"><label className="text-xs font-bold text-slate-600">{tr("물질·에너지", "Material or energy")}<input value={row.inputName} onChange={(event) => updateProcess(index, "inputName", event.target.value)} className="mt-1 block min-h-10 w-full rounded border border-slate-300 px-2 text-sm font-medium" placeholder={tr("예: 알루미늄 스크랩", "e.g. aluminum scrap")} /></label><label className="text-xs font-bold text-slate-600">{tr("수량", "Quantity")}<input min="0" step="any" type="number" value={row.inputAmount} onChange={(event) => updateProcess(index, "inputAmount", event.target.value)} className="mt-1 block min-h-10 w-full rounded border border-slate-300 px-2 text-sm font-medium" /></label><label className="text-xs font-bold text-slate-600">{tr("단위", "Unit")}<input value={row.inputUnit} onChange={(event) => updateProcess(index, "inputUnit", event.target.value)} className="mt-1 block min-h-10 w-full rounded border border-slate-300 px-2 text-sm font-medium" placeholder="kg" /></label></div></fieldset>
                  <fieldset className="rounded-lg border border-blue-200 bg-blue-50/40 p-3"><legend className="px-1 text-xs font-black text-blue-800">{tr("산출 흐름", "Output flow")}</legend><div className="grid gap-2 sm:grid-cols-[1fr_0.75fr_0.55fr]"><label className="text-xs font-bold text-slate-600">{tr("제품·부산물", "Product or byproduct")} *<input required value={row.outputName} onChange={(event) => updateProcess(index, "outputName", event.target.value)} className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm font-medium" placeholder={productName || tr("주제품", "Main product")} /></label><label className="text-xs font-bold text-slate-600">{tr("수량", "Quantity")} *<input required min="0" step="any" type="number" value={row.outputAmount} onChange={(event) => updateProcess(index, "outputAmount", event.target.value)} className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm font-medium" /></label><label className="text-xs font-bold text-slate-600">{tr("단위", "Unit")} *<input required value={row.outputUnit} onChange={(event) => updateProcess(index, "outputUnit", event.target.value)} className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm font-medium" placeholder={referenceUnit} /></label></div></fieldset>
                </div>
              </article>)}
            </div>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div><p className="font-bold text-[#052b57]">{selectedRecord ? tr(`저장 버전 v${selectedRecord.version ?? "?"} · ${selectedRecord.workflowStatus || "DRAFT"}`, `Saved version v${selectedRecord.version ?? "?"} · ${selectedRecord.workflowStatus || "DRAFT"}`) : tr("저장된 제품·공정 정보가 없습니다.", "No product/process record has been saved.")}</p><p className="mt-1 text-xs text-slate-600">{tr("저장 후 범위·기능단위 정의 화면에서 같은 프로젝트로 이어서 설계합니다.", "After saving, continue with scope and functional unit for this project.")}</p></div>
            <div className="flex gap-2"><a className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700" href={`/lca/system-boundary${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}>{tr("다음: 시스템 경계", "Next: system boundary")}</a><button type="submit" disabled={!PROJECT_SCOPED_SAVE_API_READY || saving || loading || !projectId} className="inline-flex min-h-11 items-center rounded-md bg-[var(--kr-gov-blue)] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? tr("저장 중…", "Saving…") : tr("제품·공정 저장", "Save product/process")}</button></div>
          </section>
        </form>

        <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"><summary className="cursor-pointer font-bold text-[#052b57]">{tr("업무 안내·검증 기준", "Work guide and validation")}</summary><div className="mt-3 grid gap-3 md:grid-cols-3"><p><b>{tr("입력", "Input")}</b><br />{tr("접근 가능한 프로젝트, 제품 식별정보, 기준 흐름, 공정 순서, 투입·산출 수량과 단위", "Accessible project, product identity, reference flow, process order, input/output quantities and units")}</p><p><b>{tr("저장", "Save")}</b><br />{tr("LCA_PRODUCT_PROCESS 업무 API · 담당 액터 LCA_PROCESS_MODELER · 프로젝트 ID 범위 검사", "LCA_PRODUCT_PROCESS API · LCA_PROCESS_MODELER actor · project-scoped access check")}</p><p><b>{tr("다음", "Next")}</b><br />{tr("시스템 경계 → 기능 단위 → 인벤토리 자료 수집", "System boundary → functional unit → inventory collection")}</p></div></details>
      </div>
    </main>
  );
}
