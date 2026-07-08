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
  return <MonitoringOperationsPage kind="cron" />;
}

export function DbMonitoringPage() {
  return <MonitoringOperationsPage kind="db" />;
}

export function BatchMonitoringPage() {
  return <MonitoringOperationsPage kind="batch" />;
}

export function GitBuildMonitoringPage() {
  return <MonitoringOperationsPage kind="git" />;
}
