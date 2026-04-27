import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchBackupConfigPage, restoreBackupConfigVersion, runBackupExecution, saveBackupConfig } from "../../lib/api/ops";
import { readBootstrappedBackupConfigPageData } from "../../lib/api/bootstrap";
import type { BackupConfigPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminCheckbox, AdminInput, AdminSelect, MemberButton, MemberPageActions, MemberPagination, PageStatusNotice } from "../member/common";
import { stringOf } from "../admin-system/adminSystemShared";

const TABLE_PAGE_SIZE = 10;
const CARD_PAGE_SIZE = 6;

type PaginationState = Record<string, number>;

function valueOf(form: Record<string, string>, key: string) {
  return form[key] || "";
}

function yes(form: Record<string, string>, key: string) {
  return valueOf(form, key) === "Y";
}

function BackupField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{label}</span>
      <AdminInput type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function BackupSecretHint({ configured, masked, en }: { configured: boolean; masked: string; en: boolean }) {
  return (
    <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
      {configured
        ? (en ? `Token stored securely. Current value is hidden as ${masked || "********"}. Leave the field blank to keep it.` : `토큰이 저장되어 있습니다. 현재 값은 ${masked || "********"} 로 숨김 처리됩니다. 유지하려면 입력란을 비워 두세요.`)
        : (en ? "No token is stored. Enter a Git personal access token to enable authenticated push." : "저장된 토큰이 없습니다. 인증된 push를 위해 Git 개인 액세스 토큰을 입력하세요.")}
    </div>
  );
}

function BackupToggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (checked: boolean) => void; description: string }) {
  return (
    <label className="flex items-start gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
      <AdminCheckbox checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="flex-1">
        <span className="block text-sm font-bold text-[var(--kr-gov-text-primary)]">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{description}</span>
      </span>
    </label>
  );
}

function getCurrentPage(pagination: PaginationState, key: string) {
  return Math.max(1, Number(pagination[key] || 1));
}

function confirmAction(message: string) {
  return typeof window === "undefined" ? true : window.confirm(message);
}

function paginateRows<T>(rows: T[], pagination: PaginationState, key: string, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(getCurrentPage(pagination, key), totalPages);
  const fromIndex = (currentPage - 1) * pageSize;
  return {
    currentPage,
    totalPages,
    rows: rows.slice(fromIndex, fromIndex + pageSize)
  };
}

function buildVersionDetailRows(version: Record<string, string> | null, en: boolean) {
  if (!version) {
    return [];
  }
  return [
    { group: en ? "Common" : "공통", label: en ? "Backup Root" : "백업 루트", value: stringOf(version, "backupRootPath") || "-" },
    { group: en ? "Common" : "공통", label: en ? "Cron" : "크론", value: stringOf(version, "cronExpression") || "-" },
    { group: en ? "Common" : "공통", label: en ? "Retention Days" : "보관 일수", value: stringOf(version, "retentionDays") || "-" },
    { group: en ? "Common" : "공통", label: en ? "Offsite Sync" : "원격 동기화", value: stringOf(version, "offsiteSyncEnabled") || "-" },
    { group: "Git", label: en ? "Git Enabled" : "Git 사용", value: stringOf(version, "gitEnabled") || "-" },
    { group: "Git", label: en ? "Repository" : "저장소 경로", value: stringOf(version, "gitRepositoryPath") || "-" },
    { group: "Git", label: en ? "Remote" : "원격 저장소", value: stringOf(version, "gitRemoteUrl") || stringOf(version, "gitRemoteName") || "-" },
    { group: "Git", label: en ? "Branch Pattern" : "브랜치 패턴", value: stringOf(version, "gitBranchPattern") || "-" },
    { group: "Git", label: en ? "Backup Mode" : "백업 모드", value: stringOf(version, "gitBackupMode") || "-" },
    { group: "Git", label: en ? "Bundle Prefix" : "번들 Prefix", value: stringOf(version, "gitBundlePrefix") || "-" },
    { group: "Git", label: en ? "Restore Branch Prefix" : "복구 브랜치 Prefix", value: stringOf(version, "gitRestoreBranchPrefix") || "-" },
    { group: "Git", label: en ? "Tag Prefix" : "태그 Prefix", value: stringOf(version, "gitTagPrefix") || "-" },
    { group: "DB", label: en ? "DB Enabled" : "DB 사용", value: stringOf(version, "dbEnabled") || "-" },
    { group: "DB", label: en ? "DB Name" : "DB 이름", value: stringOf(version, "dbName") || "-" },
    { group: "DB", label: en ? "Host / Port" : "Host / Port", value: [stringOf(version, "dbHost"), stringOf(version, "dbPort")].filter(Boolean).join(":") || "-" },
    { group: "DB", label: en ? "User" : "사용자", value: stringOf(version, "dbUser") || "-" },
    { group: "DB", label: en ? "Dump Command" : "덤프 명령", value: stringOf(version, "dbDumpCommand") || "-" },
    { group: "DB", label: en ? "Schema Scope" : "스키마 범위", value: stringOf(version, "dbSchemaScope") || "-" },
    { group: "DB Policy", label: en ? "Promotion Data Policy" : "반영 데이터 정책", value: stringOf(version, "dbPromotionDataPolicy") || "-" },
    { group: "DB Policy", label: en ? "Diff Execution Preset" : "diff 실행 프리셋", value: stringOf(version, "dbDiffExecutionPreset") || "-" },
    { group: "DB Policy", label: en ? "Allow Local Diff" : "local diff 허용", value: stringOf(version, "dbApplyLocalDiffYn") || "-" },
    { group: "DB Policy", label: en ? "Force Destructive Diff" : "파괴적 diff 강제", value: stringOf(version, "dbForceDestructiveDiffYn") || "-" },
    { group: "DB Policy", label: en ? "Fail On Untracked Destructive Diff" : "미추적 파괴적 diff 실패", value: stringOf(version, "dbFailOnUntrackedDestructiveDiffYn") || "-" },
    { group: "DB Policy", label: en ? "Require Patch History" : "패치 이력 필수", value: stringOf(version, "dbRequirePatchHistoryYn") || "-" }
  ];
}

function buildVersionDiffRows(current: Record<string, string> | null, previous: Record<string, string> | null, en: boolean) {
  if (!current) {
    return [];
  }
  const fields = [
    { key: "backupRootPath", label: en ? "Backup Root" : "백업 루트" },
    { key: "cronExpression", label: en ? "Cron" : "크론" },
    { key: "retentionDays", label: en ? "Retention Days" : "보관 일수" },
    { key: "offsiteSyncEnabled", label: en ? "Offsite Sync" : "원격 동기화" },
    { key: "gitEnabled", label: en ? "Git Enabled" : "Git 사용" },
    { key: "gitRepositoryPath", label: en ? "Git Repository" : "Git 저장소 경로" },
    { key: "gitRemoteUrl", label: en ? "Git Remote URL" : "Git Remote URL" },
    { key: "gitRemoteName", label: en ? "Git Remote Name" : "Git Remote 이름" },
    { key: "gitBranchPattern", label: en ? "Git Branch Pattern" : "Git 브랜치 패턴" },
    { key: "gitBackupMode", label: en ? "Git Backup Mode" : "Git 백업 모드" },
    { key: "dbEnabled", label: en ? "DB Enabled" : "DB 사용" },
    { key: "dbName", label: en ? "DB Name" : "DB 이름" },
    { key: "dbHost", label: en ? "DB Host" : "DB Host" },
    { key: "dbPort", label: en ? "DB Port" : "DB Port" },
    { key: "dbDumpCommand", label: en ? "DB Dump Command" : "DB 덤프 명령" },
    { key: "dbSchemaScope", label: en ? "DB Schema Scope" : "DB 스키마 범위" },
    { key: "dbPromotionDataPolicy", label: en ? "Promotion Data Policy" : "반영 데이터 정책" },
    { key: "dbDiffExecutionPreset", label: en ? "Diff Execution Preset" : "diff 실행 프리셋" },
    { key: "dbApplyLocalDiffYn", label: en ? "Allow Local Diff" : "local diff 허용" },
    { key: "dbForceDestructiveDiffYn", label: en ? "Force Destructive Diff" : "파괴적 diff 강제" },
    { key: "dbFailOnUntrackedDestructiveDiffYn", label: en ? "Fail On Untracked Destructive Diff" : "미추적 파괴적 diff 실패" },
    { key: "dbRequirePatchHistoryYn", label: en ? "Require Patch History" : "패치 이력 필수" }
  ];
  return fields
    .map((field) => ({
      label: field.label,
      previous: stringOf(previous || {}, field.key) || "-",
      current: stringOf(current, field.key) || "-"
    }))
    .filter((row) => row.previous !== row.current);
}

type CloseoutItem = {
  label: string;
  value: string;
  ready: boolean;
  note: string;
};

function renderReadyBadge(ready: boolean, en: boolean) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
      {ready ? (en ? "Ready" : "준비됨") : (en ? "Needs Check" : "점검 필요")}
    </span>
  );
}

