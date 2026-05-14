import { useMemo } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchOperationsInventory, type CommandPayload, type OperationsInventoryPayload } from "../../lib/api/operationsInventory";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type PageKind = "programs" | "resources" | "logs" | "ai" | "themes";

function text(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function rowsOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

function commandStatus(command: CommandPayload | undefined) {
  if (!command) {
    return "UNKNOWN";
  }
  return command.exitCode === 0 ? "OK" : "UNAVAILABLE";
}

function StatusBadge({ value }: { value: unknown }) {
  const normalized = String(value || "").toUpperCase();
  const tone = normalized.includes("OK") || normalized.includes("ACTIVE") || normalized.includes("READY") || normalized.includes("APPLIED")
    ? "bg-emerald-100 text-emerald-700"
    : normalized.includes("PLAN") || normalized.includes("GUARD") || normalized.includes("CANDIDATE") || normalized.includes("REQUIRED")
      ? "bg-amber-100 text-amber-700"
      : normalized.includes("UNAVAILABLE") || normalized.includes("FAIL")
        ? "bg-rose-100 text-rose-700"
        : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${tone}`}>{text(value)}</span>;
}

function SimpleTable({ rows, columns }: { rows: Array<Record<string, unknown>>; columns: Array<{ key: string; label: string; status?: boolean }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)] text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]" key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={columns.length}>No data</td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={`${text(row.name || row.code || row.label || row.location)}-${index}`}>
              {columns.map((column) => (
                <td className="max-w-xl px-4 py-3 align-top" key={column.key}>
                  {column.status ? <StatusBadge value={row[column.key]} /> : <span className="break-words">{text(row[column.key])}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommandPanel({ title, command }: { title: string; command?: CommandPayload }) {
  return (
    <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--kr-gov-border-light)] px-4 py-3">
        <h3 className="text-sm font-black">{title}</h3>
        <StatusBadge value={commandStatus(command)} />
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-4 py-4 text-xs leading-5 text-slate-700">{text(command?.output)}</pre>
    </article>
  );
}

function Summary({ page, en }: { page: OperationsInventoryPayload | null; en: boolean }) {
  const programs = rowsOf(page?.installedPrograms);
  const available = programs.filter((row) => row.available === true).length;
  const kubernetes = page?.kubernetes || {};
  const unavailableK8s = Object.values(kubernetes).filter((command) => commandStatus(command) !== "OK").length;
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryMetricCard title={en ? "Program Checks" : "프로그램 점검"} value={`${available}/${programs.length}`} description={en ? "Detected runtime tools." : "런타임에서 감지된 도구 수입니다."} />
      <SummaryMetricCard title={en ? "Kubernetes Sources" : "쿠버네티스 원천"} value={String(Object.keys(kubernetes).length)} description={en ? `${unavailableK8s} commands unavailable.` : `${unavailableK8s}개 명령 접근 불가입니다.`} />
      <SummaryMetricCard title={en ? "Runtime PID" : "런타임 PID"} value={text(page?.runtime?.pid)} description={en ? "Current JVM process." : "현재 JVM 프로세스입니다."} />
      <SummaryMetricCard title={en ? "Generated At" : "수집 시각"} value={String(page?.generatedAt || "-").slice(11, 19)} description={String(page?.generatedAt || "-")} />
    </section>
  );
}

function ResourceSections({ page, en }: { page: OperationsInventoryPayload | null; en: boolean }) {
  const resources = page?.resources || {};
  const memRows = Object.entries((resources.meminfo || {}) as Record<string, unknown>).map(([key, value]) => ({ key, value }));
  const runtimeRows = Object.entries(page?.runtime || {}).map(([key, value]) => ({ key, value }));
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="gov-card">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <h2 className="text-lg font-black">{en ? "Runtime / Memory" : "런타임 / 메모리"}</h2>
        </div>
        <SimpleTable rows={[...runtimeRows, ...memRows]} columns={[{ key: "key", label: en ? "Key" : "항목" }, { key: "value", label: en ? "Value" : "값" }]} />
      </section>
      <section className="gov-card">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <h2 className="text-lg font-black">{en ? "Disk / Kubernetes" : "디스크 / 쿠버네티스"}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-6">
          <CommandPanel title="df -h /" command={resources.disk as CommandPayload} />
          <CommandPanel title="kubectl pods" command={page?.kubernetes?.carbonetPods} />
          <CommandPanel title="kubectl services" command={page?.kubernetes?.services} />
        </div>
      </section>
    </div>
  );
}

function ProgramSection({ page, en }: { page: OperationsInventoryPayload | null; en: boolean }) {
  return (
    <section className="gov-card">
      <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
        <h2 className="text-lg font-black">{en ? "Installed Program Inventory" : "설치 프로그램 인벤토리"}</h2>
        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
          {en ? "Read-only runtime-visible program checks. Host-wide apt history needs the host collector to persist into DB." : "런타임에서 확인 가능한 프로그램 점검입니다. 호스트 전체 apt 이력은 host collector가 DB에 적재해야 완전해집니다."}
        </p>
      </div>
      <SimpleTable
        rows={rowsOf(page?.installedPrograms)}
        columns={[
          { key: "name", label: en ? "Program" : "프로그램" },
          { key: "available", label: en ? "Available" : "확인", status: true },
          { key: "version", label: en ? "Version / Output" : "버전 / 출력" },
          { key: "checkedAt", label: en ? "Checked At" : "점검 시각" }
        ]}
      />
    </section>
  );
}

function LogSection({ page, en }: { page: OperationsInventoryPayload | null; en: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="gov-card">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <h2 className="text-lg font-black">{en ? "Log Menu Coverage" : "로그 메뉴 커버리지"}</h2>
        </div>
        <SimpleTable rows={rowsOf(page?.logs)} columns={[{ key: "code", label: "Code" }, { key: "location", label: en ? "Location" : "위치" }, { key: "description", label: en ? "Description" : "설명" }]} />
      </section>
      <section className="gov-card">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <h2 className="text-lg font-black">Kubernetes Events</h2>
        </div>
        <div className="p-6">
          <CommandPanel title="kubectl events" command={page?.kubernetes?.events} />
        </div>
      </section>
    </div>
  );
}

function AiSection({ page, en }: { page: OperationsInventoryPayload | null; en: boolean }) {
  return (
    <section className="gov-card">
      <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
        <h2 className="text-lg font-black">{en ? "AI Hangar" : "AI 격납고"}</h2>
        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
          {en ? "Tiny models stay in classification and runbook-selection lanes; destructive recovery remains gated." : "초소형 모델은 장애 분류와 runbook 선택 보조까지만 맡고, 파괴적 복구는 승인 게이트 뒤에 둡니다."}
        </p>
      </div>
      <SimpleTable rows={rowsOf(page?.aiHangar)} columns={[{ key: "name", label: en ? "Model / Lane" : "모델 / 레인" }, { key: "status", label: en ? "Status" : "상태", status: true }, { key: "description", label: en ? "Description" : "설명" }]} />
    </section>
  );
}

function ThemeSection({ page, en }: { page: OperationsInventoryPayload | null; en: boolean }) {
  return (
    <section className="gov-card">
      <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
        <h2 className="text-lg font-black">{en ? "Theme Management" : "테마 관리"}</h2>
        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
          {en ? "Tracks active admin, public, builder, and operations theme profiles before full editor binding." : "전체 편집기 연동 전 관리자, 홈페이지, 빌더, 운영 테마 프로파일을 추적합니다."}
        </p>
      </div>
      <SimpleTable rows={rowsOf(page?.themes)} columns={[{ key: "name", label: en ? "Theme" : "테마" }, { key: "status", label: en ? "Status" : "상태", status: true }, { key: "description", label: en ? "Description" : "설명" }]} />
    </section>
  );
}

function OperationsInventoryPage({ kind }: { kind: PageKind }) {
  const en = isEnglish();
  const state = useAsyncValue(fetchOperationsInventory, []);
  const page = state.value;
  const titleMap = {
    programs: en ? "Installed Program Management" : "설치 프로그램 관리",
    resources: en ? "System Resource Management" : "시스템 리소스 관리",
    logs: en ? "Operations Log Management" : "운영 로그 관리",
    ai: en ? "AI Hangar" : "AI 격납고",
    themes: en ? "Theme Management" : "테마 관리"
  };
  const subtitleMap = {
    programs: en ? "Track runtime-visible installed tools and prepare host package history collection." : "런타임에서 확인 가능한 설치 프로그램과 호스트 패키지 이력 수집 준비 상태를 관리합니다.",
    resources: en ? "Review Linux runtime resources, Kubernetes workload state, and recovery automation coverage." : "리눅스 런타임 리소스, 쿠버네티스 워크로드, 복구 자동화 상태를 확인합니다.",
    logs: en ? "Expose logs that were present in DB or files but missing from admin navigation." : "DB나 파일에는 있으나 관리자 화면에 부족했던 로그 원천을 노출합니다.",
    ai: en ? "Govern tiny AI model usage for incident classification and recovery runbook selection." : "장애 분류와 복구 runbook 선택에 쓰는 초소형 AI 모델 레인을 관리합니다.",
    themes: en ? "Manage admin, homepage, builder, and operations theme profiles." : "관리자, 홈페이지, 빌더, 운영 테마 프로파일을 관리합니다."
  };

  const content = useMemo(() => {
    if (kind === "programs") return <ProgramSection en={en} page={page} />;
    if (kind === "resources") return <ResourceSections en={en} page={page} />;
    if (kind === "logs") return <LogSection en={en} page={page} />;
    if (kind === "ai") return <AiSection en={en} page={page} />;
    return <ThemeSection en={en} page={page} />;
  }, [en, kind, page]);

  logGovernanceScope("PAGE", `operations-${kind}`, { language: en ? "en" : "ko", generatedAt: page?.generatedAt || "" });

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: titleMap[kind] }
      ]}
      sidebarVariant="system"
      title={titleMap[kind]}
      subtitle={subtitleMap[kind]}
      actions={<button className="gov-btn gov-btn-outline" onClick={() => void state.reload()} type="button">{en ? "Refresh" : "새로고침"}</button>}
    >
      <AdminWorkspacePageFrame>
        {state.error ? <div className="rounded-[var(--kr-gov-radius)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</div> : null}
        <Summary en={en} page={page} />
        {content}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export function InstalledProgramsMigrationPage() {
  return <OperationsInventoryPage kind="programs" />;
}

export function SystemResourcesMigrationPage() {
  return <OperationsInventoryPage kind="resources" />;
}

export function OperationsLogManagementMigrationPage() {
  return <OperationsInventoryPage kind="logs" />;
}

export function AiHangarMigrationPage() {
  return <OperationsInventoryPage kind="ai" />;
}

export function ThemeManagementMigrationPage() {
  return <OperationsInventoryPage kind="themes" />;
}
