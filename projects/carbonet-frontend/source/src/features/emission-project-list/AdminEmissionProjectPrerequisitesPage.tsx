import { useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

type Project = { id?: string; name?: string; site?: string; owner?: string; status?: string };
type ProjectPayload = { items?: Project[]; sites?: string[] };

type ReadinessItem = {
  key: string;
  order: number;
  title: string;
  description: string;
  required: string[];
  href: string;
  action: string;
  status: "READY" | "CHECK";
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error(`서버 응답 형식 오류 (${response.status})`);
  const body = await response.json() as T;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return body;
}

export function AdminEmissionProjectPrerequisitesPage() {
  const en = isEnglish();
  const [payload, setPayload] = useState<ProjectPayload>({});
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    void fetchJson<ProjectPayload>(buildLocalizedPath("/home/api/emission-projects?page=1&size=100", "/en/home/api/emission-projects?page=1&size=100"))
      .then(body => {
        setPayload(body || {});
        const first = Array.isArray(body.items) ? body.items[0] : undefined;
        if (first?.id) setProjectId(first.id);
        setError("");
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, []);

  const projects = Array.isArray(payload.items) ? payload.items : [];
  const selected = projects.find(item => item.id === projectId);
  const hasProject = Boolean(selected?.id);
  const hasSite = Boolean(selected?.site) || Boolean(payload.sites?.length);

  const items = useMemo<ReadinessItem[]>(() => [
    {
      key: "company-site", order: 1, title: en ? "Company, site, and organizational boundary" : "기업·사업장·조직경계",
      description: en ? "Confirm the reporting entity, sites, ownership, control approach, and effective dates." : "보고 법인, 사업장, 지분율, 통제기준과 적용기간을 확정합니다.",
      required: en ? ["Legal entity and sites", "Ownership and control", "Inclusion / exclusion evidence"] : ["법인·사업장 원장", "지분율·통제기준", "포함·제외 근거"],
      href: buildLocalizedPath("/admin/emission/site-management", "/en/admin/emission/site-management"), action: en ? "Open registry" : "원장 관리", status: hasProject && hasSite ? "READY" : "CHECK",
    },
    {
      key: "actors", order: 2, title: en ? "Actors, accounts, and segregation of duties" : "액터·계정·업무분리",
      description: en ? "Assign data owners, calculators, verifiers, approvers, and alternates within the same tenant." : "동일 기업 안에서 자료담당자·산정자·검증자·승인자와 대체 담당자를 배정합니다.",
      required: en ? ["Account membership", "Actor assignment", "Conflict-of-duty check"] : ["기업 소속 계정", "단계별 액터 배정", "겸직·상충 검증"],
      href: buildLocalizedPath("/emission/work-assignment", "/en/emission/work-assignment"), action: en ? "Assign work" : "업무 배정", status: "CHECK",
    },
    {
      key: "method", order: 3, title: en ? "Factors, units, and calculation methods" : "배출계수·단위·산정방법",
      description: en ? "Approve factor sources, unit conversions, GWP versions, and calculation rules before collection." : "자료 수집 전에 배출계수 출처, 단위 환산, GWP 버전과 산정식을 승인합니다.",
      required: en ? ["Factor source and version", "Unit conversion", "Calculation and validation rules"] : ["배출계수 출처·버전", "단위·환산식", "산정식·검증 규칙"],
      href: buildLocalizedPath("/admin/emission/factor-management", "/en/admin/emission/factor-management"), action: en ? "Manage factors" : "배출계수 관리", status: "CHECK",
    },
    {
      key: "workflow", order: 4, title: en ? "Workflow, SLA, and notification policy" : "워크플로·기한·알림정책",
      description: en ? "Set completion gates, due dates, escalation, rejection, resubmission, and approval routes." : "완료 게이트, 마감, 에스컬레이션, 반려·재제출과 승인선을 설정합니다.",
      required: en ? ["Completion gates", "SLA and escalation", "Approval and resubmission"] : ["단계 완료 조건", "SLA·지연 알림", "승인선·재제출"],
      href: buildLocalizedPath("/admin/emission/approval-workflow", "/en/admin/emission/approval-workflow"), action: en ? "Configure workflow" : "워크플로 설정", status: "CHECK",
    },
    {
      key: "report", order: 5, title: en ? "Report, certificate, and verification profile" : "보고서·인증서·진위확인",
      description: en ? "Select the report template, certificate issuer, QR, hashes, and verification dataset policy." : "보고서 양식, 발급 주체, QR, 해시와 진위확인 데이터셋 정책을 확정합니다.",
      required: en ? ["Report template", "Certificate issuer", "Hash and verification policy"] : ["보고서 템플릿", "인증서 발급 주체", "해시·진위확인 정책"],
      href: buildLocalizedPath("/admin/emission/report-template", "/en/admin/emission/report-template"), action: en ? "Manage templates" : "템플릿 관리", status: "CHECK",
    },
  ], [en, hasProject, hasSite]);

  const readyCount = items.filter(item => item.status === "READY").length;
  return <AdminPageShell breadcrumbs={[
    { label: en ? "Admin" : "관리자", href: buildLocalizedPath("/admin/", "/en/admin/") },
    { label: en ? "Emission operations" : "탄소배출 운영" },
    { label: en ? "Project prerequisites" : "프로젝트 사전 설정" },
  ]} title={en ? "Emission Project Prerequisite Control" : "배출량 프로젝트 사전 설정"}>
    <main className="space-y-5" data-testid="admin-emission-project-prerequisites">
      <section className="rounded-2xl border border-blue-900/10 bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white shadow-sm">
        <p className="text-sm font-bold text-blue-100">ACTOR · PROCESS · TEST · TASK</p>
        <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><h2 className="text-2xl font-black sm:text-3xl">{en ? "Close prerequisites before starting the 20-step relay" : "20단계 업무 릴레이 시작 전 선행 조건을 닫습니다"}</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-blue-50">{en ? "This control page prevents projects from entering collection or calculation with missing master data, actors, policies, or report settings." : "기준정보·담당자·업무정책·보고 설정이 빠진 프로젝트가 수집·산정 단계로 진입하지 않도록 통제합니다."}</p></div>
          <div className="rounded-xl bg-white/10 p-4"><span className="text-xs font-bold text-blue-100">{en ? "Confirmed automatically" : "자동 확인"}</span><strong className="mt-1 block text-3xl font-black">{readyCount} / {items.length}</strong></div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <label className="block max-w-2xl"><span className="mb-2 block text-sm font-bold text-slate-700">{en ? "Target project" : "점검 대상 프로젝트"}</span><select className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base" value={projectId} onChange={event => setProjectId(event.target.value)} disabled={loading}><option value="">{loading ? (en ? "Loading..." : "불러오는 중") : (en ? "Select a project" : "프로젝트 선택")}</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name || project.id} · {project.site || (en ? "No site" : "사업장 미지정")}</option>)}</select></label>
        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
        {selected && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[en ? "Project ID" : "프로젝트 ID", selected.id], [en ? "Site" : "사업장", selected.site || "-"], [en ? "Owner" : "담당자", selected.owner || "-"], [en ? "Status" : "상태", selected.status || "-"]].map(([label, value]) => <div className="rounded-xl bg-slate-50 p-4" key={label}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block break-words text-sm text-slate-900">{value}</strong></div>)}</div>}
      </section>

      <ol className="space-y-4">{items.map(item => <li className="rounded-2xl border bg-white p-5 shadow-sm" key={item.key}><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-800">{item.order}</span><h3 className="text-lg font-black text-[#052b57]">{item.title}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "READY" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{item.status === "READY" ? (en ? "Data detected" : "기초 데이터 확인") : (en ? "Review required" : "관리자 확인 필요")}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p><ul className="mt-3 flex flex-wrap gap-2">{item.required.map(value => <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700" key={value}>{value}</li>)}</ul></div><a className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[#246beb] px-5 text-sm font-black text-white hover:bg-[#174ea6] focus:outline-none focus:ring-2 focus:ring-blue-400" href={item.href}>{item.action}</a></div></li>)}</ol>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-black text-amber-900">{en ? "Completion rule" : "사전 설정 완료 기준"}</h3><p className="mt-2 text-sm leading-6 text-amber-900">{en ? "A project may start only when all five controls have evidence and actor assignments. A neutral review state is never treated as complete." : "5개 통제 항목의 증적과 단계별 담당자 배정이 모두 확인된 경우에만 프로젝트를 시작합니다. ‘확인 필요’ 상태는 완료로 처리하지 않습니다."}</p></section>
    </main>
  </AdminPageShell>;
}
