import { useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { analyzeDbSyncDeploy, executeDbSyncDeploy, fetchDbSyncDeployPage, validateDbSyncDeployPolicy } from "../../lib/api/ops";
import type { DbSyncDeployPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { MemberButton } from "../admin-ui/common";
import { KeyValueGridPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminSelect } from "../member/common";

const REQUIRED_FEATURES = [
  "A0060406_VIEW",
  "A0060406_ANALYZE",
  "A0060406_VALIDATE",
  "A0060406_EXECUTE",
  "A0060406_BREAKGLASS"
];

const SUMMARY_CARDS = {
  ko: [
    { title: "실행 소스", value: "page | queue | breakglass", description: "raw shell 실행을 기본 경로로 두지 않는 계약입니다." },
    { title: "필수 증적", value: "backup + diff + freshness", description: "사전 백업, 정책 검증, fresh deploy 증적이 모두 있어야 합니다." },
    { title: "정책 기준", value: "DB_CHANGE_PROMOTION_POLICY", description: "영향 테이블마다 반영 정책과 사유가 준비되어 있어야 합니다." },
    { title: "스크립트 대상", value: "221 fresh deploy", description: "windows-db-sync-push-and-fresh-deploy-221.sh 를 중앙 화면 뒤 실행기로 감쌉니다." }
  ],
  en: [
    { title: "Execution Source", value: "page | queue | breakglass", description: "Raw shell use is no longer the default operator path." },
    { title: "Required Evidence", value: "backup + diff + freshness", description: "Pre-backup, policy verification, and fresh deploy proof must all exist." },
    { title: "Policy Basis", value: "DB_CHANGE_PROMOTION_POLICY", description: "Every impacted table needs an active promotion policy and rationale." },
    { title: "Script Target", value: "221 fresh deploy", description: "This page wraps windows-db-sync-push-and-fresh-deploy-221.sh as a governed runner." }
  ]
} as const;

const PREFLIGHT_ITEMS = {
  ko: [
    "영향 테이블에 활성 정책 행이 있는지 확인",
    "DB_PATCH_HISTORY 기록이 비활성화되지 않았는지 확인",
    "destructive diff 여부와 승인 티켓 존재 여부 확인",
    "releaseUnitId 또는 승인된 배포 컨텍스트가 있는지 확인",
    "freshness verify 경로가 build/package/restart/proof 순서를 따르는지 확인"
  ],
  en: [
    "Confirm that every impacted table has an active policy row",
    "Confirm that DB_PATCH_HISTORY recording is not disabled",
    "Check destructive diff presence and matching approval ticket",
    "Confirm that releaseUnitId or approved deploy context exists",
    "Confirm that freshness verification follows build/package/restart/proof order"
  ]
} as const;

const BREAKGLASS_ITEMS = {
  ko: [
    "EXECUTION_SOURCE=breakglass 가 명시되어야 합니다.",
    "BREAKGLASS_REASON 과 BREAKGLASS_APPROVER 가 모두 있어야 합니다.",
    "실행 전 감사 로그와 사유를 먼저 남겨야 합니다.",
    "일반 운영 경로에서는 breakglass 기능을 노출하지 않습니다."
  ],
  en: [
    "EXECUTION_SOURCE=breakglass must be explicit.",
    "BREAKGLASS_REASON and BREAKGLASS_APPROVER must both exist.",
    "Audit evidence and rationale must be recorded before execution.",
    "The normal operator path must not expose breakglass by default."
  ]
} as const;

const SCRIPT_CHAIN = {
  ko: [
    ["1. Local snapshot", "로컬 DB 스냅샷과 백업 런 스탬프를 먼저 확보합니다."],
    ["2. Remote snapshot", "원격 DB 사전 스냅샷을 확보합니다."],
    ["3. Diff and policy", "schema diff 와 정책 테이블을 대조해 위험도를 계산합니다."],
    ["4. Apply and push", "허용된 SQL 과 git push, 원격 배포 단계를 실행합니다."],
    ["5. Freshness proof", "원격 runtime/jar/freshness 검증 결과를 증적으로 남깁니다."]
  ],
  en: [
    ["1. Local snapshot", "Capture the local DB snapshot and backup run stamp first."],
    ["2. Remote snapshot", "Capture the remote pre-apply DB snapshot."],
    ["3. Diff and policy", "Compare schema diff output with promotion-policy rows and calculate risk."],
    ["4. Apply and push", "Run approved SQL apply, git push, and remote deploy steps."],
    ["5. Freshness proof", "Record remote runtime, jar, and freshness verification evidence."]
  ]
} as const;

export function DbSyncDeployMigrationPage() {
  const en = isEnglish();
  const copy = en ? "en" : "ko";
  const pageState = useAsyncValue<DbSyncDeployPagePayload>(fetchDbSyncDeployPage, []);
  const page = pageState.value;
  const [message, setMessage] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Governed production deploy state
  const [ticketNumber, setTicketNumber] = useState("");
  const [approver, setApprover] = useState("");
  const [executionSource, setExecutionSource] = useState("page");

  const summaryCards = (page?.dbSyncDeploySummary as Array<Record<string, string>> | undefined) || SUMMARY_CARDS[copy];
  const guardrails = (page?.dbSyncDeployGuardrailRows as Array<Record<string, string>> | undefined) || [];
  const executionContract = (page?.dbSyncDeployExecutionContractRows as Array<Record<string, string>> | undefined) || [];
  const policyValidationRows = (page?.dbSyncDeployPolicyValidationRows as Array<Record<string, string>> | undefined) || [];
  const scriptChain = (page?.dbSyncDeployScriptChainRows as Array<Record<string, string>> | undefined) || [];
  const sqlFiles = (page?.dbSyncDeploySqlFileRows as Array<Record<string, string>> | undefined) || [];
  const guidance = (page?.dbSyncDeployGuidance as Array<Record<string, string>> | undefined) || [];
  const executionRows = (page?.dbSyncDeployExecutionRows as Array<Record<string, string>> | undefined) || [];
  const executionLogRows = (page?.dbSyncDeployExecutionLogRows as Array<Record<string, string>> | undefined) || [];
  const historyRows = (page?.dbSyncDeployHistoryRows as Array<Record<string, string>> | undefined) || [];

  logGovernanceScope("PAGE", "db-sync-deploy", {
    language: copy,
    requiredFeatureCount: REQUIRED_FEATURES.length,
    executionSources: ["page", "queue", "breakglass"],
    scriptPath: page?.dbSyncDeployScriptPath || "",
    guardrailCount: guardrails.length
  });

  async function handleAnalyze() {
    setAnalyzing(true);
    setMessage("");
    try {
      const payload = await analyzeDbSyncDeploy();
      pageState.setValue(payload);
      setMessage(String(payload.dbSyncDeployAnalyzeMessage || (en ? "Analyze completed." : "사전 점검을 완료했습니다.")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Analyze failed." : "사전 점검에 실패했습니다."));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleValidatePolicy() {
    setValidating(true);
    setMessage("");
    try {
      const payload = await validateDbSyncDeployPolicy();
      pageState.setValue(payload);
      setMessage(String(payload.dbSyncDeployValidateMessage || (en ? "Policy validation completed." : "정책 검증을 완료했습니다.")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Policy validation failed." : "정책 검증에 실패했습니다."));
    } finally {
      setValidating(false);
    }
  }

  async function handleExecute() {
    setExecuting(true);
    setMessage("");
    try {
      const payload = await executeDbSyncDeploy({
        executionMode: "SERVER_UP_TEST",
        targetRoute: "/admin/system/version?projectId=carbonet"
      });
      pageState.setValue(payload);
      setMessage(String(payload.dbSyncDeployExecuteMessage || (en ? "Server-up test completed." : "서버 올리기 테스트를 완료했습니다.")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Server-up test failed." : "서버 올리기 테스트에 실패했습니다."));
    } finally {
      setExecuting(false);
    }
  }

  async function handleProductionDeploy() {
    if (executionSource === "breakglass" && (!ticketNumber || !approver)) {
      setMessage(en ? "Ticket Number and Approver are required for breakglass deploy." : "Breakglass 배포 시 티켓 번호와 승인자를 반드시 입력해야 합니다.");
      return;
    }
    if (!window.confirm(en ? "Are you sure you want to execute real DB sync and production deploy?" : "운영 DB 동기화 및 배포를 실제 실행하시겠습니까? 이 작업은 데이터를 변경하고 서버를 재기동합니다.")) {
      return;
    }
    setExecuting(true);
    setMessage("");
    try {
      const payload = await executeDbSyncDeploy({
        executionMode: "PRODUCTION_SYNC",
        executionSource,
        ticketNumber,
        approver
      });
      pageState.setValue(payload);
      setMessage(String(payload.dbSyncDeployExecuteMessage || (en ? "Production Deploy and DB Sync completed." : "운영 DB 동기화 및 배포를 성공적으로 완료했습니다.")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Production deploy failed." : "운영 배포에 실패했습니다."));
    } finally {
      setExecuting(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Backup" : "백업" },
        { label: en ? "DB Sync Deploy" : "DB 동기화 배포" }
      ]}
      title={en ? "DB Sync Deploy" : "DB 동기화 배포"}
      subtitle={en
        ? "Preflight and govern high-risk DB sync plus fresh deploy work before the real runner is exposed."
        : "고위험 DB 동기화와 fresh deploy 작업을 실제 실행기 노출 전에 중앙 가드레일 아래에서 사전 점검합니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        {message ? <PageStatusNotice tone="info">{message}</PageStatusNotice> : null}
        <PageStatusNotice tone="info">
          {en
            ? "This page keeps the risky shell flow behind governed actions. Analyze reads the live script contract, and Server-Up Test proves build/restart/freshness plus exact-route response on :18000."
            : "이 화면은 위험한 셸 흐름을 중앙 액션 뒤로 숨깁니다. Analyze 는 live 스크립트 계약을 읽고, 서버 올리기 테스트는 :18000에서 build/restart/freshness와 정확한 라우트 응답까지 증명합니다."}
        </PageStatusNotice>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="db-sync-deploy-scope">
          {summaryCards.map((card) => (
            <SummaryMetricCard key={card.title} title={card.title} value={card.value} description={card.description} />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="gov-card" data-help-id="db-sync-deploy-policy">
            <div className="mb-4">
              <h3 className="text-lg font-bold">{en ? "Preflight Guardrail" : "사전 점검 가드레일"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "The page must refuse execution until these checks are green."
                  : "이 화면은 아래 조건이 녹색이 되기 전까지 실행을 허용하지 않아야 합니다."}
              </p>
            </div>
            <div className="mb-4 flex justify-end gap-2">
              <MemberButton type="button" variant="secondary" onClick={() => void handleExecute()} disabled={executing || analyzing || validating}>
                {executing ? (en ? "Testing..." : "테스트 중...") : (en ? "Server-Up Test" : "서버 올리기 테스트")}
              </MemberButton>
              <MemberButton type="button" variant="secondary" onClick={() => void handleValidatePolicy()} disabled={validating || analyzing || executing}>
                {validating ? (en ? "Validating..." : "검증 중...") : (en ? "Validate Policy" : "정책 검증")}
              </MemberButton>
              <MemberButton type="button" variant="primary" onClick={() => void handleAnalyze()} disabled={analyzing || validating}>
                {analyzing ? (en ? "Analyzing..." : "점검 중...") : (en ? "Run Analyze" : "사전 점검 실행")}
              </MemberButton>
            </div>
            <ul className="space-y-3 text-sm text-[var(--kr-gov-text-primary)]">
              {(guardrails.length ? guardrails.map((row) => `${row.title}||${row.statusLabel}||${row.description}`) : PREFLIGHT_ITEMS[copy].map((item) => `${item}||||`)).map((item) => {
                const [title, statusLabel, description] = item.split("||");
                return (
                  <li key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold">{title}</div>
                      {statusLabel ? <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusLabel === "PASS" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{statusLabel}</span> : null}
                    </div>
                    {description ? <p className="mt-2 text-[13px] text-[var(--kr-gov-text-secondary)]">{description}</p> : null}
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="gov-card" data-help-id="db-sync-deploy-breakglass">
            <div className="mb-4">
              <h3 className="text-lg font-bold">{en ? "Breakglass Policy" : "긴급 우회 정책"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Breakglass stays exceptional and must remain auditable."
                  : "breakglass 는 예외 경로로만 남기고 반드시 감사 가능해야 합니다."}
              </p>
            </div>
            <ul className="space-y-3 text-sm text-[var(--kr-gov-text-primary)]">
              {BREAKGLASS_ITEMS[copy].map((item) => (
                <li key={item} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="gov-card mb-6 mt-6 p-0 overflow-hidden" data-help-id="db-sync-deploy-execution">
          <div className="border-b border-rose-200 bg-rose-50 px-6 py-5">
            <h3 className="text-lg font-bold text-rose-900">{en ? "Governed Production Deploy" : "운영 환경 배포 및 DB 동기화"}</h3>
            <p className="mt-1 text-sm text-rose-800">{en ? "Execute real production deploy. All preflight checks must pass unless breakglass is used." : "실제 운영 환경에 배포합니다. 긴급 우회(breakglass)를 제외하고는 모든 사전 점검을 통과해야 합니다."}</p>
          </div>
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700">{en ? "Execution Source" : "실행 소스"}</span>
                <AdminSelect value={executionSource} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setExecutionSource(e.target.value)}>
                  <option value="page">PAGE (Normal)</option>
                  <option value="queue">QUEUE (Scheduled)</option>
                  <option value="breakglass">BREAKGLASS (Emergency)</option>
                </AdminSelect>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700">{en ? "Ticket Number" : "티켓 번호"}</span>
                <input type="text" className="gov-input" placeholder="e.g. DEPLOY-2026-001" value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} disabled={executionSource !== "breakglass" && executionSource !== "page"} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700">{en ? "Approver" : "승인자"}</span>
                <input type="text" className="gov-input" placeholder={en ? "e.g. Lead Engineer" : "예: 배포 책임자"} value={approver} onChange={(e) => setApprover(e.target.value)} disabled={executionSource !== "breakglass" && executionSource !== "page"} />
              </label>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <span className="text-xs text-rose-600 font-bold mr-2">
                {en ? "Warning: This action mutates the production database and restarts the application." : "경고: 이 작업은 운영 DB를 변경하고 애플리케이션을 재기동합니다."}
              </span>
              <MemberButton type="button" variant="primary" onClick={() => void handleProductionDeploy()} disabled={executing || analyzing || validating}>
                {executing ? (en ? "Deploying..." : "배포 중...") : (en ? "Execute Production Deploy" : "운영 배포 실행")}
              </MemberButton>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div data-help-id="db-sync-deploy-permission-contract">
            <KeyValueGridPanel
              title={en ? "Permission Contract" : "권한 계약"}
              items={(executionContract.length ? executionContract : REQUIRED_FEATURES.map((feature) => ({
                label: feature,
                value: feature
              }))).map((row) => ({
                label: row.label,
                value: (
                  <div>
                    <div>{row.value}</div>
                    {"description" in row && row.description ? <div className="mt-1 text-[13px] text-[var(--kr-gov-text-secondary)]">{row.description}</div> : null}
                  </div>
                )
              }))}
            />
          </div>
          <article className="gov-card" data-help-id="db-sync-deploy-script-chain">
            <div className="mb-4">
              <h3 className="text-lg font-bold">{en ? "Script Chain" : "스크립트 체인"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "The existing shell flow remains valid, but the page becomes the governing surface."
                  : "기존 셸 흐름은 유지하되, 화면이 그것을 감싸는 거버넌스 표면이 됩니다."}
              </p>
            </div>
            <div className="space-y-3">
              {(scriptChain.length ? scriptChain : SCRIPT_CHAIN[copy].map(([title, description], index) => ({ step: String(index + 1), title, description }))).map((row) => (
                <div key={`${row.step}-${row.title}`} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{row.step}. {row.title}</div>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{row.description}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]" data-help-id="db-sync-deploy-evidence">
          <KeyValueGridPanel
            title={en ? "Execution Proof" : "실행 증적"}
            items={(executionRows.length ? executionRows : [
              {
                label: en ? "Status" : "상태",
                value: en ? "No execution yet" : "아직 실행하지 않음"
              },
              {
                label: en ? "Target Route" : "대상 라우트",
                value: "/admin/system/version?projectId=carbonet"
              }
            ]).map((row) => ({
              label: row.label,
              value: (
                <div>
                  <div>{row.value}</div>
                  {"description" in row && row.description ? <div className="mt-1 text-[13px] text-[var(--kr-gov-text-secondary)]">{row.description}</div> : null}
                </div>
              )
            }))}
          />

          <article className="gov-card" data-help-id="db-sync-deploy-policy-validation">
            <div className="mb-4">
              <h3 className="text-lg font-bold">{en ? "Policy Validation" : "정책 검증"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Validate-policy is separate from analyze so operators can see which execution preconditions still block real deploy."
                  : "validate-policy는 analyze와 분리되어 실제 배포 실행을 막는 사전 조건을 운영자가 별도로 확인할 수 있습니다."}
              </p>
            </div>
            <div className="space-y-3">
              {(policyValidationRows.length ? policyValidationRows : [
                {
                  title: en ? "Validation Not Run" : "검증 미실행",
                  statusLabel: en ? "PENDING" : "대기",
                  description: en ? "Run Validate Policy before enabling real DB sync deploy execution." : "실제 DB 동기화 배포 실행을 열기 전에 정책 검증을 실행해야 합니다."
                }
              ]).map((row) => (
                <div key={`${row.title}-${row.statusLabel}`} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{row.title}</div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${row.statusCode === "PASS" ? "bg-emerald-100 text-emerald-700" : row.statusCode === "BLOCKED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                      {row.statusLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{row.description}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
          <article className="gov-card" data-help-id="db-sync-deploy-history">
            <div className="mb-4">
              <h3 className="text-lg font-bold">{en ? "Execution History" : "실행 이력"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Latest governed runs are read from the local evidence ledger."
                  : "최근 중앙 실행 이력은 로컬 증적 원장에서 읽어옵니다."}
              </p>
            </div>
            <div className="space-y-3">
              {historyRows.length ? historyRows.map((row) => (
                <div key={row.runId} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{row.runId}</div>
                      <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{row.executedAt} / {row.actorId}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${row.result === "PASS" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {row.result}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{row.executionMode} / {row.targetRoute} / route {row.routeStatus} / shell {row.shellStatus}</p>
                </div>
              )) : (
                <PageStatusNotice tone="info">
                  {en ? "No governed execution history has been recorded yet." : "아직 기록된 중앙 실행 이력이 없습니다."}
                </PageStatusNotice>
              )}
            </div>
          </article>

          <article className="gov-card">
            <div className="mb-4">
              <h3 className="text-lg font-bold">{en ? "Default SQL Set" : "기본 SQL 세트"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {page?.dbSyncDeployScriptPath
                  ? `${en ? "Resolved from" : "기준 스크립트"} ${page.dbSyncDeployScriptPath}`
                  : (en ? "Resolved from the live script default list." : "실제 스크립트 기본 목록에서 해석했습니다.")}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-[13px] font-semibold text-[var(--kr-gov-text-secondary)]">
                  <tr>
                    <th className="px-4 py-3">{en ? "Path" : "경로"}</th>
                    <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                    <th className="px-4 py-3">{en ? "Size" : "크기"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sqlFiles.map((row) => (
                    <tr key={row.path}>
                      <td className="px-4 py-3 font-mono text-[13px]">{row.path}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${row.statusCode === "PRESENT" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="gov-card">
            <div className="mb-4">
              <h3 className="text-lg font-bold">{en ? "Operator Notes" : "운영 메모"}</h3>
            </div>
            <div className="space-y-3">
              {guidance.map((row) => (
                <div key={row.title} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{row.title}</div>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{row.body}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <article className="gov-card">
          <div className="mb-4">
            <h3 className="text-lg font-bold">{en ? "Execution Logs" : "실행 로그"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Latest server-up test output captured from the governed runner steps."
                : "중앙 실행기 단계에서 캡처한 최신 서버 올리기 테스트 출력입니다."}
            </p>
          </div>
          <div className="space-y-3">
            {executionLogRows.length ? executionLogRows.map((row) => (
              <div key={row.step} className="rounded-2xl border border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{row.step}</div>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${row.exitCode === "0" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    exit {row.exitCode}
                  </span>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 px-3 py-3 text-[12px] leading-5 text-slate-100">{row.preview || "-"}</pre>
              </div>
            )) : (
              <PageStatusNotice tone="info">
                {en ? "Run Server-Up Test to capture restart and route-proof logs." : "서버 올리기 테스트를 실행하면 재기동 및 라우트 증적 로그가 여기에 표시됩니다."}
              </PageStatusNotice>
            )}
          </div>
        </article>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
