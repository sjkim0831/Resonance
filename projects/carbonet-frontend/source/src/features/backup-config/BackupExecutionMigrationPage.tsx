import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchBackupConfigPage, runBackupExecution } from "../../lib/api/ops";
import { readBootstrappedBackupConfigPageData } from "../../lib/api/bootstrap";
import type { BackupConfigPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { BinaryStatusCard, DiagnosticCard, PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MemberButton, MemberLinkButton, MemberPagination } from "../member/common";
import { stringOf } from "../admin-system/adminSystemShared";

const TABLE_PAGE_SIZE = 10;

type PaginationState = Record<string, number>;

function confirmAction(message: string) {
  return typeof window === "undefined" ? true : window.confirm(message);
}

function getCurrentPage(pagination: PaginationState, key: string) {
  return Math.max(1, Number(pagination[key] || 1));
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

export function BackupExecutionMigrationPage() {
  const en = isEnglish();
  const pathname = typeof window === "undefined" ? "/admin/system/backup" : window.location.pathname;
  const initialPayload = useMemo(() => readBootstrappedBackupConfigPageData(), []);
  const pageState = useAsyncValue<BackupConfigPagePayload>(() => fetchBackupConfigPage(pathname), [pathname], {
    initialValue: initialPayload,
    skipInitialLoad: Boolean(initialPayload)
  });
  const page = pageState.value;
  
  const form = (page?.backupConfigForm || {}) as Record<string, string>;
  const executions = (page?.backupExecutionRows || []) as Array<Record<string, string>>;
  const currentJob = (page?.backupCurrentJob || null) as Record<string, unknown> | null;
  const backupJobActive = String(currentJob?.status || "") === "QUEUED" || String(currentJob?.status || "") === "RUNNING";

  const [message, setMessage] = useState("");
  const [runningDbBackup, setRunningDbBackup] = useState(false);
  const [runningGitExecution, setRunningGitExecution] = useState<"" | "PRECHECK" | "CLEANUP" | "BUNDLE" | "COMMIT_BASE" | "BASE" | "PUSH" | "TAG">("");
  const [pagination, setPagination] = useState<PaginationState>({});

  useEffect(() => {
    const status = String(currentJob?.status || "");
    if (!status || (status !== "QUEUED" && status !== "RUNNING") || pageState.error) {
      setRunningGitExecution("");
      setRunningDbBackup(false);
    }
  }, [currentJob, pageState.error]);

  useEffect(() => {
    if (backupJobActive) {
      const timer = window.setInterval(async () => {
        try {
          const next = await fetchBackupConfigPage(pathname);
          pageState.setValue(next);
        } catch {
          // Ignore polling errors
        }
      }, 2000);
      return () => window.clearInterval(timer);
    }
  }, [backupJobActive, pageState, pathname]);

  const executionPage = paginateRows(executions, pagination, "execution", TABLE_PAGE_SIZE);

  const handleRunDbBackup = async () => {
    if (!confirmAction(en ? "Run the database backup now?" : "지금 DB 백업을 실행하시겠습니까?")) {
      return;
    }
    setRunningDbBackup(true);
    setMessage("");
    try {
      const nextPage = await runBackupExecution("DB");
      pageState.setValue(nextPage);
      setMessage(String(nextPage.backupConfigMessage || (en ? "Database backup started." : "DB 백업이 시작되었습니다.")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Database backup failed." : "DB 백업 실행 중 오류가 발생했습니다."));
      setRunningDbBackup(false);
    }
  };

  const handleRunGitExecution = async (kind: "PRECHECK" | "CLEANUP" | "BUNDLE" | "COMMIT_BASE" | "BASE" | "PUSH" | "TAG") => {
    setRunningGitExecution(kind);
    setMessage("");
    try {
      const executionType = kind === "BUNDLE" ? "GIT_BUNDLE" : kind === "PRECHECK" ? "GIT_PRECHECK" : kind === "CLEANUP" ? "GIT_CLEANUP_SAFE" : kind === "COMMIT_BASE" ? "GIT_COMMIT_AND_PUSH_BASE" : kind === "BASE" ? "GIT_PUSH_BASE" : kind === "PUSH" ? "GIT_PUSH_RESTORE" : "GIT_TAG_PUSH";
      const nextPage = await runBackupExecution(executionType);
      pageState.setValue(nextPage);
      setMessage(String(nextPage.backupConfigMessage || (en ? "Git operation started." : "Git 작업이 시작되었습니다.")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Git operation failed." : "Git 작업 중 오류가 발생했습니다."));
      setRunningGitExecution("");
    }
  };

  return (
    <AdminPageShell
      title={en ? "Backup Execution" : "백업 실행"}
      subtitle={en ? "Monitor live backup jobs, review execution history, and run source/database backup actions." : "실시간 백업 작업을 모니터링하고, 실행 이력을 검토하며 소스/DB 백업을 실행합니다."}
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Backup" : "백업" },
        { label: en ? "Execution" : "실행" }
      ]}
    >
      {message && <PageStatusNotice tone={message.includes("오류") || message.includes("failed") ? "error" : "success"}>{message}</PageStatusNotice>}
      <AdminWorkspacePageFrame>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
          <BinaryStatusCard
            title={en ? "Execution Authority" : "실행 권한"}
            healthy={Boolean(page?.canUseBackupExecution)}
            healthyLabel={en ? "Authorized" : "권한 있음"}
            unhealthyLabel={en ? "Unauthorized" : "권한 없음"}
          />
          <BinaryStatusCard
            title={en ? "Live Job Status" : "실시간 작업 상태"}
            healthy={!backupJobActive}
            healthyLabel={en ? "Idle" : "대기 중"}
            unhealthyLabel={en ? "Running" : "실행 중"}
          />
        </div>

        {currentJob && (
          <section className="gov-card mb-6 border-2 border-[var(--kr-gov-blue)]" data-help-id="backup-live-job">
            <div className="flex items-center justify-between border-b border-[var(--kr-gov-border-light)] px-6 py-4">
              <h3 className="text-lg font-bold text-[var(--kr-gov-blue)]">{en ? "Live Progress: " : "실시간 진행 상태: "}{stringOf(currentJob as Record<string, string>, "profileName")}</h3>
              <span className="rounded-full bg-[var(--kr-gov-blue)] px-3 py-1 text-xs font-black text-white uppercase">{stringOf(currentJob as Record<string, string>, "status")}</span>
            </div>
            <div className="bg-slate-950 p-6">
              <pre className="max-h-[400px] overflow-auto text-xs leading-6 text-emerald-400 font-mono">
                {((currentJob.logLines as string[]) || []).join("\n") || (en ? "Waiting for log stream..." : "로그 스트림 대기 중...")}
              </pre>
            </div>
            <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "Job started at: " : "작업 시작 시각: "}{stringOf(currentJob as Record<string, string>, "startedAt")}
              {String(currentJob.duration || "") && <span className="ml-4">{en ? "Duration: " : "소요 시간: "}{String(currentJob.duration || "")}</span>}
            </div>
          </section>
        )}

        <section className="gov-card mb-6">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <h3 className="text-lg font-bold">{en ? "Run Actions" : "실행 작업"}</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
              <DiagnosticCard
                title={en ? "Database Backup" : "데이터베이스 백업"}
                status={form.dbEnabled === "Y" ? (en ? "Enabled" : "활성화") : (en ? "Disabled" : "비활성화")}
                statusTone={form.dbEnabled === "Y" ? "healthy" : "neutral"}
                description={en ? `Target: ${form.dbName || "None"}` : `대상: ${form.dbName || "없음"}`}
                actions={
                  <MemberButton variant="primary" size="sm" disabled={backupJobActive || runningDbBackup || form.dbEnabled !== "Y"} onClick={handleRunDbBackup}>
                    {en ? "Run DB Backup" : "DB 백업 실행"}
                  </MemberButton>
                }
              />
              <DiagnosticCard
                title={en ? "Git Source Backup" : "Git 소스 백업"}
                status={form.gitEnabled === "Y" ? (en ? "Enabled" : "활성화") : (en ? "Disabled" : "비활성화")}
                statusTone={form.gitEnabled === "Y" ? "healthy" : "neutral"}
                description={en ? `Branch: ${form.gitBranchPattern || "None"}` : `브랜치: ${form.gitBranchPattern || "없음"}`}
                actions={
                  <div className="flex gap-2">
                    <MemberButton variant="secondary" size="sm" disabled={backupJobActive || !!runningGitExecution || form.gitEnabled !== "Y"} onClick={() => handleRunGitExecution("COMMIT_BASE")}>
                      {en ? "Commit & Push" : "커밋 및 Push"}
                    </MemberButton>
                  </div>
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <MemberButton variant="secondary" disabled={backupJobActive || !!runningGitExecution} onClick={() => handleRunGitExecution("PRECHECK")}>{en ? "Git Precheck" : "Git 사전 점검"}</MemberButton>
              <MemberButton variant="secondary" disabled={backupJobActive || !!runningGitExecution} onClick={() => handleRunGitExecution("CLEANUP")}>{en ? "Artifact Cleanup" : "산출물 정리"}</MemberButton>
              <MemberButton variant="secondary" disabled={backupJobActive || !!runningGitExecution} onClick={() => handleRunGitExecution("BUNDLE")}>{en ? "Git Bundle" : "Git 번들 생성"}</MemberButton>
              <MemberButton variant="secondary" disabled={backupJobActive || !!runningGitExecution} onClick={() => handleRunGitExecution("TAG")}>{en ? "Push Tag" : "태그 생성 및 Push"}</MemberButton>
            </div>
          </div>
        </section>

        <section className="gov-card p-0 overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-[var(--kr-gov-border-light)] flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">{en ? "Execution History" : "실행 이력"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Recent backup activity and registration proof." : "최근 백업 활동 및 등록 증적입니다."}</p>
            </div>
            <MemberLinkButton href={buildLocalizedPath("/admin/system/backup_config", "/en/admin/system/backup_config")} variant="secondary" size="sm">
              {en ? "Configure Settings" : "설정 관리"}
            </MemberLinkButton>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Executed At" : "실행 시각"}</th>
                  <th className="px-4 py-3">{en ? "Type" : "유형"}</th>
                  <th className="px-4 py-3">{en ? "Result" : "결과"}</th>
                  <th className="px-4 py-3">{en ? "Duration" : "소요 시간"}</th>
                  <th className="px-4 py-3">{en ? "Artifact Proof" : "산출물 증적"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {executionPage.rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3">{stringOf(row, "executedAt")}</td>
                    <td className="px-4 py-3 font-bold">{stringOf(row, "profileName")}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stringOf(row, "result") === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {stringOf(row, "result")}
                      </span>
                    </td>
                    <td className="px-4 py-3">{stringOf(row, "duration")}</td>
                    <td className="px-4 py-3 font-mono text-xs">{stringOf(row, "note")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {executionPage.totalPages > 1 && (
            <MemberPagination className="border-t-0" currentPage={executionPage.currentPage} onPageChange={(p) => setPagination(prev => ({ ...prev, execution: p }))} totalPages={executionPage.totalPages} />
          )}
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
