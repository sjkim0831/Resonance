import { useCallback, useEffect, useMemo, useState } from "react";
import { buildResilientCsrfHeaders } from "../../lib/api/core";
import { isEnglish } from "../../lib/navigation/runtime";

type Row = { workspaceId?: string; businessKey?: string; workflowStatus?: string; version?: number; updatedAt?: string; payload?: Record<string, unknown> | string };
type Project = { workspaceId?: string; businessKey?: string; version?: number; payload?: Record<string, unknown> | string };
const PROJECTS = "/admin/api/admin/lca-workspaces/LCA_PROJECT";
const CONFIG = {
  criteria: { process: "LCA_SCOPE", titleKo: "적용 제도·평가 기준", titleEn: "Applicable Schemes and Assessment Criteria", actor: "LCA_PROJECT_OWNER", key: "assessmentCriteria" },
  interpretation: { process: "LCA_RESULT_CONFIRMATION", titleKo: "결과 해석·개선안", titleEn: "Interpretation and Improvement Plan", actor: "LCA_SPECIALIST", key: "interpretation" }
} as const;
function objectOf(value: Row["payload"]): Record<string, unknown> {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") { try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; } }
  return {};
}
function LcaAssessmentForm({ mode }: { mode: keyof typeof CONFIG }) {
  const en = isEnglish();
  const config = CONFIG[mode];
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [projectId, setProjectId] = useState(new URLSearchParams(location.search).get("projectId") || "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const tr = (ko: string, english: string) => en ? english : ko;
  const projectLabel = useCallback((project: Project) => {
    const payload = objectOf(project.payload);
    return `${String(payload.projectName || project.businessKey || tr("LCA 프로젝트", "LCA project"))} · ${project.workspaceId || ""}`;
  }, [en]);
  const load = useCallback(async () => {
    setError("");
    try {
      const [projectRes, rowRes] = await Promise.all([
        fetch(PROJECTS, { credentials: "include", cache: "no-store", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }),
        fetch(`/admin/api/admin/lca-workspaces/${config.process}`, { credentials: "include", cache: "no-store", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } })
      ]);
      const [projectBody, rowBody] = await Promise.all([projectRes.json(), rowRes.json()]) as [{ records?: Project[]; message?: string }, { records?: Row[]; message?: string }];
      if (!projectRes.ok) throw new Error(projectBody.message || `LCA_PROJECT ${projectRes.status}`);
      if (!rowRes.ok) throw new Error(rowBody.message || `${config.process} ${rowRes.status}`);
      setProjects(projectBody.records || []); setRows(rowBody.records || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : tr("자료를 불러오지 못했습니다.", "Could not load records.")); }
  }, [config.process, en]);
  useEffect(() => { void load(); }, [load]);
  const selected = projects.find(project => project.workspaceId === projectId);
  const selectedPayload = objectOf(selected?.payload);
  const projectRows = useMemo(() => rows.filter(row => String(objectOf(row.payload).projectId || "") === projectId), [rows, projectId]);
  const fields: ReadonlyArray<readonly [string, string, string]> = mode === "criteria" ? [
    ["purpose", tr("평가 목적", "Assessment purpose"), tr("예: 환경성적표지 인증 / 내부 개선 / 고객 요청", "e.g. EPD / internal improvement / customer request")],
    ["scheme", tr("적용 제도·표준", "Scheme / standard"), "ISO 14040/14044, ISO 14067, 환경성적표지 등"],
    ["productRule", tr("제품군 지침·규칙", "Product category rules"), "제품군 지침명과 버전"],
    ["reference", tr("근거·출처", "Legal or source reference"), tr("법령·고시·계약·고객 요구 근거", "Law, notice, contract or customer requirement")],
    ["effectiveDate", tr("적용 기준일", "Effective date"), "YYYY-MM-DD"]
  ] : [
    ["keyFindings", tr("주요 결과·핫스폿", "Key findings / hotspots"), tr("산정 결과에서 확인한 주요 영향과 근거", "Main impacts and supporting results")],
    ["limitations", tr("자료 한계·불확실성", "Limitations / uncertainty"), tr("자료 대표성, 누락, 가정, 민감도 한계", "Representativeness, gaps, assumptions and sensitivity")],
    ["conclusion", tr("결론 및 해석", "Conclusion and interpretation"), tr("목적·범위에 비추어 결과를 해석", "Interpret results against the stated goal and scope")],
    ["improvementPlan", tr("개선안·후속 조치", "Improvement actions"), tr("담당자, 조치, 기한을 포함한 후속 계획", "Follow-up actions, owners and due dates")]
  ] as const;
  const save = async () => {
    if (!selected) { setError(tr("먼저 권한이 있는 LCA 프로젝트를 선택하세요.", "Select an LCA project you are authorized to access.")); return; }
    const missing = fields.find(([key]) => !values[key]?.trim());
    if (missing) { setError(tr("필수 항목을 입력하세요: ", "Complete the required field: ") + missing[1]); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/admin/api/admin/lca-workspaces/${config.process}`, {
        method: "POST", credentials: "include",
        headers: await buildResilientCsrfHeaders({ "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }),
        body: JSON.stringify({ businessKey: `${config.key.toUpperCase()}-${projectId}-${Date.now()}`, assignedActor: config.actor, payload: { projectId, projectName: selectedPayload.projectName || selected.businessKey || "", ...values } })
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message || `${response.status}`);
      setMessage(tr("초안이 서버에 저장되었습니다. 저장 버전과 프로젝트 연결을 확인하세요.", "Draft saved. Check its version and project link."));
      setValues({}); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : tr("저장하지 못했습니다.", "Save failed.")); }
    finally { setBusy(false); }
  };
  return <main id="main-content" className="mx-auto max-w-7xl space-y-5 px-4 py-7 text-[#052b57]" data-testid={`lca-${mode}-page`}>
    <nav className="text-sm"><a className="underline" href="/emission/lca?menu=H1030101">제품 LCA</a>　›　{tr("LCA 프로젝트", "LCA Projects")}　›　<strong>{en ? config.titleEn : config.titleKo}</strong></nav>
    <header className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-6"><div><p className="font-bold text-blue-800">제품 LCA · {config.process}</p><h1 className="mt-1 text-3xl font-black">{en ? config.titleEn : config.titleKo}</h1><p className="mt-2 text-sm">{mode === "criteria" ? tr("프로젝트별 목적·평가 기준·적용 근거를 버전으로 기록합니다.", "Record project purpose, assessment criteria and sources as a versioned work item.") : tr("승인된 LCA 결과를 해석하고 한계와 개선 조치를 기록합니다.", "Interpret approved LCA results and record limitations and improvement actions.")}</p></div><label className="min-w-72 text-sm font-bold">{tr("프로젝트 선택", "Select project")}<select aria-label={tr("프로젝트 선택", "Select project")} className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={projectId} onChange={event => { setProjectId(event.target.value); const url = new URL(location.href); event.target.value ? url.searchParams.set("projectId", event.target.value) : url.searchParams.delete("projectId"); history.replaceState({}, "", url); }}><option value="">{tr("프로젝트 선택", "Select project")}</option>{projects.map(project => <option key={project.workspaceId} value={project.workspaceId}>{projectLabel(project)}</option>)}</select></label></header>
    {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-red-800">{error}</p>}{message && <p role="status" className="rounded border border-green-300 bg-green-50 p-4 text-green-800">{message}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">{tr("업무 입력", "Work entry")}</h2>{!selected ? <p className="mt-3 rounded bg-amber-50 p-4">{tr("프로젝트를 선택하면 입력 양식과 저장된 이력이 표시됩니다.", "Select a project to view the form and saved history.")}</p> : <><p className="mt-2 text-sm">{projectLabel(selected)} · {tr("프로젝트 버전", "Project version")} v{selected.version || "—"}</p><div className="mt-4 grid gap-4 md:grid-cols-2">{fields.map(([key, label, hint]) => <label key={key} className="text-sm font-bold">{label}<textarea className="mt-1 min-h-24 w-full rounded border border-slate-300 p-3 font-normal" placeholder={hint} value={values[key] || ""} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} /></label>)}</div><button disabled={busy} onClick={() => void save()} className="mt-4 min-h-11 rounded bg-[var(--kr-gov-blue)] px-5 font-bold text-white disabled:opacity-50">{busy ? tr("저장 중…", "Saving…") : tr("초안 저장", "Save draft")}</button></>}</section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex justify-between border-b p-5"><div><h2 className="text-lg font-black">{tr("저장된 기록", "Saved records")}</h2><p className="text-sm text-slate-600">{tr("권한이 허용된 프로젝트 기록만 조회됩니다.", "Only records for projects authorized to your account are returned.")}</p></div><button onClick={() => void load()} className="min-h-10 rounded border border-blue-300 px-4 font-bold">{tr("새로고침", "Refresh")}</button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{[tr("기록 ID", "Record"), tr("상태", "Status"), tr("버전", "Version"), tr("갱신", "Updated")].map(head => <th key={head} className="p-3">{head}</th>)}</tr></thead><tbody>{projectRows.map(row => <tr key={row.workspaceId} className="border-t"><td className="p-3">{row.businessKey}</td><td className="p-3">{row.workflowStatus}</td><td className="p-3">v{row.version}</td><td className="p-3">{String(objectOf(row.payload).updatedAt || "—")}</td></tr>)}{projectRows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">{tr("이 프로젝트에 저장된 기록이 없습니다.", "No saved records for this project.")}</td></tr>}</tbody></table></div></section>
  </main>;
}
export function LcaAssessmentCriteriaPage() { return <LcaAssessmentForm mode="criteria" />; }
export function LcaInterpretationPage() { return <LcaAssessmentForm mode="interpretation" />; }
