import { useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type MonitorRow = {
  name: string;
  status: "NORMAL" | "WARN" | "READY" | "BLOCKED";
  owner: string;
  lastRun: string;
  nextRun: string;
  detail: string;
};

type MonitorPageCopy = {
  title: string;
  subtitle: string;
  menu: string;
  summary: Array<{ title: string; value: string; description: string }>;
  rows: MonitorRow[];
  notice: string;
};

type CronSummary = { title: string; value: string; description: string };
type CronJobRow = {
  namespace: string;
  name: string;
  schedule: string;
  timezone: string;
  suspend: boolean;
  concurrencyPolicy: string;
  active: number;
  lastScheduleTime: string;
  lastSuccessfulTime: string;
  createdAt: string;
  successfulHistory: string;
  failedHistory: string;
  startingDeadlineSeconds: string;
  containers: string;
  health: string;
};
type KubernetesJobRow = {
  namespace: string;
  name: string;
  cronJob: string;
  status: string;
  active: string;
  succeeded: string;
  failed: string;
  parallelism: string;
  completions: string;
  backoffLimit: string;
  startTime: string;
  completionTime: string;
  createdAt: string;
};
type CronWarningEvent = {
  namespace: string;
  type: string;
  reason: string;
  objectKind: string;
  objectName: string;
  message: string;
  lastTimestamp: string;
};
type CronMonitoringPayload = {
  summary: CronSummary[];
  health: "NORMAL" | "WARN" | string;
  cronJobs: CronJobRow[];
  jobs: KubernetesJobRow[];
  warningEvents: CronWarningEvent[];
  completeJobs: number;
  suspendedCronJobs: number;
  generatedAt: string;
  source: string;
  error?: string;
};
type BatchPodRow = {
  namespace: string;
  name: string;
  phase: string;
  ready: string;
  restarts: number;
  node: string;
  podIP: string;
  createdAt: string;
  owner: string;
};
type BatchWorkloadRow = {
  kind: string;
  namespace: string;
  name: string;
  ready: string;
  available: string;
  updated: string;
  createdAt: string;
};
type BatchMonitoringPayload = {
  summary: CronSummary[];
  health: "NORMAL" | "WARN" | string;
  jobs: Array<KubernetesJobRow & { owner?: string }>;
  cronJobs: Pick<CronJobRow, "namespace" | "name" | "schedule" | "suspend" | "active" | "lastScheduleTime" | "lastSuccessfulTime" | "containers">[];
  pods: BatchPodRow[];
  workloads: BatchWorkloadRow[];
  warningEvents: CronWarningEvent[];
  completeJobs: number;
  unhealthyPods: number;
  generatedAt: string;
  source: string;
  error?: string;
};
type GitBuildMetric = { title: string; value: string; description: string };
type GitCommitRow = { hash: string; subject: string };
type GitChangedFileRow = { status: string; path: string };
type GitDeploymentRow = {
  title?: string;
  value?: string;
  description?: string;
  namespace?: string;
  name?: string;
  phase?: string;
  ready?: string;
  restarts?: number;
  podIP?: string;
  createdAt?: string;
};
type GitBuildMonitoringPayload = {
  summary: GitBuildMetric[];
  health: "NORMAL" | "WARN" | string;
  git: GitBuildMetric[];
  build: GitBuildMetric[];
  deployment: GitDeploymentRow[];
  recentCommits: GitCommitRow[];
  changedFiles: GitChangedFileRow[];
  branch: string;
  head: string;
  fullHead: string;
  runtimeImage: string;
  generatedAt: string;
  source: string;
  error?: string;
};

function statusClass(status: MonitorRow["status"]) {
  switch (status) {
    case "NORMAL":
    case "READY":
      return "bg-emerald-100 text-emerald-700";
    case "WARN":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function cronStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("complete") || normalized.includes("active") || normalized.includes("normal")) return "bg-emerald-100 text-emerald-700";
  if (normalized.includes("fail") || normalized.includes("warn")) return "bg-rose-100 text-rose-700";
  if (normalized.includes("suspend") || normalized.includes("unknown")) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function formatTime(value: string) {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function CronTableHeader({ labels }: { labels: string[] }) {
  return (
    <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.08em] text-slate-500">
      <tr>{labels.map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr>
    </thead>
  );
}

const COPIES: Record<"cron" | "db" | "batch" | "git", { ko: MonitorPageCopy; en: MonitorPageCopy }> = {
  cron: {
    ko: {
      title: "크론 모니터링",
      subtitle: "스케줄 기반 작업의 최근 실행, 다음 실행, 소유자와 지연 위험을 확인합니다.",
      menu: "크론",
      notice: "현재 화면은 운영자가 크론 작업 상태를 한눈에 확인하는 읽기 전용 모니터링 화면입니다.",
      summary: [
        { title: "등록 크론", value: "4", description: "관리 화면에서 추적 중인 정기 작업 수" },
        { title: "정상 작업", value: "3", description: "최근 실행과 다음 실행이 확인된 작업" },
        { title: "검토 필요", value: "1", description: "수동 실행 또는 지연 검토가 필요한 작업" },
        { title: "기준 주기", value: "10분", description: "보안/정책 유지 작업 기본 점검 주기" }
      ],
      rows: [
        { name: "security-policy-expire", status: "NORMAL", owner: "보안정책", lastRun: "10분 전", nextRun: "5분 후", detail: "만료 정책 정리 스케줄" },
        { name: "security-policy-unlock", status: "NORMAL", owner: "보안정책", lastRun: "8분 전", nextRun: "2분 후", detail: "잠금 해제 후보 정리" },
        { name: "backup-snapshot", status: "READY", owner: "백업", lastRun: "02:00", nextRun: "내일 02:00", detail: "일일 백업 스냅샷" },
        { name: "manual-db-sync-review", status: "WARN", owner: "DB 운영", lastRun: "수동", nextRun: "승인 후", detail: "수동 승인 기반 DB 동기화 검토" }
      ]
    },
    en: {
      title: "Cron Monitoring",
      subtitle: "Review recent runs, next runs, ownership, and delay risk for scheduled jobs.",
      menu: "Cron",
      notice: "This read-only monitoring page helps operators inspect scheduled job health at a glance.",
      summary: [
        { title: "Registered Cron", value: "4", description: "Scheduled jobs tracked by admin operations" },
        { title: "Normal Jobs", value: "3", description: "Jobs with recent and next run evidence" },
        { title: "Needs Review", value: "1", description: "Jobs requiring manual or delay review" },
        { title: "Base Interval", value: "10m", description: "Default policy/security maintenance interval" }
      ],
      rows: [
        { name: "security-policy-expire", status: "NORMAL", owner: "Security Policy", lastRun: "10m ago", nextRun: "5m later", detail: "Expire policy cleanup schedule" },
        { name: "security-policy-unlock", status: "NORMAL", owner: "Security Policy", lastRun: "8m ago", nextRun: "2m later", detail: "Unlock candidate cleanup" },
        { name: "backup-snapshot", status: "READY", owner: "Backup", lastRun: "02:00", nextRun: "Tomorrow 02:00", detail: "Daily backup snapshot" },
        { name: "manual-db-sync-review", status: "WARN", owner: "DB Ops", lastRun: "Manual", nextRun: "After approval", detail: "Manual approval based DB sync review" }
      ]
    }
  },
  db: {
    ko: {
      title: "DB 모니터링",
      subtitle: "DB 연결, Patroni/백업/동기화 관점의 운영 상태를 확인합니다.",
      menu: "DB",
      notice: "DB 변경 실행 화면과 분리된 관측 전용 화면입니다. 실제 반영은 DB 동기화 배포 화면에서 승인 후 진행합니다.",
      summary: [
        { title: "API 상태", value: "UP", description: "모니터링 API 응답 가능" },
        { title: "HA 노드", value: "3", description: "Patroni 데이터 폴더 기준 관측 대상" },
        { title: "백업 정책", value: "등록", description: "백업 설정 화면과 연계" },
        { title: "변경 실행", value: "분리", description: "DB sync deploy 에서 별도 승인" }
      ],
      rows: [
        { name: "primary-connection", status: "NORMAL", owner: "DB 운영", lastRun: "실시간", nextRun: "상시", detail: "애플리케이션 DB 연결 관측" },
        { name: "patroni-member-check", status: "READY", owner: "HA", lastRun: "1분 전", nextRun: "1분 후", detail: "Patroni 구성원 상태 점검" },
        { name: "backup-policy-link", status: "NORMAL", owner: "백업", lastRun: "최근 배포", nextRun: "정책 변경 시", detail: "백업 설정과 동기화" },
        { name: "schema-change-guard", status: "BLOCKED", owner: "DB 거버넌스", lastRun: "승인 대기", nextRun: "티켓 승인 후", detail: "무승인 schema 변경 차단" }
      ]
    },
    en: {
      title: "DB Monitoring",
      subtitle: "Inspect DB connection, Patroni, backup, and sync operation state.",
      menu: "DB",
      notice: "This is an observation-only page separated from DB mutation execution. Real apply work stays behind DB Sync Deploy approval.",
      summary: [
        { title: "API State", value: "UP", description: "Monitoring API is reachable" },
        { title: "HA Nodes", value: "3", description: "Observed from Patroni data folders" },
        { title: "Backup Policy", value: "Set", description: "Linked with backup configuration" },
        { title: "Mutation", value: "Separated", description: "Approved in DB Sync Deploy" }
      ],
      rows: [
        { name: "primary-connection", status: "NORMAL", owner: "DB Ops", lastRun: "Live", nextRun: "Always", detail: "Application DB connection observation" },
        { name: "patroni-member-check", status: "READY", owner: "HA", lastRun: "1m ago", nextRun: "1m later", detail: "Patroni member health check" },
        { name: "backup-policy-link", status: "NORMAL", owner: "Backup", lastRun: "Recent deploy", nextRun: "On policy change", detail: "Sync with backup config" },
        { name: "schema-change-guard", status: "BLOCKED", owner: "DB Governance", lastRun: "Approval pending", nextRun: "After ticket", detail: "Blocks unapproved schema mutations" }
      ]
    }
  },
  batch: {
    ko: {
      title: "배치 모니터링",
      subtitle: "배치 잡, 큐 적체, 워커 상태와 최근 실패를 운영 관점에서 확인합니다.",
      menu: "배치",
      notice: "이 화면은 배치 관리 화면의 변경 액션과 분리된 읽기 전용 상황판입니다.",
      summary: [
        { title: "조회 잡", value: "6", description: "운영 모니터링 대상 배치" },
        { title: "대기 큐", value: "12", description: "검토가 필요한 큐 적체 합계" },
        { title: "워커", value: "2", description: "활성/대기 워커" },
        { title: "실패", value: "1", description: "최근 재검토 대상 실행" }
      ],
      rows: [
        { name: "emission-rollup", status: "NORMAL", owner: "탄소 집계", lastRun: "15분 전", nextRun: "15분 후", detail: "배출량 집계 배치" },
        { name: "report-packaging", status: "READY", owner: "보고서", lastRun: "1시간 전", nextRun: "대기", detail: "보고서 패키징 큐" },
        { name: "certificate-sync", status: "WARN", owner: "인증서", lastRun: "실패 1건", nextRun: "재시도 대기", detail: "외부 연계 응답 지연" },
        { name: "audit-rollover", status: "NORMAL", owner: "감사", lastRun: "오늘 00:00", nextRun: "내일 00:00", detail: "감사 로그 롤오버" }
      ]
    },
    en: {
      title: "Batch Monitoring",
      subtitle: "Inspect batch jobs, queue backlog, worker health, and recent failures.",
      menu: "Batch",
      notice: "This read-only dashboard is separated from mutation actions in Batch Management.",
      summary: [
        { title: "Visible Jobs", value: "6", description: "Batch jobs under operations monitoring" },
        { title: "Queued", value: "12", description: "Backlog requiring review" },
        { title: "Workers", value: "2", description: "Active or standby workers" },
        { title: "Failures", value: "1", description: "Recent execution requiring review" }
      ],
      rows: [
        { name: "emission-rollup", status: "NORMAL", owner: "Emission", lastRun: "15m ago", nextRun: "15m later", detail: "Emission rollup batch" },
        { name: "report-packaging", status: "READY", owner: "Report", lastRun: "1h ago", nextRun: "Queued", detail: "Report packaging queue" },
        { name: "certificate-sync", status: "WARN", owner: "Certificate", lastRun: "1 failure", nextRun: "Retry pending", detail: "External integration delay" },
        { name: "audit-rollover", status: "NORMAL", owner: "Audit", lastRun: "Today 00:00", nextRun: "Tomorrow 00:00", detail: "Audit log rollover" }
      ]
    }
  },
  git: {
    ko: {
      title: "Git/빌드 모니터링",
      subtitle: "소스 변경, 빌드 산출물, 오버레이 가드와 배포 신선도 상태를 확인합니다.",
      menu: "Git/빌드",
      notice: "현재 Gradle 런타임과 프론트 오버레이 가드 기준으로 빌드/배포 신선도를 확인하는 화면입니다.",
      summary: [
        { title: "빌드 방식", value: "Gradle", description: "현재 런타임 이미지 기준" },
        { title: "프론트 가드", value: "ON", description: "소스 해시/HTTP 자산 검증" },
        { title: "오버레이", value: "정상", description: "정적 자산 hostPath 반영" },
        { title: "재배포", value: "분리", description: "프론트 변경은 가드 후 재시작" }
      ],
      rows: [
        { name: "frontend-overlay-guard", status: "NORMAL", owner: "Frontend", lastRun: "최근 배포", nextRun: "다음 배포", detail: "해시/자산/HTTP 검증" },
        { name: "gradle-runtime-image", status: "READY", owner: "Runtime", lastRun: "2026.07.08", nextRun: "Java 변경 시", detail: "Gradle 기반 런타임 이미지" },
        { name: "source-marker", status: "NORMAL", owner: "Build", lastRun: "최근 빌드", nextRun: "프론트 변경 시", detail: "소스 해시 마커 검증" },
        { name: "git-backup-target", status: "READY", owner: "Backup", lastRun: "설정 연계", nextRun: "정책 변경 시", detail: "Git 소스 백업 대상" }
      ]
    },
    en: {
      title: "Git/Build Monitoring",
      subtitle: "Inspect source changes, build output, overlay guard, and deploy freshness.",
      menu: "Git/Build",
      notice: "This screen monitors build/deploy freshness using the Gradle runtime and frontend overlay guard.",
      summary: [
        { title: "Build Tool", value: "Gradle", description: "Current runtime image basis" },
        { title: "Frontend Guard", value: "ON", description: "Source hash and HTTP asset checks" },
        { title: "Overlay", value: "Normal", description: "Static assets on hostPath" },
        { title: "Redeploy", value: "Split", description: "Frontend changes restart after guard" }
      ],
      rows: [
        { name: "frontend-overlay-guard", status: "NORMAL", owner: "Frontend", lastRun: "Recent deploy", nextRun: "Next deploy", detail: "Hash, asset, and HTTP checks" },
        { name: "gradle-runtime-image", status: "READY", owner: "Runtime", lastRun: "2026.07.08", nextRun: "On Java change", detail: "Gradle-based runtime image" },
        { name: "source-marker", status: "NORMAL", owner: "Build", lastRun: "Recent build", nextRun: "On frontend change", detail: "Source hash marker check" },
        { name: "git-backup-target", status: "READY", owner: "Backup", lastRun: "Config linked", nextRun: "On policy change", detail: "Git source backup target" }
      ]
    }
  }
};

function MonitoringOperationsPage({ kind }: { kind: keyof typeof COPIES }) {
  const en = isEnglish();
  const copy = COPIES[kind][en ? "en" : "ko"];
  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Monitoring" : "모니터링" },
        { label: copy.menu }
      ]}
      title={copy.title}
      subtitle={copy.subtitle}
      sidebarVariant="system"
    >
      <AdminWorkspacePageFrame>
        <PageStatusNotice tone="info">{copy.notice}</PageStatusNotice>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.summary.map((item) => (
            <SummaryMetricCard key={item.title} title={item.title} value={item.value} description={item.description} />
          ))}
        </section>
        <section className="gov-card overflow-hidden">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Monitoring Rows" : "모니터링 항목"}</h2>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Status, owner, run time, and operator note are shown together." : "상태, 소유자, 실행 시각, 운영 메모를 함께 표시합니다."}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">{en ? "Name" : "이름"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-3">{en ? "Owner" : "소유자"}</th>
                  <th className="px-4 py-3">{en ? "Last Run" : "최근 실행"}</th>
                  <th className="px-4 py-3">{en ? "Next Run" : "다음 실행"}</th>
                  <th className="px-4 py-3">{en ? "Detail" : "상세"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {copy.rows.map((row) => (
                  <tr key={row.name}>
                    <td className="px-4 py-3 font-mono text-[13px] font-bold">{row.name}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass(row.status)}`}>{row.status}</span></td>
                    <td className="px-4 py-3">{row.owner}</td>
                    <td className="px-4 py-3">{row.lastRun}</td>
                    <td className="px-4 py-3">{row.nextRun}</td>
                    <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export function CronMonitoringPage() {
  const en = isEnglish();
  const [payload, setPayload] = useState<CronMonitoringPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    try {
      setError(null);
      const response = await fetch("/admin/api/cron-monitoring/status", {
        credentials: "include",
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setPayload(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => { void load(); }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const cronJobs = payload?.cronJobs ?? [];
  const jobs = payload?.jobs ?? [];
  const warningEvents = payload?.warningEvents ?? [];
  const failedJobs = useMemo(() => jobs.filter((job) => job.status === "Failed").length, [jobs]);
  const completeJobs = payload?.completeJobs ?? jobs.filter((job) => job.status === "Complete").length;
  const runningJobs = jobs.filter((job) => job.status === "Running").length;
  const health = payload?.health ?? (failedJobs > 0 || warningEvents.length > 0 ? "WARN" : "NORMAL");
  const summary = payload?.summary?.length ? payload.summary : [
    { title: "CronJobs", value: String(cronJobs.length), description: "Kubernetes CronJob resources" },
    { title: "Active Jobs", value: String(runningJobs), description: "Currently running Job resources" },
    { title: "Failed Jobs", value: String(failedJobs), description: "Historical or retained failed Jobs" },
    { title: "Warning Events", value: String(warningEvents.length), description: "Recent warning events related to cron/backup" }
  ];

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Monitoring" : "모니터링" },
        { label: en ? "Cron" : "크론" }
      ]}
      title={en ? "Kubernetes Cron Monitoring" : "Kubernetes 크론 모니터링"}
      subtitle={en ? "Live CronJob, Job, backup schedule, and warning event state from the current cluster." : "현재 클러스터의 CronJob, Job, 백업 스케줄, Warning 이벤트 상태를 실시간으로 확인합니다."}
      sidebarVariant="system"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && <span className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Updated" : "갱신"}: {lastUpdated.toLocaleTimeString()}</span>}
          <label className="flex items-center gap-1.5 text-sm text-[var(--kr-gov-text-secondary)]">
            <input className="gov-checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} type="checkbox" />
            {en ? "Auto-refresh (30s)" : "자동 새로고침 (30초)"}
          </label>
          <button className="gov-btn gov-btn-outline" onClick={() => void load()} type="button">{en ? "Refresh" : "새로고침"}</button>
        </div>
      }
    >
      <AdminWorkspacePageFrame>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {error && <PageStatusNotice tone="warning">{en ? "Failed to load live cron data." : "실시간 크론 데이터를 불러오지 못했습니다."} ({error})</PageStatusNotice>}
            {payload?.error && <PageStatusNotice tone="warning">{payload.error}</PageStatusNotice>}
            <PageStatusNotice tone={health === "WARN" ? "warning" : "info"}>
              {health === "WARN"
                ? (en ? "Warning state detected. Check failed backup jobs and warning events below." : "경고 상태가 감지되었습니다. 아래 실패 백업 Job과 Warning 이벤트를 확인하십시오.")
                : (en ? "Cron resources are currently normal." : "현재 크론 리소스는 정상 범위입니다.")}
            </PageStatusNotice>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summary.map((item) => (
                <SummaryMetricCard key={item.title} title={item.title} value={item.value} description={item.description} />
              ))}
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryMetricCard title={en ? "Cluster Health" : "클러스터 상태"} value={health} description={payload?.source ?? "kubectl"} />
              <SummaryMetricCard title={en ? "Completed Jobs" : "완료 Job"} value={String(completeJobs)} description={en ? "Retained successful jobs" : "보존 중인 성공 Job"} />
              <SummaryMetricCard title={en ? "Suspended CronJobs" : "중지 CronJob"} value={String(payload?.suspendedCronJobs ?? 0)} description={en ? "CronJobs with suspend=true" : "suspend=true 리소스"} />
              <SummaryMetricCard title={en ? "Generated At" : "생성 시각"} value={formatTime(payload?.generatedAt ?? "-")} description={en ? "Backend collection timestamp" : "백엔드 수집 시각"} />
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "CronJob Resources" : "CronJob 리소스"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Schedules, suspend state, last schedule, last success, and container image are shown from Kubernetes." : "Kubernetes에서 읽은 스케줄, 중지 여부, 최근 실행/성공 시각, 컨테이너 이미지를 표시합니다."}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <CronTableHeader labels={["Namespace", "Name", "Schedule", "Suspend", "Active", "Last Schedule", "Last Success", "Concurrency", "Container / Image"]} />
                  <tbody className="divide-y divide-gray-100">
                    {cronJobs.map((row) => (
                      <tr key={`${row.namespace}-${row.name}`}>
                        <td className="px-4 py-3">{row.namespace}</td>
                        <td className="px-4 py-3 font-mono text-[13px] font-bold">{row.name}</td>
                        <td className="px-4 py-3 font-mono text-[13px]">{row.schedule}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${cronStatusClass(row.suspend ? "SUSPENDED" : "ACTIVE")}`}>{row.suspend ? "SUSPENDED" : "ACTIVE"}</span></td>
                        <td className="px-4 py-3">{row.active}</td>
                        <td className="px-4 py-3">{formatTime(row.lastScheduleTime)}</td>
                        <td className="px-4 py-3">{formatTime(row.lastSuccessfulTime)}</td>
                        <td className="px-4 py-3">{row.concurrencyPolicy}</td>
                        <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{row.containers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Recent Kubernetes Jobs" : "최근 Kubernetes Job"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Newest jobs are listed first. Failed backup jobs remain visible for diagnosis." : "최신 Job을 먼저 표시합니다. 실패한 백업 Job은 원인 점검을 위해 남겨 보여줍니다."}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <CronTableHeader labels={["Namespace", "Job", "CronJob", "Status", "Succeeded", "Failed", "Backoff", "Started", "Completed"]} />
                  <tbody className="divide-y divide-gray-100">
                    {jobs.map((row) => (
                      <tr key={`${row.namespace}-${row.name}`}>
                        <td className="px-4 py-3">{row.namespace}</td>
                        <td className="px-4 py-3 font-mono text-[13px] font-bold">{row.name}</td>
                        <td className="px-4 py-3">{row.cronJob}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${cronStatusClass(row.status)}`}>{row.status}</span></td>
                        <td className="px-4 py-3">{row.succeeded}</td>
                        <td className="px-4 py-3">{row.failed}</td>
                        <td className="px-4 py-3">{row.backoffLimit}</td>
                        <td className="px-4 py-3">{formatTime(row.startTime)}</td>
                        <td className="px-4 py-3">{formatTime(row.completionTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Warning Events" : "Warning 이벤트"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Cron or backup-related Kubernetes warning events are collected for quick incident review." : "크론/백업 관련 Kubernetes Warning 이벤트를 모아 장애 검토에 바로 사용할 수 있게 표시합니다."}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <CronTableHeader labels={["Time", "Namespace", "Object", "Reason", "Message"]} />
                  <tbody className="divide-y divide-gray-100">
                    {warningEvents.length === 0 ? (
                      <tr><td className="px-4 py-6 text-center text-[var(--kr-gov-text-secondary)]" colSpan={5}>{en ? "No warning events." : "Warning 이벤트가 없습니다."}</td></tr>
                    ) : warningEvents.map((row, index) => (
                      <tr key={`${row.objectName}-${row.reason}-${index}`}>
                        <td className="px-4 py-3">{formatTime(row.lastTimestamp)}</td>
                        <td className="px-4 py-3">{row.namespace}</td>
                        <td className="px-4 py-3 font-mono text-[13px]">{row.objectKind}/{row.objectName}</td>
                        <td className="px-4 py-3"><span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-black text-rose-700">{row.reason}</span></td>
                        <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export function DbMonitoringPage() {
  return <MonitoringOperationsPage kind="db" />;
}

export function BatchMonitoringPage() {
  const en = isEnglish();
  const [payload, setPayload] = useState<BatchMonitoringPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    try {
      setError(null);
      const response = await fetch("/admin/api/batch-monitoring/status", {
        credentials: "include",
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setPayload(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => { void load(); }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const jobs = payload?.jobs ?? [];
  const cronJobs = payload?.cronJobs ?? [];
  const pods = payload?.pods ?? [];
  const workloads = payload?.workloads ?? [];
  const warningEvents = payload?.warningEvents ?? [];
  const failedJobs = useMemo(() => jobs.filter((job) => job.status === "Failed").length, [jobs]);
  const runningJobs = jobs.filter((job) => job.status === "Running").length;
  const completeJobs = payload?.completeJobs ?? jobs.filter((job) => job.status === "Complete").length;
  const health = payload?.health ?? (failedJobs > 0 || warningEvents.length > 0 ? "WARN" : "NORMAL");
  const summary = payload?.summary?.length ? payload.summary : [
    { title: "Jobs", value: String(jobs.length), description: "Kubernetes Job resources" },
    { title: "Running Jobs", value: String(runningJobs), description: "Currently active batch executions" },
    { title: "Failed Jobs", value: String(failedJobs), description: "Retained failed batch executions" },
    { title: "Warning Events", value: String(warningEvents.length), description: "Batch-related Kubernetes warning events" }
  ];

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Monitoring" : "모니터링" },
        { label: en ? "Batch" : "배치" }
      ]}
      title={en ? "Kubernetes Batch Monitoring" : "Kubernetes 배치 모니터링"}
      subtitle={en ? "Live Job, CronJob, related Pod, workload, and warning event state from the current cluster." : "현재 클러스터의 Job, CronJob, 관련 Pod, 워크로드, Warning 이벤트 상태를 실시간으로 확인합니다."}
      sidebarVariant="system"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && <span className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Updated" : "갱신"}: {lastUpdated.toLocaleTimeString()}</span>}
          <label className="flex items-center gap-1.5 text-sm text-[var(--kr-gov-text-secondary)]">
            <input className="gov-checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} type="checkbox" />
            {en ? "Auto-refresh (30s)" : "자동 새로고침 (30초)"}
          </label>
          <button className="gov-btn gov-btn-outline" onClick={() => void load()} type="button">{en ? "Refresh" : "새로고침"}</button>
        </div>
      }
    >
      <AdminWorkspacePageFrame>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {error && <PageStatusNotice tone="warning">{en ? "Failed to load live batch data." : "실시간 배치 데이터를 불러오지 못했습니다."} ({error})</PageStatusNotice>}
            {payload?.error && <PageStatusNotice tone="warning">{payload.error}</PageStatusNotice>}
            <PageStatusNotice tone={health === "WARN" ? "warning" : "info"}>
              {health === "WARN"
                ? (en ? "Warning state detected. Check failed jobs, unhealthy pods, and warning events below." : "경고 상태가 감지되었습니다. 아래 실패 Job, 비정상 Pod, Warning 이벤트를 확인하십시오.")
                : (en ? "Batch resources are currently normal." : "현재 배치 리소스는 정상 범위입니다.")}
            </PageStatusNotice>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summary.map((item) => (
                <SummaryMetricCard key={item.title} title={item.title} value={item.value} description={item.description} />
              ))}
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryMetricCard title={en ? "Cluster Health" : "클러스터 상태"} value={health} description={payload?.source ?? "Kubernetes API"} />
              <SummaryMetricCard title={en ? "Completed Jobs" : "완료 Job"} value={String(completeJobs)} description={en ? "Retained successful executions" : "보존 중인 성공 실행"} />
              <SummaryMetricCard title={en ? "Unhealthy Pods" : "비정상 Pod"} value={String(payload?.unhealthyPods ?? 0)} description={en ? "Related pods not Running/Succeeded" : "관련 Pod 중 Running/Succeeded 아님"} />
              <SummaryMetricCard title={en ? "Generated At" : "생성 시각"} value={formatTime(payload?.generatedAt ?? "-")} description={en ? "Backend collection timestamp" : "백엔드 수집 시각"} />
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Recent Batch Jobs" : "최근 배치 Job"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Newest jobs are listed first with execution result and retry policy." : "최신 Job을 먼저 표시하고 실행 결과와 재시도 정책을 함께 보여줍니다."}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <CronTableHeader labels={["Namespace", "Job", "Owner", "Status", "Active", "Succeeded", "Failed", "Backoff", "Started", "Completed"]} />
                  <tbody className="divide-y divide-gray-100">
                    {jobs.map((row) => (
                      <tr key={`${row.namespace}-${row.name}`}>
                        <td className="px-4 py-3">{row.namespace}</td>
                        <td className="px-4 py-3 font-mono text-[13px] font-bold">{row.name}</td>
                        <td className="px-4 py-3">{row.owner ?? row.cronJob}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${cronStatusClass(row.status)}`}>{row.status}</span></td>
                        <td className="px-4 py-3">{row.active}</td>
                        <td className="px-4 py-3">{row.succeeded}</td>
                        <td className="px-4 py-3">{row.failed}</td>
                        <td className="px-4 py-3">{row.backoffLimit}</td>
                        <td className="px-4 py-3">{formatTime(row.startTime)}</td>
                        <td className="px-4 py-3">{formatTime(row.completionTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Batch Schedules" : "배치 스케줄"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "CronJob schedules and last execution timestamps are shown together." : "CronJob 스케줄과 최근 실행/성공 시각을 함께 표시합니다."}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <CronTableHeader labels={["Namespace", "CronJob", "Schedule", "Suspend", "Active", "Last Schedule", "Last Success", "Container / Image"]} />
                  <tbody className="divide-y divide-gray-100">
                    {cronJobs.map((row) => (
                      <tr key={`${row.namespace}-${row.name}`}>
                        <td className="px-4 py-3">{row.namespace}</td>
                        <td className="px-4 py-3 font-mono text-[13px] font-bold">{row.name}</td>
                        <td className="px-4 py-3 font-mono text-[13px]">{row.schedule}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${cronStatusClass(row.suspend ? "SUSPENDED" : "ACTIVE")}`}>{row.suspend ? "SUSPENDED" : "ACTIVE"}</span></td>
                        <td className="px-4 py-3">{row.active}</td>
                        <td className="px-4 py-3">{formatTime(row.lastScheduleTime)}</td>
                        <td className="px-4 py-3">{formatTime(row.lastSuccessfulTime)}</td>
                        <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{row.containers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Related Pods" : "관련 Pod"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Batch-related pod phase, readiness, restart count, node, and owner are displayed." : "배치 관련 Pod의 상태, 준비율, 재시작 수, 노드, 소유자를 표시합니다."}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <CronTableHeader labels={["Namespace", "Pod", "Phase", "Ready", "Restarts", "Node", "IP", "Owner", "Created"]} />
                  <tbody className="divide-y divide-gray-100">
                    {pods.map((row) => (
                      <tr key={`${row.namespace}-${row.name}`}>
                        <td className="px-4 py-3">{row.namespace}</td>
                        <td className="px-4 py-3 font-mono text-[13px] font-bold">{row.name}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${cronStatusClass(row.phase)}`}>{row.phase}</span></td>
                        <td className="px-4 py-3">{row.ready}</td>
                        <td className="px-4 py-3">{row.restarts}</td>
                        <td className="px-4 py-3">{row.node}</td>
                        <td className="px-4 py-3">{row.podIP}</td>
                        <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{row.owner}</td>
                        <td className="px-4 py-3">{formatTime(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Related Workloads" : "관련 워크로드"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Deployments and StatefulSets that can affect batch execution are summarized." : "배치 실행에 영향을 줄 수 있는 Deployment와 StatefulSet 준비 상태를 요약합니다."}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <CronTableHeader labels={["Kind", "Namespace", "Name", "Ready", "Available", "Updated", "Created"]} />
                  <tbody className="divide-y divide-gray-100">
                    {workloads.map((row) => (
                      <tr key={`${row.kind}-${row.namespace}-${row.name}`}>
                        <td className="px-4 py-3">{row.kind}</td>
                        <td className="px-4 py-3">{row.namespace}</td>
                        <td className="px-4 py-3 font-mono text-[13px] font-bold">{row.name}</td>
                        <td className="px-4 py-3">{row.ready}</td>
                        <td className="px-4 py-3">{row.available}</td>
                        <td className="px-4 py-3">{row.updated}</td>
                        <td className="px-4 py-3">{formatTime(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Warning Events" : "Warning 이벤트"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Batch, job, cron, backup, queue, and worker warning events are collected." : "배치, Job, Cron, 백업, 큐, 워커 관련 Warning 이벤트를 모아 표시합니다."}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <CronTableHeader labels={["Time", "Namespace", "Object", "Reason", "Message"]} />
                  <tbody className="divide-y divide-gray-100">
                    {warningEvents.length === 0 ? (
                      <tr><td className="px-4 py-6 text-center text-[var(--kr-gov-text-secondary)]" colSpan={5}>{en ? "No warning events." : "Warning 이벤트가 없습니다."}</td></tr>
                    ) : warningEvents.map((row, index) => (
                      <tr key={`${row.objectName}-${row.reason}-${index}`}>
                        <td className="px-4 py-3">{formatTime(row.lastTimestamp)}</td>
                        <td className="px-4 py-3">{row.namespace}</td>
                        <td className="px-4 py-3 font-mono text-[13px]">{row.objectKind}/{row.objectName}</td>
                        <td className="px-4 py-3"><span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-black text-rose-700">{row.reason}</span></td>
                        <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export function GitBuildMonitoringPage() {
  const en = isEnglish();
  const [payload, setPayload] = useState<GitBuildMonitoringPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedVersionHash, setSelectedVersionHash] = useState("");
  const [compareBaseHash, setCompareBaseHash] = useState("");
  const [promotionMode, setPromotionMode] = useState<"preview" | "isolated-build" | "deploy">("preview");
  const [promotionMessage, setPromotionMessage] = useState("");

  const load = async () => {
    try {
      setError(null);
      const response = await fetch("/admin/api/git-build-monitoring/status", {
        credentials: "include",
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setPayload(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => { void load(); }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const summary = payload?.summary?.length ? payload.summary : [
    { title: "HEAD", value: payload?.head ?? "-", description: payload?.branch ?? "Current revision" },
    { title: "Runtime Image", value: payload?.runtimeImage ?? "-", description: "Current deployed image" },
    { title: "Changed Files", value: String(payload?.changedFiles?.length ?? 0), description: "Visible git status rows" },
    { title: "Health", value: payload?.health ?? "UNKNOWN", description: "Git/build monitoring state" }
  ];
  const health = payload?.health ?? "UNKNOWN";
  const gitRows = payload?.git ?? [];
  const buildRows = payload?.build ?? [];
  const deploymentRows = payload?.deployment ?? [];
  const commits = payload?.recentCommits ?? [];
  const changedFiles = payload?.changedFiles ?? [];
  const podRows = deploymentRows.filter((row) => row.name);
  const deploymentMetrics = deploymentRows.filter((row) => row.title);
  const selectedVersion = commits.find((row) => row.hash === selectedVersionHash) ?? commits[0];
  const compareBaseVersion = commits.find((row) => row.hash === compareBaseHash) ?? commits[1] ?? commits[0];
  const selectedVersionIndex = selectedVersion ? commits.findIndex((row) => row.hash === selectedVersion.hash) : -1;
  const compareBaseIndex = compareBaseVersion ? commits.findIndex((row) => row.hash === compareBaseVersion.hash) : -1;
  const versionDistance = selectedVersionIndex >= 0 && compareBaseIndex >= 0 ? Math.abs(compareBaseIndex - selectedVersionIndex) : 0;
  const versionApplyCommand = selectedVersion
    ? `git worktree add /opt/Resonance-worktrees/${selectedVersion.hash} ${selectedVersion.hash} && npm run build && deploy tag ${selectedVersion.hash}`
    : "-";
  const promotionSteps = [
    { title: en ? "1. Select" : "1. 선택", value: selectedVersion?.hash ?? "-", description: selectedVersion?.subject ?? (en ? "Choose a commit first." : "먼저 커밋을 선택합니다.") },
    { title: en ? "2. Compare" : "2. 비교", value: compareBaseVersion?.hash ?? "-", description: en ? `${versionDistance} commit distance from selected version` : `선택 버전과 ${versionDistance}개 커밋 거리` },
    { title: en ? "3. Build" : "3. 빌드", value: promotionMode === "deploy" ? "release" : promotionMode, description: en ? "Build in an isolated worktree before touching main." : "main을 건드리기 전에 격리 worktree에서 빌드합니다." },
    { title: en ? "4. Promote" : "4. 반영", value: promotionMode === "deploy" ? "manual approval" : "blocked", description: en ? "Production deployment must be a final single-version decision." : "운영 반영은 최종 1개 버전 승인 후 진행해야 합니다." }
  ];
  const requestVersionAction = (action: "diff" | "build" | "deploy") => {
    const version = selectedVersion?.hash ?? "-";
    const base = compareBaseVersion?.hash ?? "-";
    const label = action === "diff" ? "Diff" : action === "build" ? "격리 빌드" : "최종 배포";
    setPromotionMessage(`${label} 요청 준비: ${base} → ${version}. 실제 실행을 위해서는 /admin/api/git-build-monitoring/${action} 백엔드 API와 승인 로그 저장이 필요합니다.`);
  };

  useEffect(() => {
    if (!commits.length) return;
    setSelectedVersionHash((current) => current || commits[0]?.hash || "");
    setCompareBaseHash((current) => current || commits[1]?.hash || commits[0]?.hash || "");
  }, [commits]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Monitoring" : "모니터링" },
        { label: en ? "Git/Build" : "Git/빌드" }
      ]}
      title={en ? "Git/Build Monitoring" : "Git/빌드 모니터링"}
      subtitle={en ? "Check source revision, working tree state, runtime image, rollout, and frontend overlay freshness." : "소스 리비전, 작업트리 상태, 런타임 이미지, 롤아웃, 프론트 오버레이 신선도를 확인합니다."}
      sidebarVariant="system"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && <span className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Updated" : "갱신"}: {lastUpdated.toLocaleTimeString()}</span>}
          <label className="flex items-center gap-1.5 text-sm text-[var(--kr-gov-text-secondary)]">
            <input className="gov-checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} type="checkbox" />
            {en ? "Auto-refresh (30s)" : "자동 새로고침 (30초)"}
          </label>
          <button className="gov-btn gov-btn-outline" onClick={() => void load()} type="button">{en ? "Refresh" : "새로고침"}</button>
        </div>
      }
    >
      <AdminWorkspacePageFrame>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {error && <PageStatusNotice tone="warning">{en ? "Failed to load live git/build data." : "실시간 Git/빌드 데이터를 불러오지 못했습니다."} ({error})</PageStatusNotice>}
            {payload?.error && <PageStatusNotice tone="warning">{payload.error}</PageStatusNotice>}
            <PageStatusNotice tone={health === "WARN" ? "warning" : "info"}>
              {health === "WARN"
                ? (en ? "Uncommitted source changes or build freshness warnings are visible below." : "커밋되지 않은 소스 변경 또는 빌드 신선도 경고가 아래에 표시됩니다.")
                : (en ? "Git/build state is currently within the expected range." : "현재 Git/빌드 상태는 정상 범위입니다.")}
            </PageStatusNotice>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summary.map((item) => (
                <SummaryMetricCard key={item.title} title={item.title} value={item.value} description={item.description} />
              ))}
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryMetricCard title={en ? "Branch" : "브랜치"} value={payload?.branch ?? "-"} description={en ? "Current source branch" : "현재 소스 브랜치"} />
              <SummaryMetricCard title={en ? "HEAD" : "HEAD"} value={payload?.head ?? "-"} description={payload?.fullHead ?? "-"} />
              <SummaryMetricCard title={en ? "Runtime Image" : "런타임 이미지"} value={payload?.runtimeImage ?? "-"} description={en ? "Kubernetes deployment image" : "Kubernetes Deployment 이미지"} />
              <SummaryMetricCard title={en ? "Generated At" : "생성 시각"} value={formatTime(payload?.generatedAt ?? "-")} description={payload?.source ?? "Git/build API"} />
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Git State" : "Git 상태"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Branch, upstream, HEAD, and ahead/behind state are shown when the repository is visible to runtime." : "런타임에서 저장소가 보이는 경우 브랜치, upstream, HEAD, ahead/behind 상태를 표시합니다."}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                {gitRows.map((row) => (
                  <SummaryMetricCard key={row.title} title={row.title} value={row.value} description={row.description} />
                ))}
              </div>
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Build Freshness" : "빌드 신선도"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Repository visibility, working tree, overlay marker, index file, and runtime manifest fingerprints are shown." : "저장소 가시성, 작업트리, 오버레이 마커, index 파일, 런타임 manifest 지문을 표시합니다."}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                {buildRows.map((row) => (
                  <SummaryMetricCard key={row.title} title={row.title} value={row.value} description={row.description} />
                ))}
              </div>
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Deployment State" : "배포 상태"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Deployment image, rollout generation, ready replicas, and runtime pods are collected from Kubernetes." : "Deployment 이미지, 롤아웃 세대, ready replica, 런타임 Pod를 Kubernetes에서 수집합니다."}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                {deploymentMetrics.map((row) => (
                  <SummaryMetricCard key={row.title} title={row.title ?? "-"} value={row.value ?? "-"} description={row.description ?? "-"} />
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <CronTableHeader labels={["Namespace", "Pod", "Phase", "Ready", "Restarts", "IP", "Created"]} />
                  <tbody className="divide-y divide-gray-100">
                    {podRows.map((row) => (
                      <tr key={`${row.namespace}-${row.name}`}>
                        <td className="px-4 py-3">{row.namespace}</td>
                        <td className="px-4 py-3 font-mono text-[13px] font-bold">{row.name}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${cronStatusClass(row.phase ?? "-")}`}>{row.phase}</span></td>
                        <td className="px-4 py-3">{row.ready}</td>
                        <td className="px-4 py-3">{row.restarts}</td>
                        <td className="px-4 py-3">{row.podIP}</td>
                        <td className="px-4 py-3">{formatTime(row.createdAt ?? "-")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Version Promotion Workbench" : "버전 반영 작업실"}</h2>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "Select a commit, compare the visible change scope, then request an isolated build or final deployment."
                        : "커밋을 선택해 변경 범위를 화면에서 확인하고, 격리 빌드 또는 최종 배포 요청으로 이어갑니다."}
                    </p>
                  </div>
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
                    {en ? "Do not auto-promote every version to production" : "모든 버전 운영 자동 반영 금지"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">{en ? "Target version" : "반영 대상 버전"}</span>
                      <select
                        className="mt-2 w-full rounded border border-[var(--kr-gov-border-light)] bg-white px-3 py-2 text-sm font-bold text-[var(--kr-gov-text-primary)]"
                        value={selectedVersion?.hash ?? ""}
                        onChange={(event) => setSelectedVersionHash(event.target.value)}
                      >
                        {commits.map((row) => (
                          <option key={row.hash} value={row.hash}>{row.hash} · {row.subject}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">{en ? "Compare base" : "비교 기준"}</span>
                      <select
                        className="mt-2 w-full rounded border border-[var(--kr-gov-border-light)] bg-white px-3 py-2 text-sm font-bold text-[var(--kr-gov-text-primary)]"
                        value={compareBaseVersion?.hash ?? ""}
                        onChange={(event) => setCompareBaseHash(event.target.value)}
                      >
                        {commits.map((row) => (
                          <option key={row.hash} value={row.hash}>{row.hash} · {row.subject}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {[
                      ["preview", en ? "Diff preview" : "Diff 미리보기", en ? "Read-only comparison first" : "먼저 읽기 전용 비교"],
                      ["isolated-build", en ? "Isolated build" : "격리 빌드", en ? "Build in worktree/tag" : "worktree/tag로 빌드"],
                      ["deploy", en ? "Final deploy" : "최종 배포", en ? "Requires manual approval" : "수동 승인 필요"]
                    ].map(([id, title, description]) => (
                      <button
                        key={id}
                        className={`rounded border p-3 text-left text-sm ${promotionMode === id ? "border-blue-500 bg-blue-50 text-blue-800" : "border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-secondary)] hover:border-blue-200"}`}
                        onClick={() => setPromotionMode(id as "preview" | "isolated-build" | "deploy")}
                        type="button"
                      >
                        <span className="block font-black">{title}</span>
                        <span className="mt-1 block text-xs">{description}</span>
                      </button>
                    ))}
                  </div>
                  <div className="rounded border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                    <h3 className="font-black text-[var(--kr-gov-text-primary)]">{en ? "Selected change scope" : "선택 변경 범위"}</h3>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                      {selectedVersion
                        ? `${selectedVersion.hash} · ${selectedVersion.subject}`
                        : (en ? "No commit is available." : "사용 가능한 커밋이 없습니다.")}
                    </p>
                    <p className="mt-2 font-mono text-xs text-slate-500">{versionApplyCommand}</p>
                    {promotionMessage ? (
                      <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-800">{promotionMessage}</div>
                    ) : null}
                    <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <button className="gov-btn gov-btn-outline" onClick={() => requestVersionAction("diff")} type="button">{en ? "Open diff request" : "Diff 조회 요청"}</button>
                      <button className="gov-btn gov-btn-primary" onClick={() => requestVersionAction(promotionMode === "deploy" ? "deploy" : "build")} type="button">{promotionMode === "deploy" ? (en ? "Request final approval" : "최종 승인 요청") : (en ? "Request isolated build" : "격리 빌드 요청")}</button>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {promotionSteps.map((item) => (
                      <SummaryMetricCard key={item.title} title={item.title} value={item.value} description={item.description} />
                    ))}
                  </div>
                  <PageStatusNotice tone="warning">
                    {en
                      ? "Trying all 10 versions by deploying each one to main is technically possible but operationally unsafe. Use isolated worktrees or temporary tags for every candidate, then deploy only the final selected version."
                      : "10개 버전을 전부 main에 하나씩 반영하고 빌드/배포하는 것은 기술적으로는 가능하지만 운영상 위험합니다. 모든 후보는 격리 worktree나 임시 태그로 검증하고, 최종 선택한 1개 버전만 운영에 배포해야 합니다."}
                  </PageStatusNotice>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="gov-card overflow-hidden">
                <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                  <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Recent Commits" : "최근 커밋"}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <CronTableHeader labels={["Hash", "Subject"]} />
                    <tbody className="divide-y divide-gray-100">
                      {commits.map((row) => (
                        <tr key={row.hash}>
                          <td className="px-4 py-3 font-mono text-[13px] font-bold">{row.hash}</td>
                          <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{row.subject}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="gov-card overflow-hidden">
                <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                  <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Changed Files" : "변경 파일"}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <CronTableHeader labels={["Status", "Path"]} />
                    <tbody className="divide-y divide-gray-100">
                      {changedFiles.length === 0 ? (
                        <tr><td className="px-4 py-6 text-center text-[var(--kr-gov-text-secondary)]" colSpan={2}>{en ? "No visible changed files." : "표시 가능한 변경 파일이 없습니다."}</td></tr>
                      ) : changedFiles.map((row, index) => (
                        <tr key={`${row.path}-${index}`}>
                          <td className="px-4 py-3 font-mono font-bold">{row.status}</td>
                          <td className="px-4 py-3 font-mono text-[13px] text-[var(--kr-gov-text-secondary)]">{row.path}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="gov-card overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "Version Build Check Procedure" : "버전 선택 빌드 확인 절차"}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Use an isolated worktree for historical builds so main and current deployment are not disturbed." : "과거 버전 빌드는 main과 현재 운영 배포를 건드리지 않도록 격리 worktree에서 확인합니다."}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                <SummaryMetricCard title="1. fetch" value="git fetch --all --tags" description={en ? "Update branch/tag metadata first." : "브랜치/태그 메타데이터를 먼저 갱신합니다."} />
                <SummaryMetricCard title="2. worktree" value="git worktree add" description={en ? "Checkout the selected commit into an isolated directory." : "선택 커밋을 격리 디렉터리에 체크아웃합니다."} />
                <SummaryMetricCard title="3. build" value="./gradlew / npm run build" description={en ? "Build there without touching main." : "main을 건드리지 않고 그 위치에서 빌드합니다."} />
                <SummaryMetricCard title="4. smoke" value="separate image/tag" description={en ? "Run as a separate tag or temporary namespace." : "별도 이미지 태그나 임시 namespace로 확인합니다."} />
              </div>
            </section>
          </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