function BackupModeCloseoutPanel({ title, description, items, en }: { title: string; description: string; items: CloseoutItem[]; en: boolean }) {
  const readyCount = items.filter((item) => item.ready).length;
  return (
    <section className="gov-card mb-6" data-help-id="backup-route-closeout">
      <div className="flex flex-col gap-4 border-b border-[var(--kr-gov-border-light)] px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Route Closeout Gate" : "라우트 완료 게이트"}</p>
          <h3 className="mt-1 text-lg font-bold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{description}</p>
        </div>
        <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-4 py-3 text-sm font-bold">
          {readyCount} / {items.length} {en ? "ready" : "준비"}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4" key={item.label}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{item.label}</p>
              {renderReadyBadge(item.ready, en)}
            </div>
            <p className="mt-3 text-xl font-black text-[var(--kr-gov-text-primary)]">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{item.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BackupConfigMigrationPage() {
  const en = isEnglish();
  const pathname = typeof window === "undefined" ? "/admin/system/backup_config" : window.location.pathname;
  const initialPayload = useMemo(() => readBootstrappedBackupConfigPageData(), []);
  const pageState = useAsyncValue<BackupConfigPagePayload>(() => fetchBackupConfigPage(pathname), [pathname], {
    initialValue: initialPayload,
    skipInitialLoad: Boolean(initialPayload)
  });
  const page = pageState.value;
  const summary = (page?.backupConfigSummary || []) as Array<Record<string, string>>;

  // Workflow Tabs: "config", "backup", "restore"
  const [activeTab, setActiveTab] = useState<"config" | "backup" | "restore">("config");

  // Determine initial tab based on path, but keep state for internal switching
  useEffect(() => {
    if (pathname.includes("/admin/system/backup") && !pathname.includes("backup_config")) {
      setActiveTab("backup");
    } else if (pathname.includes("/admin/system/restore")) {
      setActiveTab("restore");
    } else {
      setActiveTab("config");
    }
  }, [pathname]);
  const storages = (page?.backupStorageRows || []) as Array<Record<string, string>>;
  const executions = (page?.backupExecutionRows || []) as Array<Record<string, string>>;
  const versions = (page?.backupVersionRows || []) as Array<Record<string, string>>;
  const playbooks = (page?.backupRecoveryPlaybooks || []) as Array<Record<string, string>>;
  const gitPrecheckRows = (page?.backupGitPrecheckRows || []) as Array<Record<string, string>>;
  const restoreGitRows = (page?.backupRestoreGitRows || []) as Array<Record<string, string>>;
  const restoreSqlRows = (page?.backupRestoreSqlRows || []) as Array<Record<string, string>>;
  const restorePhysicalRows = (page?.backupRestorePhysicalRows || []) as Array<Record<string, string>>;
  const restorePitrInfo = ((page?.backupRestorePitrInfo || {}) as Record<string, string>);
  const currentJob = (page?.backupCurrentJob || null) as Record<string, unknown> | null;
  const backupJobActive = String(currentJob?.status || "") === "QUEUED" || String(currentJob?.status || "") === "RUNNING";
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [runningDbBackup, setRunningDbBackup] = useState(false);
  const [runningGitExecution, setRunningGitExecution] = useState<"" | "PRECHECK" | "CLEANUP" | "BUNDLE" | "COMMIT_BASE" | "BASE" | "PUSH" | "TAG">("");
  const [runningRestore, setRunningRestore] = useState<"" | "GIT" | "SQL" | "PHYSICAL" | "PITR">("");
  const [gitRestoreCommit, setGitRestoreCommit] = useState("");
  const [dbRestoreType, setDbRestoreType] = useState<"SQL" | "PHYSICAL" | "PITR">("SQL");
  const [dbRestoreTarget, setDbRestoreTarget] = useState("");
  const [dbRestorePointInTime, setDbRestorePointInTime] = useState("");
  const [sudoPassword, setSudoPassword] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({});
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [versionSearchKeyword, setVersionSearchKeyword] = useState("");
  const [versionFilter, setVersionFilter] = useState<"ALL" | "GIT_CHANGED" | "DB_CHANGED">("ALL");
  const [restoringVersion, setRestoringVersion] = useState(false);
  const selectedSqlSnapshotLabel = restoreSqlRows.find((row) => stringOf(row, "path") === dbRestoreTarget)
    ? `${stringOf(restoreSqlRows.find((row) => stringOf(row, "path") === dbRestoreTarget), "recordedAt")} | ${dbRestoreTarget}`
    : dbRestoreTarget;
  const sqlSnapshotId = dbRestoreTarget.split("/").pop() || "";
  const manualSqlRestoreCommand = dbRestoreTarget
    ? [
      "cd /opt/util/cubrid",
      "docker compose exec -T cubrid sh -lc 'cubrid server stop carbonet || true'",
      "docker compose exec -T cubrid sh -lc 'cubrid deletedb -d carbonet || true'",
      "docker compose exec -T cubrid sh -lc 'rm -f /var/lib/cubrid/databases.txt && if [ -d /var/lib/cubrid/com ]; then mv /var/lib/cubrid/com /var/lib/cubrid/com_before_manual_restore_$(date +%Y%m%d_%H%M%S); fi && mkdir -p /var/lib/cubrid/com/lob'",
      "docker compose exec -T cubrid sh -lc 'cubrid createdb --replace --server-name localhost -F /var/lib/cubrid/com -L /var/lib/cubrid/com -B /var/lib/cubrid/com/lob carbonet ko_KR.utf8'",
      "docker compose exec -T cubrid sh -lc 'cubrid server start carbonet'",
      `docker compose exec -T cubrid sh -lc 'cubrid loaddb -C -u dba --no-statistics -s /opt/util/cubrid/backup/sql/${sqlSnapshotId}/db_backup_full_carbonet_${sqlSnapshotId}_schema -d /opt/util/cubrid/backup/sql/${sqlSnapshotId}/db_backup_full_carbonet_${sqlSnapshotId}_objects -i /opt/util/cubrid/backup/sql/${sqlSnapshotId}/db_backup_full_carbonet_${sqlSnapshotId}_indexes carbonet'`,
      "docker compose exec -T cubrid sh -lc \"printf '%s\\n' '#db-name\\tvol-path\\t\\tdb-host\\t\\tlog-path\\t\\tlob-base-path' 'carbonet\\t/var/lib/cubrid/com\\tlocalhost\\t/var/lib/cubrid/com\\tfile:/var/lib/cubrid/com/lob' > /var/lib/cubrid/databases.txt && chmod 666 /var/lib/cubrid/databases.txt && chown -R cubrid:cubrid /var/lib/cubrid/com /var/lib/cubrid/databases.txt\"",
      "docker compose exec -T cubrid sh -lc 'cubrid broker restart || true; cubrid server restart carbonet || { cubrid server stop carbonet || true; cubrid server start carbonet; }'",
      "docker compose exec -T cubrid sh -lc 'cubrid server status carbonet && csql -u dba carbonet -c \"select count(*) from db_class;\"'"
    ].join("\n")
    : "";

  useEffect(() => {
    setForm(((page?.backupConfigForm || {}) as Record<string, string>));
    if (page?.backupConfigMessage) {
      setMessage(String(page.backupConfigMessage));
    }
  }, [page?.backupConfigForm, page?.backupConfigMessage]);

  useEffect(() => {
    const status = String(currentJob?.status || "");
    if (!status || (status !== "QUEUED" && status !== "RUNNING") || pageState.error) {
      setRunningGitExecution("");
      setRunningDbBackup(false);
      setRunningRestore("");
    }
  }, [currentJob, pageState.error]);

  useEffect(() => {
    setPagination((current) => ({
      storage: Math.min(getCurrentPage(current, "storage"), Math.max(1, Math.ceil(storages.length / TABLE_PAGE_SIZE))),
      execution: Math.min(getCurrentPage(current, "execution"), Math.max(1, Math.ceil(executions.length / TABLE_PAGE_SIZE))),
      version: Math.min(getCurrentPage(current, "version"), Math.max(1, Math.ceil(versions.length / TABLE_PAGE_SIZE))),
      gitPrecheck: Math.min(getCurrentPage(current, "gitPrecheck"), Math.max(1, Math.ceil(gitPrecheckRows.length / TABLE_PAGE_SIZE))),
      playbook: Math.min(getCurrentPage(current, "playbook"), Math.max(1, Math.ceil(playbooks.length / CARD_PAGE_SIZE)))
    }));
  }, [executions.length, gitPrecheckRows.length, playbooks.length, storages.length, versions.length]);

  useEffect(() => {
    if (!gitRestoreCommit && restoreGitRows.length) {
      setGitRestoreCommit(stringOf(restoreGitRows[0], "id"));
    }
  }, [gitRestoreCommit, restoreGitRows]);

  useEffect(() => {
    if (!selectedVersionId && versions.length) {
      setSelectedVersionId(stringOf(versions[0], "versionId"));
    }
  }, [selectedVersionId, versions]);

  useEffect(() => {
    if (!dbRestoreTarget) {
      if (dbRestoreType === "SQL" && restoreSqlRows.length) {
        setDbRestoreTarget(stringOf(restoreSqlRows[0], "path"));
      } else if (dbRestoreType === "PHYSICAL" && restorePhysicalRows.length) {
        setDbRestoreTarget(stringOf(restorePhysicalRows[0], "path"));
      }
    }
  }, [dbRestoreTarget, dbRestoreType, restoreSqlRows, restorePhysicalRows]);

  useEffect(() => {
    if (!dbRestorePointInTime && stringOf(restorePitrInfo, "windowEnd")) {
      setDbRestorePointInTime(stringOf(restorePitrInfo, "windowEnd"));
    }
  }, [dbRestorePointInTime, restorePitrInfo]);

  useEffect(() => {
    const status = String(currentJob?.status || "");
    if (status !== "QUEUED" && status !== "RUNNING") {
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const next = await fetchBackupConfigPage(pathname);
        pageState.setValue(next);
      } catch {
        // Ignore transient polling failures and keep the current page state.
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [currentJob, pageState, pathname]);

  const preset = (() => {
    if (pathname.endsWith("/admin/system/backup") || pathname.endsWith("/en/admin/system/backup")) {
      return {
        pageKey: "backup-execution",
        title: en ? "Backup Execution" : "백업 실행",
        subtitle: en ? "Review backup execution history and the current source/database backup readiness." : "백업 실행 이력과 현재 소스/DB 백업 준비 상태를 확인합니다."
      };
    }
    if (pathname.endsWith("/admin/system/restore") || pathname.endsWith("/en/admin/system/restore")) {
      return {
        pageKey: "restore-execution",
        title: en ? "Restore Execution" : "복구 실행",
        subtitle: en ? "Use the saved backup settings and playbooks to prepare restore drills and rollback actions." : "저장된 백업 설정과 플레이북을 기준으로 복구 리허설과 롤백 절차를 준비합니다."
      };
    }
    if (pathname.endsWith("/admin/system/version") || pathname.endsWith("/en/admin/system/version")) {
      return {
        pageKey: "version-management",
        title: en ? "Version Management" : "버전 관리",
        subtitle: en ? "Track saved backup configuration versions and compare what changed over time." : "저장된 백업 설정 버전과 변경 이력을 시간순으로 추적합니다."
      };
    }
    return {
      pageKey: "backup-config",
      title: en ? "Backup Settings" : "백업 설정",
      subtitle: en ? "Register folder, cron, git backup, and database backup settings used by the backup operation pages." : "백업 실행 페이지가 공통으로 사용하는 폴더, 크론, git 백업, DB 백업 설정을 등록합니다."
    };
  })();

  logGovernanceScope("PAGE", preset.pageKey, {
    language: en ? "en" : "ko",
    summaryCount: summary.length,
    storageCount: storages.length,
    executionCount: executions.length,
    versionCount: versions.length,
    gitPrecheckCount: gitPrecheckRows.length
  });

  const updateField = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const movePage = (key: keyof PaginationState, pageNumber: number) => {
    setPagination((current) => ({ ...current, [key]: Math.max(1, pageNumber) }));
  };

  const storagePage = paginateRows(storages, pagination, "storage", TABLE_PAGE_SIZE);
  const executionPage = paginateRows(executions, pagination, "execution", TABLE_PAGE_SIZE);
  const enrichedVersions = versions.map((row, index) => {
    const previous = versions[index + 1] || null;
    const diffRows = buildVersionDiffRows(row, previous, en);
    return {
      ...row,
      gitChanged: diffRows.some((item) => item.label.toLowerCase().includes("git")) ? "Y" : "N",
      dbChanged: diffRows.some((item) => item.label.toLowerCase().includes("db")) ? "Y" : "N"
    };
  });
  const filteredVersions = enrichedVersions.filter((row) => {
    const keyword = versionSearchKeyword.trim().toLowerCase();
    const haystack = [
      stringOf(row, "versionId"),
      stringOf(row, "savedAt"),
      stringOf(row, "savedBy"),
      stringOf(row, "versionMemo"),
      stringOf(row, "gitSummary"),
      stringOf(row, "dbSummary")
    ].join(" ").toLowerCase();
    if (keyword && !haystack.includes(keyword)) {
      return false;
    }
    if (versionFilter === "GIT_CHANGED" && stringOf(row, "gitChanged") !== "Y") {
      return false;
    }
    if (versionFilter === "DB_CHANGED" && stringOf(row, "dbChanged") !== "Y") {
      return false;
    }
    return true;
  });
  const versionPage = paginateRows(filteredVersions, pagination, "version", TABLE_PAGE_SIZE);
  const gitPrecheckPage = paginateRows(gitPrecheckRows, pagination, "gitPrecheck", TABLE_PAGE_SIZE);
  const playbookPage = paginateRows(playbooks, pagination, "playbook", CARD_PAGE_SIZE);
  const selectedVersion = enrichedVersions.find((row) => stringOf(row, "versionId") === selectedVersionId) || enrichedVersions[0] || null;
  const selectedVersionIndex = enrichedVersions.findIndex((row) => stringOf(row, "versionId") === stringOf(selectedVersion || {}, "versionId"));
  const previousVersion = selectedVersionIndex >= 0 ? enrichedVersions[selectedVersionIndex + 1] || null : null;
  const versionDetailRows = buildVersionDetailRows(selectedVersion, en);
  const versionDiffRows = buildVersionDiffRows(selectedVersion, previousVersion, en);
  const backupExecutionCloseoutItems: CloseoutItem[] = [
    {
      label: en ? "Execution Authority" : "실행 권한",
      value: page?.canUseBackupExecution ? (en ? "Granted" : "허용") : (en ? "Blocked" : "차단"),
      ready: Boolean(page?.canUseBackupExecution),
      note: en ? "Backup run buttons stay disabled until the execution feature is available." : "실행 기능 권한이 없으면 백업 실행 버튼은 비활성화됩니다."
    },
    {
      label: en ? "DB Backup Target" : "DB 백업 대상",
      value: valueOf(form, "dbName") || "-",
      ready: yes(form, "dbEnabled") && Boolean(valueOf(form, "dbDumpCommand")),
      note: en ? "Database execution requires DB backup to be enabled and a dump command to be configured." : "DB 실행은 DB 백업 사용과 dump 명령 설정이 모두 필요합니다."
    },
    {
      label: en ? "Git Evidence Path" : "Git 증적 경로",
      value: valueOf(form, "gitBranchPattern") || "-",
      ready: yes(form, "gitEnabled") && Boolean(valueOf(form, "gitRepositoryPath")),
      note: en ? "Source backup evidence is tied to the configured repository and base branch." : "소스 백업 증적은 설정된 저장소와 기준 브랜치에 연결됩니다."
    },
    {
      label: en ? "Run History" : "실행 이력",
      value: String(executions.length),
      ready: executions.length > 0,
      note: en ? "A route cannot be considered closed without visible execution evidence." : "실행 증적이 화면에 보이지 않으면 완료 화면으로 볼 수 없습니다."
    }
  ];
  const restoreExecutionCloseoutItems: CloseoutItem[] = [
    {
      label: en ? "Restore Authority" : "복구 권한",
      value: page?.canUseBackupExecution ? (en ? "Granted" : "허용") : (en ? "Blocked" : "차단"),
      ready: Boolean(page?.canUseBackupExecution),
      note: en ? "Restore actions require the same governed backup execution feature chain." : "복구 작업은 같은 백업 실행 권한 체인을 요구합니다."
    },
    {
      label: en ? "Git Rollback Points" : "Git 롤백 지점",
      value: String(restoreGitRows.length),
      ready: restoreGitRows.length > 0 && Boolean(gitRestoreCommit),
      note: en ? "Git rollback needs a selectable commit target before execution." : "Git 롤백은 실행 전 선택 가능한 커밋 대상이 필요합니다."
    },
    {
      label: en ? "DB Restore Targets" : "DB 복구 대상",
      value: String(restoreSqlRows.length + restorePhysicalRows.length),
      ready: restoreSqlRows.length > 0 || restorePhysicalRows.length > 0 || Boolean(stringOf(restorePitrInfo, "windowEnd")),
      note: en ? "Restore evidence must expose SQL, physical, or point-in-time recovery targets." : "복구 증적은 SQL, 물리, 시점 복구 대상 중 하나 이상을 보여야 합니다."
    },
    {
      label: en ? "Maintenance Guard" : "점검 보호",
      value: dbRestoreType,
      ready: dbRestoreType === "SQL" || Boolean(sudoPassword),
      note: en ? "Physical and PITR execution require runtime privilege confirmation; SQL restore stays manual-only." : "물리/PITR 실행은 실행 권한 확인이 필요하고, SQL 복구는 수동 전용입니다."
    }
  ];

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    logGovernanceScope("ACTION", "backup-config-save", { pageKey: preset.pageKey, backupRootPath: valueOf(form, "backupRootPath"), cronExpression: valueOf(form, "cronExpression") });
    try {
      const saved = await saveBackupConfig(form);
      pageState.setValue(saved);
      setMessage(String(saved.backupConfigMessage || (en ? "Backup settings have been saved." : "백업 설정이 저장되었습니다.")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Failed to save backup settings." : "백업 설정 저장 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async () => {
    if (!selectedVersion) {
      return;
    }
    if (!confirmAction(en ? "Restore this saved version into the current backup settings?" : "선택한 버전으로 현재 백업 설정을 복원하시겠습니까?")) {
      return;
    }
    setRestoringVersion(true);
    setMessage("");
    try {
      const nextPage = await restoreBackupConfigVersion(stringOf(selectedVersion, "versionId"));
      pageState.setValue(nextPage);
      setSelectedVersionId(stringOf(((nextPage.backupVersionRows || [])[0] || {}) as Record<string, string>, "versionId"));
      setMessage(String(nextPage.backupConfigMessage || (en ? "Version restored." : "버전을 복원했습니다.")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Failed to restore version." : "버전 복원 중 오류가 발생했습니다."));
    } finally {
      setRestoringVersion(false);
    }
  };

  const handleRunDbBackup = async () => {
    if (!confirmAction(en ? "Run the database backup now?" : "지금 DB 백업을 실행하시겠습니까?")) {
      return;
    }
    setRunningDbBackup(true);
    setMessage("");
    logGovernanceScope("ACTION", "backup-execution-db-run", { pageKey: preset.pageKey, dbEnabled: valueOf(form, "dbEnabled"), dbName: valueOf(form, "dbName") });
    try {
      const nextPage = await runBackupExecution("DB");
      pageState.setValue(nextPage);
      setMessage(String(nextPage.backupConfigMessage || (en ? "Database backup finished." : "DB 백업이 완료되었습니다.")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Database backup failed." : "DB 백업 실행 중 오류가 발생했습니다."));
    } finally {
      setRunningDbBackup(false);
    }
  };

  const handleRunGitExecution = async (kind: "PRECHECK" | "CLEANUP" | "BUNDLE" | "COMMIT_BASE" | "BASE" | "PUSH" | "TAG") => {
    const labels: Record<typeof kind, string> = {
      PRECHECK: en ? "Run Git precheck now?" : "Git 사전 점검을 실행하시겠습니까?",
      CLEANUP: en ? "Run safe artifact cleanup now?" : "산출물 자동 정리를 실행하시겠습니까?",
      BUNDLE: en ? "Run Git bundle backup now?" : "Git 번들 백업을 실행하시겠습니까?",
      COMMIT_BASE: en ? "Commit current changes and push the base branch now?" : "현재 변경을 커밋하고 기준 브랜치까지 push 하시겠습니까?",
      BASE: en ? "Push the base branch now?" : "기준 브랜치를 push 하시겠습니까?",
      PUSH: en ? "Push the restore branch now?" : "복구 브랜치를 push 하시겠습니까?",
      TAG: en ? "Push the Git tag now?" : "Git 태그를 push 하시겠습니까?"
    };
    if (!confirmAction(labels[kind])) {
      return;
    }
    setRunningGitExecution(kind);
    setMessage("");
    logGovernanceScope("ACTION", `backup-execution-git-${kind.toLowerCase()}`, {
      pageKey: preset.pageKey,
      gitEnabled: valueOf(form, "gitEnabled"),
      gitRepositoryPath: valueOf(form, "gitRepositoryPath"),
      gitBackupMode: valueOf(form, "gitBackupMode")
    });
    try {
      const executionType = kind === "BUNDLE"
        ? "GIT_BUNDLE"
        : kind === "PRECHECK"
          ? "GIT_PRECHECK"
        : kind === "CLEANUP"
          ? "GIT_CLEANUP_SAFE"
        : kind === "COMMIT_BASE"
          ? "GIT_COMMIT_AND_PUSH_BASE"
        : kind === "BASE"
          ? "GIT_PUSH_BASE"
          : kind === "PUSH"
            ? "GIT_PUSH_RESTORE"
            : "GIT_TAG_PUSH";
      const nextPage = await runBackupExecution(executionType);
      pageState.setValue(nextPage);
      setMessage(String(nextPage.backupConfigMessage || (
        kind === "PRECHECK"
          ? (en ? "Git push precheck finished." : "Git Push 사전 점검이 완료되었습니다.")
        : kind === "CLEANUP"
          ? (en ? "Git safe artifact cleanup finished." : "산출물 자동 정리가 완료되었습니다.")
        : kind === "BUNDLE"
          ? (en ? "Git bundle backup finished." : "Git 번들 백업이 완료되었습니다.")
          : kind === "COMMIT_BASE"
            ? (en ? "Git commit and base-branch push finished." : "Git 전체 커밋 후 기준 브랜치 Push가 완료되었습니다.")
          : kind === "BASE"
            ? (en ? "Git base-branch push finished." : "Git 기준 브랜치 Push가 완료되었습니다.")
          : kind === "PUSH"
            ? (en ? "Git restore-branch push finished." : "Git 복구 브랜치 Push가 완료되었습니다.")
            : (en ? "Git tag push finished." : "Git 태그 Push가 완료되었습니다.")
      )));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (
        kind === "PRECHECK"
          ? (en ? "Git push precheck failed." : "Git Push 사전 점검 실행 중 오류가 발생했습니다.")
        : kind === "CLEANUP"
          ? (en ? "Git safe artifact cleanup failed." : "산출물 자동 정리 실행 중 오류가 발생했습니다.")
        : kind === "BUNDLE"
          ? (en ? "Git bundle backup failed." : "Git 번들 백업 실행 중 오류가 발생했습니다.")
          : kind === "COMMIT_BASE"
            ? (en ? "Git commit and base-branch push failed." : "Git 전체 커밋 후 기준 브랜치 Push 실행 중 오류가 발생했습니다.")
          : kind === "BASE"
            ? (en ? "Git base-branch push failed." : "Git 기준 브랜치 Push 실행 중 오류가 발생했습니다.")
          : kind === "PUSH"
            ? (en ? "Git restore-branch push failed." : "Git 복구 브랜치 Push 실행 중 오류가 발생했습니다.")
            : (en ? "Git tag push failed." : "Git 태그 Push 실행 중 오류가 발생했습니다.")
      ));
    } finally {
      setRunningGitExecution("");
    }
  };

  const handleRunRestore = async (kind: "GIT" | "SQL" | "PHYSICAL" | "PITR") => {
    const labels: Record<typeof kind, string> = {
      GIT: en ? "Run Git rollback now?" : "Git 롤백을 실행하시겠습니까?",
      SQL: en ? "Open the SQL restore flow now?" : "SQL 복구 흐름을 진행하시겠습니까?",
      PHYSICAL: en ? "Run physical restore now? Live traffic will be interrupted." : "물리 복구를 실행하시겠습니까? 서비스 요청이 잠시 중단됩니다.",
      PITR: en ? "Run PITR now? Live traffic will be interrupted." : "PITR를 실행하시겠습니까? 서비스 요청이 잠시 중단됩니다."
    };
    if (!confirmAction(labels[kind])) {
      return;
    }
    setRunningRestore(kind);
    setMessage(
      kind === "PHYSICAL" || kind === "PITR"
        ? (en ? "Physical restore/PITR has started. Please wait for a while." : "물리 복구/PITR가 시작되었습니다. 잠시 기다려주세요.")
        : ""
    );
    try {
      const executionType = kind === "GIT"
        ? "GIT_RESTORE_COMMIT"
        : kind === "SQL"
          ? "DB_RESTORE_SQL"
          : kind === "PHYSICAL"
            ? "DB_RESTORE_PHYSICAL"
            : "DB_RESTORE_PITR";
      const nextPage = await runBackupExecution(executionType, {
        gitRestoreCommit,
        dbRestoreType,
        dbRestoreTarget,
        dbRestorePointInTime,
        sudoPassword
      });
      pageState.setValue(nextPage);
      setMessage(String(nextPage.backupConfigMessage || (en ? "Restore execution finished." : "복구 실행이 완료되었습니다.")));
      setSudoPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Restore execution failed." : "복구 실행 중 오류가 발생했습니다."));
    } finally {
      setRunningRestore("");
    }
  };

  const renderSummary = (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6" data-help-id="backup-config-summary">
      {summary.map((card, idx) => (
        <article className="gov-card" key={idx}>
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{stringOf(card, "title")}</p>
          <p className={`mt-3 text-2xl font-black ${stringOf(card, "toneClass")}`}>{stringOf(card, "value")}</p>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)] leading-6">{stringOf(card, "description")}</p>
        </article>
      ))}
    </section>
  );

  const renderStorage = (
    <section className="gov-card p-0 overflow-hidden" data-help-id="backup-config-storage">
      <div className="px-6 py-5 border-b border-[var(--kr-gov-border-light)]">
        <h3 className="text-lg font-bold">{en ? "Storage Targets" : "저장 대상"}</h3>
        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Registered folder and command targets used by backup execution." : "백업 실행이 참조하는 폴더와 명령 대상을 확인합니다."}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="gov-table-header">
              <th className="px-4 py-3">{en ? "Type" : "유형"}</th>
              <th className="px-4 py-3">{en ? "Location" : "위치"}</th>
              <th className="px-4 py-3">{en ? "Owner" : "관리 주체"}</th>
              <th className="px-4 py-3">{en ? "Note" : "비고"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {storagePage.rows.map((row, idx) => (
              <tr key={idx}>
                <td className="px-4 py-3 font-bold">{stringOf(row, "storageType")}</td>
                <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "location")}</td>
                <td className="px-4 py-3">{stringOf(row, "owner")}</td>
                <td className="px-4 py-3">{stringOf(row, "note")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {storagePage.totalPages > 1 ? <MemberPagination className="border-t-0" currentPage={storagePage.currentPage} onPageChange={(pageNumber) => movePage("storage", pageNumber)} totalPages={storagePage.totalPages} /> : null}
    </section>
  );

  const renderExecutions = (
    <section className="gov-card p-0 overflow-hidden" data-help-id="backup-config-executions">
      <div className="px-6 py-5 border-b border-[var(--kr-gov-border-light)]">
        <h3 className="text-lg font-bold">{en ? "Execution History" : "실행 이력"}</h3>
        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Recent backup and settings activity." : "최근 백업 및 설정 변경 활동입니다."}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="gov-table-header">
              <th className="px-4 py-3">{en ? "Executed At" : "실행 시각"}</th>
              <th className="px-4 py-3">{en ? "Type" : "유형"}</th>
              <th className="px-4 py-3">{en ? "Result" : "결과"}</th>
              <th className="px-4 py-3">{en ? "Duration" : "소요 시간"}</th>
              <th className="px-4 py-3">{en ? "Note" : "비고"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {executionPage.rows.map((row, idx) => (
              <tr key={idx}>
                <td className="px-4 py-3">{stringOf(row, "executedAt")}</td>
                <td className="px-4 py-3 font-bold">{stringOf(row, "profileName")}</td>
                <td className="px-4 py-3">{stringOf(row, "result")}</td>
                <td className="px-4 py-3">{stringOf(row, "duration")}</td>
                <td className="px-4 py-3">{stringOf(row, "note")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {executionPage.totalPages > 1 ? <MemberPagination className="border-t-0" currentPage={executionPage.currentPage} onPageChange={(pageNumber) => movePage("execution", pageNumber)} totalPages={executionPage.totalPages} /> : null}
    </section>
  );

  const renderCurrentJob = currentJob ? (
    <section className="gov-card mb-6" data-help-id="backup-config-current-job">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">{en ? "Live Backup Job" : "실시간 백업 작업"}</h3>
          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
            {en ? "Track the current or latest backup execution and inspect each stage log." : "현재 또는 최근 백업 실행 상태와 단계별 로그를 확인합니다."}
          </p>
        </div>
        <div className="rounded-full border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] px-3 py-1 text-xs font-bold">
          {stringOf(currentJob as Record<string, string>, "status")}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Job ID" : "작업 ID"}</p>
          <p className="mt-2 font-mono text-sm">{stringOf(currentJob as Record<string, string>, "jobId")}</p>
        </article>
        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Profile" : "프로필"}</p>
          <p className="mt-2 text-sm">{stringOf(currentJob as Record<string, string>, "profileName")}</p>
        </article>
        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Started" : "시작 시각"}</p>
          <p className="mt-2 text-sm">{stringOf(currentJob as Record<string, string>, "startedAt")}</p>
        </article>
        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Duration" : "경과 시간"}</p>
          <p className="mt-2 text-sm">{stringOf(currentJob as Record<string, string>, "duration")}</p>
        </article>
      </div>
      <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-slate-800 bg-slate-950 px-4 py-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">{en ? "Live Log" : "실시간 로그"}</p>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-100">{((currentJob.logLines as Array<string> | undefined) || []).join("\n") || (en ? "No logs yet." : "아직 로그가 없습니다.")}</pre>
      </div>
      {stringOf(currentJob as Record<string, string>, "resultMessage") ? (
        <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(currentJob as Record<string, string>, "resultMessage")}</p>
      ) : null}
    </section>
  ) : null;

  const renderVersions = (
    <section className="gov-card p-0 overflow-hidden" data-help-id="backup-config-versions">
      <div className="px-6 py-5 border-b border-[var(--kr-gov-border-light)]">
        <h3 className="text-lg font-bold">{en ? "Saved Versions" : "저장 버전"}</h3>
        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Configuration snapshots recorded whenever backup settings are saved." : "백업 설정을 저장할 때마다 기록되는 설정 스냅샷입니다."}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="gov-table-header">
              <th className="px-4 py-3">{en ? "Version" : "버전"}</th>
              <th className="px-4 py-3">{en ? "Saved At" : "저장 시각"}</th>
              <th className="px-4 py-3">{en ? "Saved By" : "저장자"}</th>
              <th className="px-4 py-3">{en ? "Memo" : "메모"}</th>
              <th className="px-4 py-3">{en ? "Backup Root" : "백업 루트"}</th>
              <th className="px-4 py-3">{en ? "Cron" : "크론"}</th>
              <th className="px-4 py-3">{en ? "Git Summary" : "Git 요약"}</th>
              <th className="px-4 py-3">{en ? "DB Summary" : "DB 요약"}</th>
              <th className="px-4 py-3 text-right">{en ? "Action" : "작업"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {versionPage.rows.map((row, idx) => (
              <tr
                key={idx}
                className={stringOf(row, "versionId") === stringOf(selectedVersion || {}, "versionId") ? "bg-[rgba(28,100,242,0.06)]" : ""}
              >
                <td className="px-4 py-3 font-bold">{stringOf(row, "versionId")}</td>
                <td className="px-4 py-3">{stringOf(row, "savedAt")}</td>
                <td className="px-4 py-3">{stringOf(row, "savedBy")}</td>
                <td className="px-4 py-3">{stringOf(row, "versionMemo") || "-"}</td>
                <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "backupRootPath")}</td>
                <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "cronExpression")}</td>
                <td className="px-4 py-3">{stringOf(row, "gitSummary") || stringOf(row, "gitEnabled")}</td>
                <td className="px-4 py-3">{stringOf(row, "dbSummary") || stringOf(row, "dbEnabled")}</td>
                <td className="px-4 py-3 text-right">
                  <MemberButton type="button" variant="secondary" onClick={() => setSelectedVersionId(stringOf(row, "versionId"))}>
                    {en ? "Details" : "상세"}
                  </MemberButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {versionPage.totalPages > 1 ? <MemberPagination className="border-t-0" currentPage={versionPage.currentPage} onPageChange={(pageNumber) => movePage("version", pageNumber)} totalPages={versionPage.totalPages} /> : null}
    </section>
  );

  const renderVersionDetails = selectedVersion ? (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]" data-help-id="backup-config-version-details">
      <article className="gov-card p-0 overflow-hidden">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <h3 className="text-lg font-bold">{en ? "Selected Version Details" : "선택 버전 상세"}</h3>
          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
            {`${stringOf(selectedVersion, "versionId")} | ${stringOf(selectedVersion, "savedAt")} | ${stringOf(selectedVersion, "savedBy")}`}
          </p>
          {stringOf(selectedVersion, "versionMemo") ? <p className="mt-2 text-sm text-[var(--kr-gov-text-primary)]">{stringOf(selectedVersion, "versionMemo")}</p> : null}
        </div>
        <div className="grid grid-cols-1 gap-5 px-6 py-6 lg:grid-cols-3">
          {Array.from(new Set(versionDetailRows.map((row) => row.group))).map((group) => (
            <article key={group} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-4">
              <h4 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{group}</h4>
              <dl className="mt-3 space-y-3 text-sm">
                {versionDetailRows.filter((row) => row.group === group).map((row) => (
                  <div key={`${group}-${row.label}`}>
                    <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{row.label}</dt>
                    <dd className="mt-1 break-words font-mono text-[13px] text-[var(--kr-gov-text-primary)]">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </article>
      <article className="gov-card p-0 overflow-hidden">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <h3 className="text-lg font-bold">{en ? "Changes From Previous Version" : "이전 버전 대비 변경점"}</h3>
          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
            {previousVersion
              ? `${stringOf(previousVersion, "versionId")} -> ${stringOf(selectedVersion, "versionId")}`
              : (en ? "No previous version to compare." : "비교할 이전 버전이 없습니다.")}
          </p>
        </div>
        <div className="px-6 py-6">
          <MemberPageActions>
            <MemberButton type="button" variant="primary" disabled={restoringVersion} onClick={handleRestoreVersion}>
              {restoringVersion ? (en ? "Restoring..." : "복원 중...") : (en ? "Restore This Version" : "이 버전으로 복원")}
            </MemberButton>
          </MemberPageActions>
          <div className="mt-4">
          {versionDiffRows.length ? (
            <div className="space-y-3">
              {versionDiffRows.map((row) => (
                <article key={row.label} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{row.label}</p>
                  <p className="mt-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Previous" : "이전"}</p>
                  <p className="mt-1 break-words font-mono text-[13px] text-[var(--kr-gov-text-secondary)]">{row.previous}</p>
                  <p className="mt-3 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Current" : "현재"}</p>
                  <p className="mt-1 break-words font-mono text-[13px] text-[var(--kr-gov-text-primary)]">{row.current}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "No field differences were detected." : "필드 변경점이 없습니다."}
            </p>
          )}
          </div>
        </div>
      </article>
    </section>
  ) : null;

  const renderGitPrecheck = (
    <section className="gov-card p-0 overflow-hidden" data-help-id="backup-config-git-precheck">
      <div className="px-6 py-5 border-b border-[var(--kr-gov-border-light)]">
        <h3 className="text-lg font-bold">{en ? "Git Push Precheck" : "Git Push 사전 점검"}</h3>
        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
          {en
            ? "Tracked large artifacts and generated files that can break HTTPS push are listed here."
            : "HTTPS push를 깨뜨릴 수 있는 대용량 추적 파일과 산출물 경로를 여기서 확인합니다."}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="gov-table-header">
              <th className="px-4 py-3">{en ? "Path" : "경로"}</th>
              <th className="px-4 py-3">{en ? "Size" : "크기"}</th>
              <th className="px-4 py-3">{en ? "Git Object" : "Git 오브젝트"}</th>
              <th className="px-4 py-3">{en ? "Note" : "비고"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gitPrecheckRows.length ? gitPrecheckPage.rows.map((row, idx) => (
              <tr key={idx}>
                <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "path")}</td>
                <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "sizeLabel")}</td>
                <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "objectId")}</td>
                <td className="px-4 py-3">{stringOf(row, "note")}</td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-6 text-center text-[var(--kr-gov-text-secondary)]" colSpan={4}>
                  {en ? "No tracked push-risk artifacts were detected." : "추적 중인 push 위험 산출물이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {gitPrecheckPage.totalPages > 1 ? <MemberPagination className="border-t-0" currentPage={gitPrecheckPage.currentPage} onPageChange={(pageNumber) => movePage("gitPrecheck", pageNumber)} totalPages={gitPrecheckPage.totalPages} /> : null}
    </section>
  );

  const renderPlaybooks = (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3" data-help-id="backup-config-playbooks">
      {playbookPage.rows.map((item, idx) => (
        <article className="gov-card" key={idx}>
          <h3 className="text-lg font-bold">{stringOf(item, "title")}</h3>
          <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body")}</p>
        </article>
      ))}
    </section>
  );

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Backup" : "백업" },
        { label: preset.title }
      ]}
      title={preset.title}
      subtitle={preset.subtitle}
    >
      {pageState.loading ? (
        <PageStatusNotice tone="warning">
          {en ? "Loading backup screen data." : "백업 화면 데이터를 불러오는 중입니다."}
        </PageStatusNotice>
      ) : null}
      {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
      {message ? <PageStatusNotice tone={message.includes("오류") || message.includes("Failed") ? "error" : "success"}>{message}</PageStatusNotice> : null}
      <AdminWorkspacePageFrame>
      <div className="mb-6 flex space-x-1 rounded-lg bg-slate-100 p-1" role="tablist">
        <button
          className={`flex-1 rounded-md px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === "config" 
              ? "bg-white text-[var(--kr-gov-primary)] shadow" 
              : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
          onClick={() => setActiveTab("config")}
          role="tab"
          aria-selected={activeTab === "config"}
        >
          {en ? "1. Backup Configuration" : "1. 백업 설정 관리"}
        </button>
        <button
          className={`flex-1 rounded-md px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === "backup" 
              ? "bg-white text-[var(--kr-gov-primary)] shadow" 
              : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
          onClick={() => setActiveTab("backup")}
          role="tab"
          aria-selected={activeTab === "backup"}
        >
          {en ? "2. Execute Backup" : "2. 백업 실행"}
        </button>
        <button
          className={`flex-1 rounded-md px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === "restore" 
              ? "bg-white text-[var(--kr-gov-primary)] shadow" 
              : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
          onClick={() => setActiveTab("restore")}
          role="tab"
          aria-selected={activeTab === "restore"}
        >
          {en ? "3. Execute Restore" : "3. 복구 실행"}
        </button>
      </div>

      {activeTab === "config" && (
        <CollectionResultPanel description={en ? "Backup settings, execution readiness, restore targets, and version comparison stay in one governed workspace across the backup menu family." : "백업 설정, 실행 준비, 복구 대상, 버전 비교를 백업 메뉴군 전체에서 하나의 운영 작업 공간으로 유지합니다."} title={en ? "Backup operation workflow" : "백업 운영 흐름"}>
          {en ? "Move between backup settings, execution, restore, and version review without changing the overall page pattern." : "백업 설정, 실행, 복구, 버전 검토 화면을 이동해도 전체 페이지 패턴이 바뀌지 않게 유지합니다."}
        </CollectionResultPanel>
      )}

      {renderSummary}
      {renderCurrentJob}

      {activeTab === "config" && (
        <>
          <section className="gov-card mb-6" data-help-id="backup-config-form">
            <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
              <h3 className="text-lg font-bold">{en ? "Backup Registration" : "백업 설정 등록"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Register the backup folder, cron schedule, git source backup target, and database dump target used by the backup system." : "백업 시스템이 사용할 백업 폴더, 크론 스케줄, git 소스 백업 대상, DB dump 대상을 등록합니다."}</p>
            </div>
            <div className="space-y-8 px-6 py-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <BackupField label={en ? "Backup Root Folder" : "백업 루트 폴더"} value={valueOf(form, "backupRootPath")} onChange={(value) => updateField("backupRootPath", value)} placeholder="/opt/Resonance/var/backup" />
                <BackupField label={en ? "Retention Days" : "보관 일수"} value={valueOf(form, "retentionDays")} onChange={(value) => updateField("retentionDays", value)} placeholder="35" type="number" />
                <BackupField label={en ? "Cron Expression" : "크론 표현식"} value={valueOf(form, "cronExpression")} onChange={(value) => updateField("cronExpression", value)} placeholder="0 0 2 * * *" />
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Version Memo" : "버전 메모"}</span>
                <textarea
                  className="gov-input min-h-[96px]"
                  value={valueOf(form, "versionMemo")}
                  onChange={(event) => updateField("versionMemo", event.target.value)}
                  placeholder={en ? "Describe why this configuration changed." : "이번 설정 변경 이유를 남기세요."}
                />
              </label>
              <BackupToggle
                label={en ? "Enable Offsite Sync" : "원격 동기화 사용"}
                checked={yes(form, "offsiteSyncEnabled")}
                onChange={(checked) => updateField("offsiteSyncEnabled", checked ? "Y" : "N")}
                description={en ? "Use this when backup bundles must be copied to a remote archive after local generation." : "로컬 생성 후 백업 번들을 원격 아카이브로 복제해야 할 때 사용합니다."}
              />

              <section className="space-y-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-5 py-5">
                <div>
                  <h4 className="text-base font-bold">{en ? "Git Backup Target" : "Git 백업 대상"}</h4>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Register the repository path and branch scope to archive source changes together with operational backups." : "운영 백업과 함께 소스 변경 이력을 보관할 저장소 경로와 branch 범위를 등록합니다."}</p>
                </div>
                <BackupToggle
                  label={en ? "Enable Git Backup" : "Git 백업 사용"}
                  checked={yes(form, "gitEnabled")}
                  onChange={(checked) => updateField("gitEnabled", checked ? "Y" : "N")}
                  description={en ? "When enabled, backup execution pages can include source bundle generation." : "사용 시 백업 실행 화면에서 소스 번들 생성을 포함할 수 있습니다."}
                />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <BackupField label={en ? "Repository Path" : "저장소 경로"} value={valueOf(form, "gitRepositoryPath")} onChange={(value) => updateField("gitRepositoryPath", value)} placeholder="/opt/Resonance" />
                  <BackupField label={en ? "Remote Name" : "Remote 이름"} value={valueOf(form, "gitRemoteName")} onChange={(value) => updateField("gitRemoteName", value)} placeholder="origin" />
                  <BackupField label={en ? "Remote URL" : "Remote URL"} value={valueOf(form, "gitRemoteUrl")} onChange={(value) => updateField("gitRemoteUrl", value)} placeholder="https://github.com/sjkim0831/2026_carbonet.git" />
                  <BackupField label={en ? "Git Username" : "Git 사용자명"} value={valueOf(form, "gitUsername")} onChange={(value) => updateField("gitUsername", value)} placeholder="sjkim0831" />
                  <BackupField label={en ? "Branch Pattern" : "Branch 패턴"} value={valueOf(form, "gitBranchPattern")} onChange={(value) => updateField("gitBranchPattern", value)} placeholder="main" />
                  <BackupField label={en ? "Bundle Prefix" : "번들 Prefix"} value={valueOf(form, "gitBundlePrefix")} onChange={(value) => updateField("gitBundlePrefix", value)} placeholder="carbonet-src" />
                  <BackupField label={en ? "Backup Mode" : "백업 모드"} value={valueOf(form, "gitBackupMode")} onChange={(value) => updateField("gitBackupMode", value)} placeholder="BUNDLE_AND_PUSH / PUSH_RESTORE_BRANCH / BUNDLE / TAG_PUSH" />
                  <BackupField label={en ? "Restore Branch Prefix" : "복구 브랜치 Prefix"} value={valueOf(form, "gitRestoreBranchPrefix")} onChange={(value) => updateField("gitRestoreBranchPrefix", value)} placeholder="backup/restore" />
                  <BackupField label={en ? "Tag Prefix" : "태그 Prefix"} value={valueOf(form, "gitTagPrefix")} onChange={(value) => updateField("gitTagPrefix", value)} placeholder="backup" />
                  <BackupField label={en ? "Git Token" : "Git 토큰"} value={valueOf(form, "gitAuthToken")} onChange={(value) => updateField("gitAuthToken", value)} placeholder={en ? "Paste personal access token" : "개인 액세스 토큰 붙여넣기"} type="password" />
                </div>
                <BackupSecretHint configured={yes(form, "gitAuthTokenConfigured")} masked={valueOf(form, "gitAuthTokenMasked")} en={en} />
              </section>

              <section className="space-y-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-5 py-5">
                <div>
                  <h4 className="text-base font-bold">{en ? "Database Backup Target" : "DB 백업 대상"}</h4>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Register the database connection target and dump command referenced by backup execution." : "백업 실행이 참조할 DB 접속 대상과 dump 명령을 등록합니다."}</p>
                </div>
                <BackupToggle
                  label={en ? "Enable Database Backup" : "DB 백업 사용"}
                  checked={yes(form, "dbEnabled")}
                  onChange={(checked) => updateField("dbEnabled", checked ? "Y" : "N")}
                  description={en ? "When enabled, execution pages can call the configured database dump command." : "사용 시 실행 화면에서 등록된 DB dump 명령을 사용할 수 있습니다."}
                />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <BackupField label={en ? "DB Host" : "DB Host"} value={valueOf(form, "dbHost")} onChange={(value) => updateField("dbHost", value)} placeholder="127.0.0.1" />
                  <BackupField label={en ? "DB Port" : "DB Port"} value={valueOf(form, "dbPort")} onChange={(value) => updateField("dbPort", value)} placeholder="33000" />
                  <BackupField label={en ? "DB Name" : "DB 이름"} value={valueOf(form, "dbName")} onChange={(value) => updateField("dbName", value)} placeholder="carbonet" />
                  <BackupField label={en ? "DB User" : "DB 사용자"} value={valueOf(form, "dbUser")} onChange={(value) => updateField("dbUser", value)} placeholder="dba" />
                  <BackupField label={en ? "Dump Command" : "Dump 명령"} value={valueOf(form, "dbDumpCommand")} onChange={(value) => updateField("dbDumpCommand", value)} placeholder="/opt/util/cubrid/11.2/scripts/backup_sql.sh" />
                  <BackupField label={en ? "Schema Scope" : "스키마 범위"} value={valueOf(form, "dbSchemaScope")} onChange={(value) => updateField("dbSchemaScope", value)} placeholder="FULL" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <MemberButton type="button" variant="secondary" onClick={() => { window.location.href = buildLocalizedPath("/admin/system/db-promotion-policy", "/en/admin/system/db-promotion-policy"); }}>
                    {en ? "Open Table Policy Catalog" : "테이블 정책 카탈로그 열기"}
                  </MemberButton>
                </div>
              </section>

              <section className="space-y-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-5 py-5">
                <div>
                  <h4 className="text-base font-bold">{en ? "Production DB Reflection Policy" : "운영 DB 반영 정책"}</h4>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? "Set the default policy used by version-management diff and patch execution. Controlled metadata stays promotable; business data stays blocked unless you explicitly loosen the rule."
                      : "버전 관리 화면의 diff/patch 실행 기본 정책을 정의합니다. 관리 메타데이터는 반영 가능 상태를 유지하고, 업무 데이터는 정책을 명시적으로 풀지 않으면 기본 차단합니다."}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Promotion Data Policy" : "반영 데이터 정책"}</span>
                    <AdminSelect value={valueOf(form, "dbPromotionDataPolicy") || "CONTROLLED_REFERENCE_ONLY"} onChange={(event) => updateField("dbPromotionDataPolicy", event.target.value)}>
                      <option value="CONTROLLED_REFERENCE_ONLY">{en ? "Controlled metadata only" : "관리 메타데이터만"}</option>
                      <option value="BUSINESS_WITH_OVERRIDE">{en ? "Business data with override" : "업무 데이터는 우회 사유 필요"}</option>
                      <option value="BUSINESS_ALLOWED">{en ? "Business data allowed" : "업무 데이터 허용"}</option>
                    </AdminSelect>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Diff Execution Preset" : "diff 실행 프리셋"}</span>
                    <AdminSelect value={valueOf(form, "dbDiffExecutionPreset") || "PATCH_WITH_DIFF"} onChange={(event) => updateField("dbDiffExecutionPreset", event.target.value)}>
                      <option value="PATCH_ONLY">{en ? "Patch only" : "패치만 반영"}</option>
                      <option value="PATCH_WITH_DIFF">{en ? "Patch with diff guard" : "패치 + diff 검증"}</option>
                      <option value="FULL_REMOTE_DEPLOY">{en ? "Full remote deploy" : "원격 전체 배포"}</option>
                    </AdminSelect>
                  </label>
                  <BackupToggle
                    label={en ? "Allow Local Diff Apply" : "local diff 적용 허용"}
                    checked={yes(form, "dbApplyLocalDiffYn")}
                    onChange={(checked) => updateField("dbApplyLocalDiffYn", checked ? "Y" : "N")}
                    description={en ? "Use only when you intentionally want remote changes synchronized back into local/dev." : "운영 변경을 로컬/개발로 역반영하려는 경우에만 사용하세요."}
                  />
                  <BackupToggle
                    label={en ? "Force Destructive Diff" : "파괴적 diff 강제"}
                    checked={yes(form, "dbForceDestructiveDiffYn")}
                    onChange={(checked) => updateField("dbForceDestructiveDiffYn", checked ? "Y" : "N")}
                    description={en ? "Keep this off unless a reviewed destructive migration really must run." : "검토된 파괴적 마이그레이션이 정말 필요한 경우가 아니면 끄는 것이 기본입니다."}
                  />
                  <BackupToggle
                    label={en ? "Fail On Untracked Destructive Diff" : "미추적 파괴적 diff 발견 시 실패"}
                    checked={yes(form, "dbFailOnUntrackedDestructiveDiffYn")}
                    onChange={(checked) => updateField("dbFailOnUntrackedDestructiveDiffYn", checked ? "Y" : "N")}
                    description={en ? "Recommended for production safety so unmanaged destructive drift blocks execution." : "관리되지 않은 파괴적 drift가 있으면 실행을 막아 운영 안전성을 유지합니다."}
                  />
                  <BackupToggle
                    label={en ? "Require DB Patch History Evidence" : "DB Patch 이력 증거 필수"}
                    checked={yes(form, "dbRequirePatchHistoryYn")}
                    onChange={(checked) => updateField("dbRequirePatchHistoryYn", checked ? "Y" : "N")}
                    description={en ? "Treat remote DB apply as failed unless DB_PATCH_HISTORY or equivalent evidence is recorded." : "DB_PATCH_HISTORY 또는 동등한 증거가 남지 않으면 원격 DB 반영을 실패로 간주합니다."}
                  />
                </div>
              </section>

              <MemberPageActions>
                <MemberButton type="button" variant="primary" disabled={saving || !page?.canUseBackupConfigSave} onClick={handleSave}>
                  {saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Backup Settings" : "백업 설정 저장")}
                </MemberButton>
              </MemberPageActions>
            </div>
          </section>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr] mb-6">
            {renderStorage}
            {renderVersions}
          </div>
          <>
            {renderPlaybooks}
            {playbookPage.totalPages > 1 ? <MemberPagination currentPage={playbookPage.currentPage} onPageChange={(pageNumber) => movePage("playbook", pageNumber)} totalPages={playbookPage.totalPages} /> : null}
          </>
        </>
      )}

      {activeTab === "backup" ? (
        <>
          {BackupModeCloseoutPanel({
            title: en ? "Backup Execution Readiness" : "백업 실행 준비 상태",
            description: en
              ? "This route is execution-first: operators must see authority, targets, source evidence, and history before running a backup."
              : "이 라우트는 실행 우선 화면입니다. 운영자는 백업 실행 전 권한, 대상, 소스 증적, 이력을 먼저 확인해야 합니다.",
            items: backupExecutionCloseoutItems,
            en
          })}
          <section className="gov-card mb-6" data-help-id="backup-config-run-actions">
            <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
              <h3 className="text-lg font-bold">{en ? "Backup Run Actions" : "백업 실행 작업"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Use the primary action below to automatically clean artifacts, commit current changes, and push the base branch." : "아래 주 작업 버튼으로 산출물 정리, 현재 변경 커밋, 기준 브랜치 Push를 한 번에 실행합니다."}</p>
            </div>
            <div className="px-6 py-6">
              <div className="mb-5 rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                {en
                  ? `Recommended: Auto Commit And Push Base Branch (${valueOf(form, "gitBranchPattern") || "main"})`
                  : `권장 작업: 자동 커밋 후 기준 브랜치 Push (${valueOf(form, "gitBranchPattern") || "main"})`}
              </div>
              <MemberPageActions>
                <MemberButton type="button" variant="primary" disabled={backupJobActive || Boolean(runningGitExecution) || !page?.canUseGitBackupExecution} onClick={() => handleRunGitExecution("COMMIT_BASE")}>
                  {runningGitExecution === "COMMIT_BASE" ? (en ? "Auto Committing And Pushing..." : "자동 커밋 후 Push 실행 중...") : (en ? `Auto Commit And Push Base Branch (${valueOf(form, "gitBranchPattern") || "main"})` : `자동 커밋 후 기준 브랜치 Push (${valueOf(form, "gitBranchPattern") || "main"})`)}
                </MemberButton>
                <MemberButton type="button" variant="secondary" disabled={backupJobActive || Boolean(runningGitExecution) || !page?.canUseGitBackupExecution} onClick={() => handleRunGitExecution("PRECHECK")}>
                  {runningGitExecution === "PRECHECK" ? (en ? "Running Git Push Precheck..." : "Git Push 사전 점검 실행 중...") : (en ? "Run Git Push Precheck" : "Git Push 사전 점검")}
                </MemberButton>
                <MemberButton type="button" variant="secondary" disabled={backupJobActive || Boolean(runningGitExecution) || !page?.canUseGitBackupExecution} onClick={() => handleRunGitExecution("CLEANUP")}>
                  {runningGitExecution === "CLEANUP" ? (en ? "Running Safe Cleanup..." : "산출물 자동 정리 실행 중...") : (en ? "Run Safe Artifact Cleanup" : "산출물 자동 정리")}
                </MemberButton>
                <MemberButton type="button" variant="secondary" disabled={backupJobActive || Boolean(runningGitExecution) || !page?.canUseGitBackupExecution} onClick={() => handleRunGitExecution("BASE")}>
                  {runningGitExecution === "BASE" ? (en ? "Pushing Base Branch..." : "Git 기준 브랜치 Push 실행 중...") : (en ? `Push Base Branch Only (${valueOf(form, "gitBranchPattern") || "main"})` : `기준 브랜치 Push만 실행 (${valueOf(form, "gitBranchPattern") || "main"})`)}
                </MemberButton>
                <MemberButton type="button" variant="secondary" disabled={backupJobActive || Boolean(runningGitExecution) || !page?.canUseGitBackupExecution} onClick={() => handleRunGitExecution("BUNDLE")}>
                  {runningGitExecution === "BUNDLE" ? (en ? "Running Git Bundle..." : "Git 번들 백업 실행 중...") : (en ? "Run Git Bundle" : "Git 번들 백업 실행")}
                </MemberButton>
                <MemberButton type="button" variant="secondary" disabled={backupJobActive || Boolean(runningGitExecution) || !page?.canUseGitBackupExecution} onClick={() => handleRunGitExecution("PUSH")}>
                  {runningGitExecution === "PUSH" ? (en ? "Pushing Restore Branch..." : "Git 복구 브랜치 Push 실행 중...") : (en ? "Push Restore Branch" : "Git 복구 브랜치 Push 실행")}
                </MemberButton>
                <MemberButton type="button" variant="secondary" disabled={backupJobActive || Boolean(runningGitExecution) || !page?.canUseGitBackupExecution} onClick={() => handleRunGitExecution("TAG")}>
                  {runningGitExecution === "TAG" ? (en ? "Pushing Backup Tag..." : "Git 태그 Push 실행 중...") : (en ? "Push Backup Tag" : "Git 태그 Push 실행")}
                </MemberButton>
                <MemberButton type="button" variant="primary" disabled={backupJobActive || runningDbBackup || !page?.canUseDbBackupExecution} onClick={handleRunDbBackup}>
                  {runningDbBackup ? (en ? "Running DB Backup..." : "DB 백업 실행 중...") : (en ? "Run DB Backup" : "DB 백업 실행")}
                </MemberButton>
              </MemberPageActions>
            </div>
          </section>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr] mb-6">
            {renderExecutions}
            {renderStorage}
          </div>
          <div className="mb-6">{renderGitPrecheck}</div>
          <>
            {renderPlaybooks}
            {playbookPage.totalPages > 1 ? <MemberPagination currentPage={playbookPage.currentPage} onPageChange={(pageNumber) => movePage("playbook", pageNumber)} totalPages={playbookPage.totalPages} /> : null}
          </>
        </>
      ) : null}

      {activeTab === "restore" ? (
        <>
          {BackupModeCloseoutPanel({
            title: en ? "Restore Execution Readiness" : "복구 실행 준비 상태",
            description: en
              ? "This route is restore-first: operators must confirm rollback points, database targets, runtime guard, and execution authority before restoring."
              : "이 라우트는 복구 우선 화면입니다. 운영자는 복구 전 롤백 지점, DB 대상, 런타임 보호, 실행 권한을 먼저 확인해야 합니다.",
            items: restoreExecutionCloseoutItems,
            en
          })}

          <section className="gov-card mb-6" data-help-id="restore-evidence-logging">
            <div className="border-b border-amber-200 bg-amber-50 px-6 py-5">
              <h3 className="text-lg font-bold text-amber-900">{en ? "Execution Authorization & Evidence" : "실행 승인 및 증적 기록"}</h3>
              <p className="mt-1 text-sm text-amber-800">{en ? "Restore operations mutate live systems. Provide the incident ticket number or approval evidence before proceeding." : "복구 작업은 운영 시스템을 직접 변경합니다. 진행 전 장애 티켓 번호나 승인 증거를 입력해야 합니다."}</p>
            </div>
            <div className="px-6 py-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-slate-700">{en ? "Incident / Ticket Number" : "장애 / 티켓 번호"}</span>
                  <input type="text" className="gov-input" placeholder="e.g. INC-20260415-001" />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-slate-700">{en ? "Approver" : "승인자"}</span>
                  <input type="text" className="gov-input" placeholder={en ? "e.g. Ops Lead" : "예: 운영 리더"} />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700">{en ? "Restore Rationale" : "복구 사유"}</span>
                <textarea className="gov-input min-h-[80px]" placeholder={en ? "Briefly explain why this restore is necessary." : "이 복구가 필요한 이유를 간단히 설명하세요."} />
              </label>
              <div className="mt-4 flex items-center gap-2">
                <input type="checkbox" id="confirm-downtime" className="h-4 w-4 rounded border-slate-300" />
                <label htmlFor="confirm-downtime" className="text-sm font-bold text-slate-700">
                  {en ? "I acknowledge that this restore may cause temporary service downtime and data overwritten." : "이 복구 작업으로 인해 일시적인 서비스 중단 및 데이터 덮어쓰기가 발생할 수 있음을 인지하고 승인합니다."}
                </label>
              </div>
            </div>
          </section>

          <section className="gov-card mb-6" data-help-id="backup-restore-actions">
            <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
              <h3 className="text-lg font-bold">{en ? "Restore Targets" : "복구 대상 선택"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Restore Git to a prior commit, or recover the database from SQL, physical, or point-in-time restore windows."
                  : "Git을 이전 커밋 상태로 되돌리거나, DB를 SQL/물리/시점 복구 창 기준으로 복구합니다."}
              </p>
            </div>
            <div className="space-y-8 px-6 py-6">
              <section className="space-y-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-5 py-5">
                <div>
                  <h4 className="text-base font-bold">{en ? "Git Rollback" : "Git 롤백"}</h4>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en ? "A new rollback commit is created from the selected commit state and pushed to the base branch." : "선택한 커밋 상태로 새 롤백 커밋을 만든 뒤 기준 브랜치에 push합니다."}
                  </p>
                </div>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Rollback Commit" : "롤백 커밋"}</span>
                  <select className="gov-input" value={gitRestoreCommit} onChange={(event) => setGitRestoreCommit(event.target.value)}>
                    {restoreGitRows.map((row) => (
                      <option key={stringOf(row, "id")} value={stringOf(row, "id")}>
                        {`${stringOf(row, "shortId") || stringOf(row, "id")} | ${stringOf(row, "recordedAt")} | ${stringOf(row, "note")}`}
                      </option>
                    ))}
                  </select>
                </label>
                <MemberPageActions>
                  <MemberButton type="button" variant="primary" disabled={backupJobActive || Boolean(runningRestore) || !page?.canUseGitBackupExecution || !gitRestoreCommit} onClick={() => handleRunRestore("GIT")}>
                    {runningRestore === "GIT" ? (en ? "Running Git Rollback..." : "Git 롤백 실행 중...") : (en ? "Run Git Rollback" : "Git 롤백 실행")}
                  </MemberButton>
                </MemberPageActions>
              </section>

              <section className="space-y-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-5 py-5">
                <div>
                  <h4 className="text-base font-bold">{en ? "Database Restore" : "DB 복구"}</h4>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en ? "SQL backups are selectable for 30 days by hour, physical backups for 15 days by day, and PITR is available within 2 days." : "SQL 백업은 30일 매 시각, 물리 백업은 15일 매일, PITR은 최근 2일 범위에서 선택할 수 있습니다."}
                  </p>
                  {dbRestoreType === "SQL" ? (
                    <p className="mt-2 text-sm font-semibold text-[#991b1b]">
                      {en
                        ? "SQL restore is manual-only. Use the selected snapshot from the server shell because large restores exceed the web execution window."
                        : "SQL 복구는 수동 전용입니다. 대용량 복구는 웹 실행 시간을 넘기므로 서버 쉘에서 선택한 스냅샷으로 직접 복구해야 합니다."}
                    </p>
                  ) : null}
                </div>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Restore Mode" : "복구 방식"}</span>
                  <select className="gov-input" value={dbRestoreType} onChange={(event) => {
                    const nextType = event.target.value as "SQL" | "PHYSICAL" | "PITR";
                    setDbRestoreType(nextType);
                    if (nextType === "SQL" && restoreSqlRows.length) {
                      setDbRestoreTarget(stringOf(restoreSqlRows[0], "path"));
                    } else if (nextType === "PHYSICAL" && restorePhysicalRows.length) {
                      setDbRestoreTarget(stringOf(restorePhysicalRows[0], "path"));
                    } else {
                      setDbRestoreTarget("");
                    }
                  }}>
                    <option value="SQL">{en ? "SQL Restore" : "SQL 복구"}</option>
                    <option value="PHYSICAL">{en ? "Physical Restore" : "물리 복구"}</option>
                    <option value="PITR">{en ? "Point-In-Time Restore" : "시점 복구"}</option>
                  </select>
                </label>
                {dbRestoreType === "SQL" ? (
                  <div className="space-y-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "SQL Snapshot" : "SQL 스냅샷"}</span>
                      <select className="gov-input" value={dbRestoreTarget} onChange={(event) => setDbRestoreTarget(event.target.value)}>
                        {restoreSqlRows.map((row) => (
                          <option key={stringOf(row, "path")} value={stringOf(row, "path")}>
                            {`${stringOf(row, "recordedAt")} | ${stringOf(row, "path")}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4 text-sm">
                      <p className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Manual SQL Restore Command" : "수동 SQL 복구 명령"}</p>
                      <p className="mt-2 text-[var(--kr-gov-text-secondary)]">
                        {en
                          ? `Selected snapshot: ${selectedSqlSnapshotLabel}`
                          : `선택된 스냅샷: ${selectedSqlSnapshotLabel}`}
                      </p>
                      <pre className="mt-3 overflow-x-auto rounded-md bg-[#111827] px-4 py-3 text-[12px] leading-5 text-white"><code>{manualSqlRestoreCommand}</code></pre>
                    </article>
                  </div>
                ) : null}
                {dbRestoreType === "PHYSICAL" ? (
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Physical Snapshot" : "물리 스냅샷"}</span>
                    <select className="gov-input" value={dbRestoreTarget} onChange={(event) => setDbRestoreTarget(event.target.value)}>
                      {restorePhysicalRows.map((row) => (
                        <option key={stringOf(row, "path")} value={stringOf(row, "path")}>
                          {`${stringOf(row, "recordedAt")} | ${stringOf(row, "path")}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {dbRestoreType === "PITR" ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <BackupField
                      label={en ? "Target Time" : "대상 시각"}
                      value={dbRestorePointInTime}
                      onChange={setDbRestorePointInTime}
                      type="datetime-local"
                    />
                    <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm">
                      <p className="font-bold">{en ? "PITR Window" : "PITR 가능 범위"}</p>
                      <p className="mt-2 text-[var(--kr-gov-text-secondary)]">{`${stringOf(restorePitrInfo, "windowStartLabel")} ~ ${stringOf(restorePitrInfo, "windowEndLabel")}`}</p>
                      <p className="mt-2 text-[var(--kr-gov-text-secondary)]">{stringOf(restorePitrInfo, "note")}</p>
                    </article>
                  </div>
                ) : null}
                <BackupField
                  label={en ? "Sudo Password" : "sudo 비밀번호"}
                  value={sudoPassword}
                  onChange={setSudoPassword}
                  type="password"
                  placeholder={en ? "Used only for this restore execution" : "이번 복구 실행에만 사용"}
                />
                <MemberPageActions>
                  <MemberButton
                    type="button"
                    variant="primary"
                    disabled={
                      backupJobActive
                      || Boolean(runningRestore)
                      || !page?.canUseDbBackupExecution
                      || dbRestoreType === "SQL"
                      || !sudoPassword
                      || (dbRestoreType !== "PITR" && !dbRestoreTarget)
                      || (dbRestoreType === "PITR" && !dbRestorePointInTime)
                    }
                    onClick={() => handleRunRestore(dbRestoreType === "SQL" ? "SQL" : dbRestoreType === "PHYSICAL" ? "PHYSICAL" : "PITR")}
                  >
                    {runningRestore === "SQL" || runningRestore === "PHYSICAL" || runningRestore === "PITR"
                      ? (en ? "Running DB Restore..." : "DB 복구 실행 중...")
                      : (dbRestoreType === "SQL"
                        ? (en ? "Manual SQL Restore" : "SQL 수동 복구")
                        : dbRestoreType === "PHYSICAL"
                          ? (en ? "Run Physical Restore" : "물리 복구 실행")
                          : (en ? "Run Point-In-Time Restore" : "시점 복구 실행"))}
                  </MemberButton>
                </MemberPageActions>
              </section>
            </div>
          </section>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr] mb-6">
            {renderVersions}
            {renderExecutions}
          </div>
          <>
            {renderPlaybooks}
            {playbookPage.totalPages > 1 ? <MemberPagination currentPage={playbookPage.currentPage} onPageChange={(pageNumber) => movePage("playbook", pageNumber)} totalPages={playbookPage.totalPages} /> : null}
          </>
        </>
      ) : null}

      {preset.pageKey === "version-management" ? (
        <>
          <section className="gov-card mb-6" data-help-id="backup-version-filters">
            <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
              <h3 className="text-lg font-bold">{en ? "Version Search" : "버전 검색"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Search by version ID, operator, memo, and Git/DB changes." : "버전 ID, 저장자, 메모, Git/DB 변경 여부로 검색합니다."}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 px-6 py-6 lg:grid-cols-[2fr_1fr_auto]">
              <BackupField label={en ? "Keyword" : "검색어"} value={versionSearchKeyword} onChange={setVersionSearchKeyword} placeholder={en ? "version / saved by / memo" : "버전 / 저장자 / 메모"} />
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Change Filter" : "변경 필터"}</span>
                <select className="gov-input" value={versionFilter} onChange={(event) => setVersionFilter(event.target.value as "ALL" | "GIT_CHANGED" | "DB_CHANGED")}>
                  <option value="ALL">{en ? "All" : "전체"}</option>
                  <option value="GIT_CHANGED">{en ? "Git Changed" : "Git 변경"}</option>
                  <option value="DB_CHANGED">{en ? "DB Changed" : "DB 변경"}</option>
                </select>
              </label>
              <div className="flex items-end">
                <MemberButton type="button" variant="secondary" onClick={() => {
                  setVersionSearchKeyword("");
                  setVersionFilter("ALL");
                }}>
                  {en ? "Reset" : "초기화"}
                </MemberButton>
              </div>
            </div>
          </section>
          <div className="mb-6">{renderVersions}</div>
          <div className="mb-6">{renderVersionDetails}</div>
          <div className="mb-6">{renderExecutions}</div>
          <>
            {renderPlaybooks}
            {playbookPage.totalPages > 1 ? <MemberPagination currentPage={playbookPage.currentPage} onPageChange={(pageNumber) => movePage("playbook", pageNumber)} totalPages={playbookPage.totalPages} /> : null}
          </>
        </>
      ) : null}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
