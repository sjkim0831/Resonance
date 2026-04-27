import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import verificationCenterInventory from "../../generated/verificationCenterInventory.json";
import { fetchVerificationCenterPage, runVerificationCenterCheck, resolveVerificationAction } from "../../lib/api/platform";
import type { VerificationCenterPagePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import {
  buildAssetInventoryPath,
  buildHelpManagementPath,
  buildObservabilityPath,
  buildVerificationAssetsPath,
  buildVerificationCenterPath
} from "../../platform/routes/platformPaths";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, DiagnosticCard, GridToolbar, KeyValueGridPanel, MemberButton, MemberLinkButton, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type BaselinePack = {
  key: string;
  titleKo: string;
  titleEn: string;
  status: "READY" | "PARTIAL" | "PLANNED";
  ownerKo: string;
  ownerEn: string;
  baselineKo: string[];
  baselineEn: string[];
  links: Array<{ labelKo: string; labelEn: string; href: string }>;
};

type RunItem = {
  scopeKo: string;
  scopeEn: string;
  cadenceKo: string;
  cadenceEn: string;
  result: "PASS" | "WARN" | "TODO";
  evidenceKo: string;
  evidenceEn: string;
};

type RiskInventoryItem = {
  pageId?: string;
  routePath?: string;
  menuCode?: string;
  routePrefix?: string;
  action?: string;
  controllerClass?: string;
  serviceMethod?: string;
  riskTags: string[];
  requiredProfiles: string[];
};

type GovernedTestProfile = {
  profileId: string;
  type: string;
  title: string;
  appliesTo: string[];
  requiresExpiryTracking: boolean;
  notes: string;
};

type BaselineRegistryItem = {
  pageId: string;
  routePath: string;
  baselineId: string;
  snapshotPath: string;
  owner: string;
  lastVerifiedAt: string;
  stale: boolean;
  requiredScenarioIds: string[];
};

type VerificationRunHistoryItem = {
  runId: string;
  runType: string;
  targetScope: string;
  baselineId: string;
  result: "PASS" | "WARN" | "TODO";
  startedAt: string;
  finishedAt: string;
  traceId: string;
  profileId: string;
  datasetId: string;
  failureCount: number;
  driftCount: number;
  followupPath: string;
};

type ManagedVaultAccount = {
  profileId: string;
  role: string;
  status: string;
  expiresAt: string;
  resetOwner: string;
  allowedRoutes: string[];
};

type ManagedVaultDataset = {
  datasetId: string;
  type: string;
  status: string;
  lastRefreshedAt: string;
  retentionPolicy: string;
  maskingPolicy: string;
};

type ActionQueueItem = {
  actionId: string;
  severity: string;
  category: string;
  title: string;
  owner: string;
  targetId: string;
  recommendedAction: string;
};

type VerificationInventorySummary = {
  pageCount: number;
  apiCount: number;
  uniqueRouteCount: number;
  functionCount: number;
  uniqueFunctionCount: number;
  frontendE2eCount: number;
  backendTestCount: number;
  highRiskPageCount: number;
  highRiskApiCount: number;
  governedTestProfileCount: number;
};

type VerificationInventoryPage = {
  pageId: string;
  routePath?: string;
  menuCode?: string;
};

type VerificationInventoryApi = {
  routePrefix?: string;
  action?: string;
  controllerClass?: string;
  serviceMethod?: string;
};

type VerificationInventoryFunction = {
  frontendFunction?: string;
  screenId?: string;
  eventType?: string;
  apiOrRoute?: string;
};

type VerificationCenterInventory = Omit<VerificationCenterPagePayload, "actionQueue" | "baselineRegistry" | "managedVault" | "quickActions" | "summary" | "verificationRuns"> & {
  summary: VerificationInventorySummary;
  pages: VerificationInventoryPage[];
  apis: VerificationInventoryApi[];
  functions: VerificationInventoryFunction[];
  sources: Record<string, string>;
  tests: {
    frontendE2e: string[];
    backend: string[];
  };
  highRisk?: {
    pages?: RiskInventoryItem[];
    apis?: RiskInventoryItem[];
  };
  testProfiles?: GovernedTestProfile[];
  baselineRegistry?: BaselineRegistryItem[];
  verificationRuns?: VerificationRunHistoryItem[];
  managedVault?: {
    accounts?: ManagedVaultAccount[];
    datasets?: ManagedVaultDataset[];
  };
  actionQueue?: ActionQueueItem[];
  quickActions?: Array<{ actionType: string; label: string; description: string }>;
};

function statusTone(status: BaselinePack["status"]) {
  if (status === "READY") return "healthy" as const;
  if (status === "PARTIAL") return "warning" as const;
  return "neutral" as const;
}

function statusLabel(status: BaselinePack["status"], en: boolean) {
  if (status === "READY") return en ? "Ready" : "준비";
  if (status === "PARTIAL") return en ? "Partial" : "부분";
  return en ? "Planned" : "계획";
}

function renderInventoryRows(items: string[]) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-3 py-2 text-xs text-[var(--kr-gov-text-secondary)]" key={item}>
          {item}
        </div>
      ))}
    </div>
  );
}

export function VerificationCenterMigrationPage() {
  const en = isEnglish();
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [runningActionType, setRunningActionType] = useState("");
  const verificationCenterQuery = useAsyncValue(fetchVerificationCenterPage, [], {
    initialValue: verificationCenterInventory
  });
  const inventory = {
    ...verificationCenterInventory,
    ...(verificationCenterQuery.value || {})
  } as VerificationCenterInventory;

  const baselinePacks = useMemo<BaselinePack[]>(() => [
    {
      key: "baseline-vault",
      titleKo: "기준선 백업 보관함",
      titleEn: "Baseline Backup Vault",
      status: "PARTIAL",
      ownerKo: "운영 검증 센터 / 백업 설정",
      ownerEn: "Verification Center / Backup Config",
      baselineKo: [
        "페이지별 baseline snapshot 보관 경로",
        "기준선 생성일, 마지막 검증일, stale 여부",
        "compare / rollback과 연결되는 증적 식별자",
        "변경 전 복구 가능한 baseline 묶음 유지"
      ],
      baselineEn: [
        "Per-page baseline snapshot retention path",
        "Created-at, last-verified-at, and stale state",
        "Evidence id linked to compare and rollback",
        "Preserve recoverable baseline bundles before change"
      ],
      links: [
        { labelKo: "백업 설정", labelEn: "Backup Config", href: buildLocalizedPath("/admin/system/backup_config", "/en/admin/system/backup_config") },
        { labelKo: "런타임 비교", labelEn: "Runtime Compare", href: buildLocalizedPath("/admin/system/current-runtime-compare", "/en/admin/system/current-runtime-compare") }
      ]
    },
    {
      key: "runtime-baseline",
      titleKo: "페이지 기준선 묶음",
      titleEn: "Page Baseline Packs",
      status: "PARTIAL",
      ownerKo: "환경 관리 / 자산 인벤토리",
      ownerEn: "Environment Management / Asset Inventory",
      baselineKo: [
        "route 응답 상태와 redirect 기준",
        "screen-command 메타데이터 응답",
        "핵심 버튼, 조회, 저장 경로별 smoke 목록",
        "변경 전후 비교용 baseline snapshot"
      ],
      baselineEn: [
        "Route response state and redirect baseline",
        "Screen-command metadata response",
        "Per-page smoke list for key button, query, and save paths",
        "Baseline snapshot for before/after comparison"
      ],
      links: [
        { labelKo: "환경 관리", labelEn: "Environment", href: buildLocalizedPath("/admin/system/environment-management", "/en/admin/system/environment-management") },
        { labelKo: "런타임 비교", labelEn: "Runtime Compare", href: buildLocalizedPath("/admin/system/current-runtime-compare", "/en/admin/system/current-runtime-compare") }
      ]
    },
    {
      key: "test-accounts",
      titleKo: "테스트 계정 / 데이터 팩",
      titleEn: "Test Accounts / Data Packs",
      status: "PLANNED",
      ownerKo: "보안 정책 / 운영 표준",
      ownerEn: "Security Policy / Ops Standard",
      baselineKo: [
        "역할별 기본 테스트 계정 보관",
        "검증용 seed 데이터 세트 식별자 관리",
        "만료일, 잠금, 재발급, masking 규칙 추적",
        "실행 가능한 smoke 시나리오와 계정 연결"
      ],
      baselineEn: [
        "Keep default test accounts by role",
        "Manage identifiers for verification seed datasets",
        "Track expiration, lock, reissue, and masking rules",
        "Bind executable smoke scenarios to those accounts"
      ],
      links: [
        { labelKo: "보안 정책", labelEn: "Security Policy", href: buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy") },
        { labelKo: "통합 로그", labelEn: "Unified Log", href: buildLocalizedPath("/admin/system/unified_log", "/en/admin/system/unified_log") }
      ]
    },
    {
      key: "automation-runs",
      titleKo: "자동 점검 실행",
      titleEn: "Automated Verification Runs",
      status: "PARTIAL",
      ownerKo: "배치 / 런타임 운영",
      ownerEn: "Batch / Runtime Operations",
      baselineKo: [
        "일회성 manual run",
        "주기성 sweep run",
        "배포 직후 smoke run",
        "실패 시 compare / repair / observability 연결"
      ],
      baselineEn: [
        "One-off manual run",
        "Scheduled sweep run",
        "Post-deploy smoke run",
        "On failure, continue into compare / repair / observability"
      ],
      links: [
        { labelKo: "리페어 워크벤치", labelEn: "Repair Workbench", href: buildLocalizedPath("/admin/system/repair-workbench", "/en/admin/system/repair-workbench") },
        { labelKo: "추적 조회", labelEn: "Observability", href: buildObservabilityPath({ pageId: "verification-center" }) }
      ]
    },
    {
      key: "governed-logs",
      titleKo: "검증 로그 / 증거",
      titleEn: "Verification Logs / Evidence",
      status: "READY",
      ownerKo: "Observability / Audit",
      ownerEn: "Observability / Audit",
      baselineKo: [
        "누가 어떤 기준선으로 실행했는지",
        "어떤 페이지와 기능이 실패했는지",
        "실패 후 어떤 traceId로 이어졌는지",
        "증거를 compare, repair, rollback과 연결"
      ],
      baselineEn: [
        "Who executed against which baseline",
        "Which pages and features failed",
        "Which traceId continued after failure",
        "Link evidence to compare, repair, and rollback"
      ],
      links: [
        { labelKo: "추적 조회", labelEn: "Observability", href: buildObservabilityPath({ pageId: "verification-center", actionCode: "VERIFICATION_RUN" }) },
        { labelKo: "도움말 운영", labelEn: "Help Management", href: buildHelpManagementPath() }
      ]
    }
  ], []);

  const runItems = useMemo<RunItem[]>(() => [
    {
      scopeKo: "기존 페이지 baseline 보존",
      scopeEn: "Preserve existing page baseline",
      cadenceKo: "작업 시작 전",
      cadenceEn: "Before each change",
      result: "PASS",
      evidenceKo: "route 302/200 응답, screen-command 메타, 주요 버튼/폼 체크",
      evidenceEn: "Route 302/200 response, screen-command metadata, key button/form checks"
    },
    {
      scopeKo: "변경 페이지 회귀 확인",
      scopeEn: "Regression check for changed pages",
      cadenceKo: "작업 직후",
      cadenceEn: "Immediately after change",
      result: "PASS",
      evidenceKo: "같은 경로 재호출, 동일 시나리오 smoke, drift 여부 확인",
      evidenceEn: "Re-hit same routes, rerun same smoke scenarios, confirm drift"
    },
    {
      scopeKo: "전체 운영 sweep",
      scopeEn: "Full operational sweep",
      cadenceKo: "일/주 단위",
      cadenceEn: "Daily / weekly",
      result: "WARN",
      evidenceKo: "현재는 콘솔 설계와 일부 수동 실행 중심",
      evidenceEn: "Currently console-guided with some manual execution"
    },
    {
      scopeKo: "테스트 계정/데이터 만료 관리",
      scopeEn: "Test account/data expiration management",
      cadenceKo: "주 단위",
      cadenceEn: "Weekly",
      result: "TODO",
      evidenceKo: "만료일, 잠금, 초기화 이력을 전용 테이블로 분리 필요",
      evidenceEn: "Need dedicated tables for expiry, lock, and reset history"
    },
    {
      scopeKo: "기준선 신선도 sweep",
      scopeEn: "Baseline freshness sweep",
      cadenceKo: "일 단위",
      cadenceEn: "Daily",
      result: "WARN",
      evidenceKo: "최근 변경 대비 stale baseline, 미실행 smoke, 미갱신 테스트 자산 탐지",
      evidenceEn: "Detect stale baselines, unrun smoke checks, and unrefreshed test assets against recent changes"
    }
  ], []);

  const readyCount = baselinePacks.filter((item) => item.status === "READY").length;
  const partialCount = baselinePacks.filter((item) => item.status === "PARTIAL").length;
  const plannedCount = baselinePacks.filter((item) => item.status === "PLANNED").length;
  const runPassCount = runItems.filter((item) => item.result === "PASS").length;
  const inventorySummary = inventory.summary;
  const normalizedPageCount = inventory.pages.filter((item) => item.menuCode && item.routePath).length;
  const unboundPageCount = inventory.pages.length - normalizedPageCount;
  const highRiskPages = (inventory.highRisk?.pages || []) as RiskInventoryItem[];
  const highRiskApis = (inventory.highRisk?.apis || []) as RiskInventoryItem[];
  const governedTestProfiles = (inventory.testProfiles || []) as GovernedTestProfile[];
  const baselineRegistry = (inventory.baselineRegistry || []) as BaselineRegistryItem[];
  const verificationRuns = (inventory.verificationRuns || []) as VerificationRunHistoryItem[];
  const vaultAccounts = (inventory.managedVault?.accounts || []) as ManagedVaultAccount[];
  const vaultDatasets = (inventory.managedVault?.datasets || []) as ManagedVaultDataset[];
  const actionQueue = (inventory.actionQueue || []) as ActionQueueItem[];
  const quickActions = inventory.quickActions || [];
  const serverGeneratedAt = String(inventory.serverGeneratedAt || "");
  const staleBaselineCount = partialCount + plannedCount;
  const scheduledSweepCount = runItems.filter((item) => item.cadenceKo.includes("일") || item.cadenceKo.includes("주")).length;
  const runWarnCount = runItems.filter((item) => item.result === "WARN" || item.result === "TODO").length;

  async function handleRunCheck(actionType: string) {
    try {
      setRunningActionType(actionType);
      setActionError("");
      const response = await runVerificationCenterCheck(actionType);
      setActionMessage(String(response.message || (en ? "Verification run queued." : "검증 실행을 등록했습니다.")));
      await verificationCenterQuery.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to run verification check." : "검증 실행에 실패했습니다."));
    } finally {
      setRunningActionType("");
    }
  }

  async function handleResolveAction(actionId: string) {
    if (!window.confirm(en ? "Are you sure you want to resolve this action?" : "이 조치 항목을 해제하시겠습니까?")) return;

    try {
      setRunningActionType(actionId);
      setActionError("");
      const response = await resolveVerificationAction(actionId);
      setActionMessage(String(response.message || (en ? "Action resolved successfully." : "조치가 성공적으로 해제되었습니다.")));
      await verificationCenterQuery.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to resolve action." : "조치 해제에 실패했습니다."));
    } finally {
      setRunningActionType("");
    }
  }

  useEffect(() => {
    logGovernanceScope("PAGE", "verification-center", {
      language: en ? "en" : "ko",
      baselinePackCount: baselinePacks.length,
      readyCount,
      partialCount,
      plannedCount,
      runItemCount: runItems.length,
      pageCount: inventorySummary.pageCount,
      apiCount: inventorySummary.apiCount,
      functionCount: inventorySummary.functionCount,
      highRiskPageCount: inventorySummary.highRiskPageCount,
      governedTestProfileCount: inventorySummary.governedTestProfileCount
    });
    logGovernanceScope("COMPONENT", "verification-center-catalog", {
      baselinePackCount: baselinePacks.length,
      runPassCount,
      normalizedPageCount,
      testCaseCount: inventorySummary.frontendE2eCount + inventorySummary.backendTestCount,
      highRiskApiCount: inventorySummary.highRiskApiCount
    });
  }, [
    baselinePacks.length,
    en,
    inventorySummary.apiCount,
    inventorySummary.backendTestCount,
    inventorySummary.frontendE2eCount,
    inventorySummary.functionCount,
    inventorySummary.governedTestProfileCount,
    inventorySummary.highRiskApiCount,
    inventorySummary.highRiskPageCount,
    inventorySummary.pageCount,
    normalizedPageCount,
    partialCount,
    plannedCount,
    readyCount,
    runItems.length,
    runPassCount
  ]);

  return (
    <AdminPageShell
      title={en ? "Verification Center" : "운영 검증 센터"}
      subtitle={en
        ? "Manage baseline backups, smoke scenarios, test accounts, datasets, scheduled sweeps, and verification evidence from one governed entry."
        : "baseline 백업, smoke 시나리오, 테스트 계정, 데이터셋, 정기 sweep, 검증 증거를 하나의 거버넌스 진입점에서 관리합니다."}
      breadcrumbs={[
        { label: en ? "System" : "시스템", href: buildAssetInventoryPath() },
        { label: en ? "Verification Center" : "운영 검증 센터" }
      ]}
    >
      <AdminWorkspacePageFrame>
        <PageStatusNotice tone="info">
          {en
            ? "This first version is the control tower for baseline governance. It should become the place that records what must be preserved before change, what was checked after change, and where the failure evidence lives."
            : "이번 1차 버전은 baseline 거버넌스 관제탑입니다. 변경 전에 무엇을 보존해야 하는지, 변경 후 무엇을 확인했는지, 실패 증거가 어디에 남는지를 한 곳에 모으는 출발점입니다."}
        </PageStatusNotice>
        {serverGeneratedAt ? (
          <PageStatusNotice tone="info">
            {en ? `Server payload refreshed at ${serverGeneratedAt}` : `서버 payload 갱신 시각: ${serverGeneratedAt}`}
          </PageStatusNotice>
        ) : null}
        {actionMessage ? <PageStatusNotice tone="success">{actionMessage}</PageStatusNotice> : null}
        {actionError ? <PageStatusNotice tone="warning">{actionError}</PageStatusNotice> : null}
        {verificationCenterQuery.error && !actionError ? <PageStatusNotice tone="warning">{verificationCenterQuery.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="verification-center-summary">
          <SummaryMetricCard title={en ? "Baseline Packs" : "기준선 묶음"} value={`${baselinePacks.length}`} />
          <SummaryMetricCard title={en ? "Managed Pages" : "관리 페이지"} value={`${inventorySummary.pageCount}`} />
          <SummaryMetricCard title={en ? "Scheduled Sweeps" : "정기 sweep"} value={`${scheduledSweepCount}`} />
          <SummaryMetricCard title={en ? "Stale / Pending" : "stale / 대기"} value={`${staleBaselineCount + runWarnCount + actionQueue.length}`} />
        </section>

        <DiagnosticCard
          data-help-id="verification-center-overview"
          title={en ? "Why this screen exists" : "이 화면이 필요한 이유"}
          status={en ? "Governed MVP" : "거버넌스 MVP"}
          statusTone="warning"
          description={en
            ? "Without a shared baseline, each AI or operator re-discovers what to click, what data to prepare, and what broke after change. This page centralizes that operating memory."
            : "공통 baseline이 없으면 AI나 운영자가 매번 무엇을 눌러야 하는지, 어떤 데이터를 준비해야 하는지, 수정 후 무엇이 깨졌는지를 다시 찾아야 합니다. 이 화면은 그 운영 기억을 중앙화합니다."}
          actions={(
            <>
              <MemberLinkButton href={buildVerificationCenterPath()} size="sm" variant="secondary">
                {en ? "Refresh scope" : "현재 스코프 새로 보기"}
              </MemberLinkButton>
              <MemberLinkButton href={buildLocalizedPath("/admin/system/backup_config", "/en/admin/system/backup_config")} size="sm" variant="secondary">
                {en ? "Open baseline backup" : "baseline 백업 열기"}
              </MemberLinkButton>
              <MemberLinkButton href={buildLocalizedPath("/admin/system/current-runtime-compare", "/en/admin/system/current-runtime-compare")} size="sm" variant="secondary">
                {en ? "Open runtime compare" : "런타임 비교 열기"}
              </MemberLinkButton>
              <MemberLinkButton href={buildVerificationAssetsPath()} size="sm" variant="secondary">
                {en ? "Manage assets" : "자산 관리 열기"}
              </MemberLinkButton>
            </>
          )}
        />

        <KeyValueGridPanel
          title={en ? "Always-on verification contract" : "상시 검증 계약"}
          description={en
            ? "Treat this page as an operations scanner: keep every page restorable to a known baseline, keep reusable test assets ready, and keep scheduled sweeps visible before drift spreads."
            : "이 화면을 운영 스캐너처럼 사용합니다. 각 페이지를 알려진 baseline으로 되돌릴 수 있어야 하고, 재사용 테스트 자산은 항상 준비되어 있어야 하며, drift가 퍼지기 전에 정기 sweep이 보여야 합니다."}
          items={[
            {
              label: en ? "Baseline backup" : "baseline 백업",
              value: en
                ? "Each governed page needs a preserved snapshot, retention location, owner, and last verification timestamp."
                : "관리 대상 페이지마다 보존 snapshot, 보관 위치, owner, 마지막 검증 시각이 있어야 합니다."
            },
            {
              label: en ? "Auto testability" : "자동 테스트 가능성",
              value: en
                ? "Every recurring run should know which route, account profile, dataset id, and expected signal it reuses."
                : "반복 실행되는 검증은 어떤 route, 계정 프로필, 데이터셋 id, 기대 신호를 재사용하는지 알아야 합니다."
            },
            {
              label: en ? "Sweep mode" : "sweep 모드",
              value: en
                ? "Run daily and weekly sweeps like a maintenance scanner, not only after incidents."
                : "장애 후에만 돌리지 말고 유지보수 스캐너처럼 일간/주간 sweep을 돌려야 합니다."
            },
            {
              label: en ? "Evidence log" : "증적 로그",
              value: en
                ? "Persist run result, baseline id, trace id, used profile id, and follow-up path into compare, repair, or rollback."
                : "실행 결과, baseline id, trace id, 사용 프로필 id, compare/repair/rollback 후속 경로를 남겨야 합니다."
            }
          ]}
        />

        <CollectionResultPanel
          title={en ? "Quick execution actions" : "즉시 실행 액션"}
          description={en
            ? "These calls now use the real backend route. Persistence is still the next step, but operators can already run the managed action flow from this screen."
            : "이제 이 실행은 실제 백엔드 경로를 사용합니다. 영속 저장은 다음 단계지만, 운영자는 이 화면에서 관리형 실행 흐름을 먼저 사용할 수 있습니다."}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((item) => (
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white p-4" key={item.actionType}>
                <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.label}</p>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{item.description}</p>
                <div className="mt-3">
                  <MemberButton
                    disabled={runningActionType === item.actionType}
                    onClick={() => void handleRunCheck(item.actionType)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {runningActionType === item.actionType ? (en ? "Running..." : "실행 중...") : (en ? "Run now" : "지금 실행")}
                  </MemberButton>
                </div>
              </div>
            ))}
          </div>
        </CollectionResultPanel>

        <section className="grid gap-6 xl:grid-cols-2" data-help-id="verification-center-catalog">
          {baselinePacks.map((item) => (
            <DiagnosticCard
              key={item.key}
              title={en ? item.titleEn : item.titleKo}
              status={statusLabel(item.status, en)}
              statusTone={statusTone(item.status)}
              description={en ? item.ownerEn : item.ownerKo}
              summary={(
                <ul className="space-y-2 text-sm text-[var(--kr-gov-text-secondary)]">
                  {(en ? item.baselineEn : item.baselineKo).map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              )}
            >
              <div className="flex flex-wrap gap-2">
                {item.links.map((link) => (
                  <MemberLinkButton href={link.href} key={link.href} size="sm" variant="secondary">
                    {en ? link.labelEn : link.labelKo}
                  </MemberLinkButton>
                ))}
              </div>
            </DiagnosticCard>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]" data-help-id="verification-center-runs">
          <DiagnosticCard
            title={en ? "Verification run cadence" : "검증 실행 주기"}
            status={en ? "Operational baseline" : "운영 기준선"}
            statusTone="warning"
            description={en
              ? "Use the same cadence for AI work, operator maintenance, and post-deploy checks so evidence stays comparable."
              : "AI 작업, 운영 점검, 배포 후 확인이 같은 주기를 공유해야 증거를 비교 가능하게 유지할 수 있습니다."}
          >
            <CollectionResultPanel
              title={en ? "Current run set" : "현재 실행 세트"}
              description={en ? "Each item defines when the check should run and what evidence should remain." : "각 항목은 언제 실행해야 하는지와 어떤 증거를 남겨야 하는지를 정의합니다."}
            >
              <div className="space-y-3">
                {runItems.map((item) => (
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={`${item.scopeEn}-${item.cadenceEn}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? item.scopeEn : item.scopeKo}</p>
                        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{en ? item.cadenceEn : item.cadenceKo}</p>
                      </div>
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">
                        {item.result}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? item.evidenceEn : item.evidenceKo}</p>
                  </div>
                ))}
              </div>
            </CollectionResultPanel>
          </DiagnosticCard>

          <KeyValueGridPanel
            title={en ? "Immediate management rules" : "즉시 적용 관리 규칙"}
            items={[
              {
                label: en ? "Before change" : "변경 전",
                value: en
                  ? "Capture route response, metadata response, and one preserved action signal for each touched page."
                  : "수정 대상 페이지마다 route 응답, 메타 응답, 보존해야 할 핵심 액션 신호 1개를 먼저 확보합니다."
              },
              {
                label: en ? "After change" : "변경 후",
                value: en
                  ? "Rerun the same path and scenario before broader testing so regressions are caught close to the edit."
                  : "넓은 테스트 전에 같은 경로와 같은 시나리오를 다시 실행해 회귀를 수정 지점 가까이에서 잡습니다."
              },
              {
                label: en ? "Test accounts" : "테스트 계정",
                value: en
                  ? "Keep role, expiry, reset history, and allowed datasets explicit instead of spreading them across tickets or chat."
                  : "역할, 만료, 초기화 이력, 허용 데이터셋을 티켓이나 대화에 흩뿌리지 말고 명시적으로 보관합니다."
              },
              {
                label: en ? "Real-data ban" : "실데이터 금지",
                value: en
                  ? "Verification must stop when only real data is available. Register test accounts and test datasets first."
                  : "실데이터만 있으면 검증을 중단해야 합니다. 먼저 테스트 계정과 테스트 데이터셋을 등록해야 합니다."
              },
              {
                label: en ? "Failure routing" : "실패 후 라우팅",
                value: en
                  ? "Move from verification failure into compare, repair, observability, and rollback evidence without losing the same trace context."
                  : "검증 실패 후 compare, repair, observability, rollback 증거로 이어질 때 같은 trace 맥락을 유지합니다."
              }
            ]}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]" data-help-id="verification-center-run-history">
          <CollectionResultPanel
            title={en ? "Recent verification runs" : "최근 검증 실행"}
            description={en
              ? "This should become the run ledger for scheduled sweeps, post-deploy smoke, and profile audits."
              : "이 영역은 정기 sweep, 배포 직후 smoke, 프로필 점검의 실행 원장을 담당해야 합니다."}
          >
            <div className="space-y-3">
              {verificationRuns.map((item) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={item.runId}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.runId}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{item.runType} · {item.targetScope}</p>
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">
                      {item.result}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--kr-gov-text-secondary)] md:grid-cols-2">
                    <div>baselineId: {item.baselineId}</div>
                    <div>traceId: {item.traceId}</div>
                    <div>profileId: {item.profileId}</div>
                    <div>datasetId: {item.datasetId}</div>
                    <div>{en ? "Failures" : "실패"}: {item.failureCount}</div>
                    <div>{en ? "Drift" : "드리프트"}: {item.driftCount}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MemberLinkButton href={buildLocalizedPath(item.followupPath, `/en${item.followupPath}`)} size="sm" variant="secondary">
                      {en ? "Open follow-up" : "후속 화면 열기"}
                    </MemberLinkButton>
                    <MemberLinkButton href={buildObservabilityPath({ pageId: "verification-center", traceId: item.traceId })} size="sm" variant="secondary">
                      {en ? "Open trace" : "trace 열기"}
                    </MemberLinkButton>
                  </div>
                </div>
              ))}
            </div>
          </CollectionResultPanel>

          <CollectionResultPanel
            title={en ? "Immediate action queue" : "즉시 조치 큐"}
            description={en
              ? "This queue is the maintenance checklist to clear before drift and expiry spread."
              : "이 큐는 drift와 만료가 퍼지기 전에 먼저 비워야 하는 유지보수 체크리스트입니다."}
          >
            <div className="space-y-3">
              {actionQueue.map((item) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={item.actionId}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.title}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{item.actionId} · {item.category} · owner={item.owner}</p>
                      <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{item.recommendedAction}</p>
                      <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">targetId: {item.targetId}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-mono text-amber-800">
                        {item.severity}
                      </span>
                      <MemberButton
                        disabled={runningActionType === item.actionId}
                        onClick={() => void handleResolveAction(item.actionId)}
                        size="sm"
                        variant="secondary"
                      >
                        {runningActionType === item.actionId ? "..." : (en ? "Resolve" : "조치 완료")}
                      </MemberButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollectionResultPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]" data-help-id="verification-center-managed-vault">
          <CollectionResultPanel
            title={en ? "Managed test asset vault" : "관리형 테스트 자산 보관함"}
            description={en
              ? "Keep reusable account and dataset profiles here instead of rediscovering them per ticket or per AI session."
              : "티켓이나 AI 세션마다 다시 찾지 않도록 재사용 계정과 데이터셋 프로필을 여기서 관리해야 합니다."}
          >
            <div className="space-y-3 text-sm text-[var(--kr-gov-text-secondary)]">
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3">
                {en ? "Role-based test accounts: admin, operator, auditor, integration sandbox, finance sandbox" : "역할 기반 테스트 계정: 관리자, 운영자, 감사자, 연계 샌드박스, 결제 샌드박스"}
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3">
                {en ? "Dataset packs: page seed, workflow seed, API replay seed, masked attachment seed" : "데이터셋 팩: 페이지 시드, 워크플로 시드, API 재현 시드, 마스킹 첨부 시드"}
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3">
                {en ? "Lifecycle fields: issuedAt, expiresAt, resetOwner, allowedRoutes, cleanupRule" : "생명주기 필드: issuedAt, expiresAt, resetOwner, allowedRoutes, cleanupRule"}
              </div>
            </div>
          </CollectionResultPanel>

          <CollectionResultPanel
            title={en ? "Scheduled scanner board" : "정기 스캐너 보드"}
            description={en
              ? "This is the operating shape: a maintenance scanner for pages, baselines, and test assets."
              : "운영 형태는 이렇습니다. 페이지, baseline, 테스트 자산을 훑는 유지보수 스캐너입니다."}
          >
            <div className="space-y-3">
              {[
                en ? "Daily: stale baseline, route health, last smoke age" : "일간: stale baseline, route health, 마지막 smoke 경과시간",
                en ? "Weekly: account expiry, dataset drift, external sandbox key expiry" : "주간: 계정 만료, 데이터셋 drift, 외부 샌드박스 키 만료",
                en ? "Post-deploy: changed routes, save flows, rollback anchor, evidence link" : "배포 직후: 변경 route, 저장 흐름, rollback anchor, 증적 링크",
                en ? "On failure: trace, compare, repair, rollback, reopen baseline" : "실패 시: trace, compare, repair, rollback, baseline 재개방"
              ].map((item) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3 text-sm" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </CollectionResultPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]" data-help-id="verification-center-baseline-registry">
          <CollectionResultPanel
            title={en ? "Baseline registry" : "baseline 레지스트리"}
            description={en
              ? "These are the preserved page baselines that should be restorable and re-verifiable."
              : "복구 가능하고 재검증 가능해야 하는 보존 페이지 baseline 목록입니다."}
          >
            <div className="space-y-3">
              {baselineRegistry.map((item) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={item.baselineId}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.pageId}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{item.routePath}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-mono ${item.stale ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                      {item.stale ? (en ? "STALE" : "오래됨") : "READY"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--kr-gov-text-secondary)]">
                    <div>baselineId: {item.baselineId}</div>
                    <div>snapshotPath: {item.snapshotPath}</div>
                    <div>owner: {item.owner}</div>
                    <div>lastVerifiedAt: {item.lastVerifiedAt}</div>
                    <div>scenarioIds: {item.requiredScenarioIds.join(", ")}</div>
                  </div>
                </div>
              ))}
            </div>
          </CollectionResultPanel>

          <CollectionResultPanel
            title={en ? "Vault inventory" : "보관 자산 인벤토리"}
            description={en
              ? "Account profiles and datasets should remain visible with expiry and refresh state."
              : "계정 프로필과 데이터셋은 만료와 갱신 상태가 보이도록 관리해야 합니다."}
          >
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Accounts" : "계정"}</p>
                <div className="space-y-2">
                  {vaultAccounts.map((item) => (
                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={item.profileId}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.profileId}</p>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{item.role} · owner={item.resetOwner}</p>
                        </div>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">expiresAt: {item.expiresAt}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">allowedRoutes: {item.allowedRoutes.join(", ")}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Datasets" : "데이터셋"}</p>
                <div className="space-y-2">
                  {vaultDatasets.map((item) => (
                    <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={item.datasetId}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.datasetId}</p>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{item.type} · {item.maskingPolicy}</p>
                        </div>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">lastRefreshedAt: {item.lastRefreshedAt}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">retentionPolicy: {item.retentionPolicy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollectionResultPanel>
        </section>

        <CollectionResultPanel
          data-help-id="verification-center-safety-policy"
          title={en ? "High-risk testing safety policy" : "고위험 테스트 안전 정책"}
          description={en
            ? "Real production data is prohibited for verification, especially on payment, refund, virtual-account, external-auth, and live integration flows."
            : "검증에서는 실 운영 데이터를 금지합니다. 특히 결제, 환불, 가상계좌, 외부인증, 실연계 흐름은 반드시 테스트 전용 자산만 사용해야 합니다."}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-4">
              <p className="text-sm font-black text-red-800">{en ? "Blocked when only real data exists" : "실데이터만 있으면 차단"}</p>
              <ul className="mt-2 space-y-1 text-sm text-red-700">
                <li>{en ? "- Real member or company account" : "- 실제 회원 또는 기업 계정"}</li>
                <li>{en ? "- Real payment or refund target" : "- 실제 결제 또는 환불 대상"}</li>
                <li>{en ? "- Live external provider key" : "- 실 운영 외부 제공자 키"}</li>
                <li>{en ? "- Production customer identifiers copied into a test case" : "- 운영 고객 식별자를 테스트 케이스에 복사"}</li>
              </ul>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-sm font-black text-emerald-800">{en ? "Required before execution" : "실행 전 필수 조건"}</p>
              <ul className="mt-2 space-y-1 text-sm text-emerald-700">
                <li>{en ? "- Approved test account profile" : "- 승인된 테스트 계정 프로필"}</li>
                <li>{en ? "- Approved seed data pack" : "- 승인된 시드 데이터 팩"}</li>
                <li>{en ? "- Cleanup or reset rule" : "- 정리 또는 초기화 규칙"}</li>
                <li>{en ? "- Masked evidence capture" : "- 마스킹된 증거 수집"}</li>
              </ul>
            </div>
          </div>
        </CollectionResultPanel>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]" data-help-id="verification-center-risk-scope">
          <CollectionResultPanel
            title={en ? "High-risk governed pages" : "고위험 관리 페이지"}
            description={en
              ? "These pages were automatically classified from page id, route, and menu metadata. They should be blocked from verification unless a matching sandbox profile and masked dataset exist."
              : "이 페이지들은 page id, route, menu 메타데이터에서 자동 분류했습니다. 대응하는 샌드박스 프로필과 마스킹 데이터셋이 없으면 검증을 막아야 합니다."}
          >
            <div className="space-y-3">
              {highRiskPages.slice(0, 12).map((item) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={item.pageId}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.pageId}</p>
                      <p className="mt-1 break-all text-xs text-[var(--kr-gov-text-secondary)]">{item.routePath || "-"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.riskTags.map((tag) => (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-mono text-amber-800" key={`${item.pageId}-${tag}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                    {en ? "Required profiles" : "필수 프로필"}: {item.requiredProfiles.join(", ") || "-"}
                  </p>
                </div>
              ))}
            </div>
          </CollectionResultPanel>

          <CollectionResultPanel
            title={en ? "Governed test profiles" : "거버넌스 테스트 프로필"}
            description={en
              ? "No persistent vault table exists yet. This screen now exposes the starter profile contract that should be stored and rotated explicitly."
              : "아직 영속 보관 테이블은 없습니다. 대신 이 화면에 저장과 회전이 필요한 시작용 프로필 계약을 먼저 노출합니다."}
          >
            <div className="space-y-3">
              {governedTestProfiles.map((profile) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={profile.profileId}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{profile.profileId}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{profile.title}</p>
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-mono text-[var(--kr-gov-text-secondary)]">
                      {profile.type}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{profile.notes}</p>
                  <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                    {en ? "Applies to" : "적용 범위"}: {profile.appliesTo.join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                    {en ? "Expiry tracking" : "만료 추적"}: {profile.requiresExpiryTracking ? (en ? "Required" : "필수") : (en ? "Optional" : "선택")}
                  </p>
                </div>
              ))}
            </div>
          </CollectionResultPanel>
        </section>

        <KeyValueGridPanel
          title={en ? "Token and credential expiry governance" : "토큰 및 자격 만료 거버넌스"}
          description={en
            ? "Reusable sandbox credentials must expire on purpose and remain visible before they fail inside a regression run."
            : "재사용 가능한 샌드박스 자격은 의도적으로 만료일을 가져야 하고, 회귀 실행 중에 갑자기 실패하기 전에 먼저 보이도록 관리해야 합니다."}
          items={[
            {
              label: en ? "Expiry fields" : "만료 필드",
              value: en
                ? "Each reusable test account needs expiresAt, issuedAt, reset owner, and linked dataset scope."
                : "재사용 테스트 계정마다 expiresAt, issuedAt, reset 담당자, 연결 데이터셋 범위를 둬야 합니다."
            },
            {
              label: en ? "Fail-closed rule" : "실패 차단 규칙",
              value: en
                ? "Verification must stop when only expired, locked, or production-bound credentials remain."
                : "만료되었거나 잠겼거나 운영 전용인 자격만 남으면 검증을 중단해야 합니다."
            },
            {
              label: en ? "Rotation window" : "회전 윈도우",
              value: en
                ? "External auth, token, key, and payment sandbox assets need pre-expiry alerts and reissue ownership."
                : "외부인증, 토큰, 키, 결제 샌드박스 자산은 만료 전 경보와 재발급 책임자를 가져야 합니다."
            },
            {
              label: en ? "Evidence retention" : "증거 보관",
              value: en
                ? "Run logs should store which profile id and dataset id were used, but keep sensitive values masked."
                : "실행 로그에는 어떤 프로필 id와 데이터셋 id를 썼는지 남기되 민감값은 마스킹해야 합니다."
            }
          ]}
        />

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]" data-help-id="verification-center-inventory-scope">
          <KeyValueGridPanel
            title={en ? "Current governed inventory" : "현재 거버넌스 인벤토리"}
            description={en
              ? "This snapshot is generated from page manifests, backend controller/service map, UI event map, and stored test files."
              : "이 스냅샷은 page manifest, backend controller/service map, UI event map, 보관된 테스트 파일에서 생성됩니다."}
            items={[
              { label: en ? "Pages" : "페이지", value: `${inventorySummary.pageCount}` },
              { label: en ? "Pages with menu+route" : "메뉴+경로 보유 페이지", value: `${normalizedPageCount}` },
              { label: en ? "Unbound pages" : "미정규 페이지", value: `${unboundPageCount}` },
              { label: en ? "APIs" : "API", value: `${inventorySummary.apiCount}` },
              { label: en ? "Unique API routes" : "고유 API 경로", value: `${inventorySummary.uniqueRouteCount}` },
              { label: en ? "Functions" : "함수", value: `${inventorySummary.functionCount}` },
              { label: en ? "Unique functions" : "고유 함수", value: `${inventorySummary.uniqueFunctionCount}` },
              { label: en ? "Frontend E2E" : "프런트 E2E", value: `${inventorySummary.frontendE2eCount}` },
              { label: en ? "Backend tests" : "백엔드 테스트", value: `${inventorySummary.backendTestCount}` },
              { label: en ? "High-risk pages" : "고위험 페이지", value: `${inventorySummary.highRiskPageCount || 0}` },
              { label: en ? "High-risk APIs" : "고위험 API", value: `${inventorySummary.highRiskApiCount || 0}` }
            ]}
          />

          <CollectionResultPanel
            title={en ? "Source of truth locations" : "원본 위치"}
            description={en ? "These paths are the current materialized sources for whole-system inventory and test retention." : "이 경로들이 현재 전체 시스템 인벤토리와 테스트 보관의 물리적 원본입니다."}
          >
            <div className="space-y-3">
              {Object.entries(inventory.sources).map(([key, value]) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={key}>
                  <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{key}</p>
                  <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{value}</p>
                </div>
              ))}
            </div>
          </CollectionResultPanel>
        </section>

        <section className="gov-card" data-help-id="verification-center-full-lists">
          <GridToolbar title={en ? "Full page / API / function / test lists" : "전체 페이지 / API / 함수 / 테스트 목록"} />
          <div className="space-y-4">
            <details className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4" open>
              <summary className="cursor-pointer text-sm font-black text-[var(--kr-gov-text-primary)]">
                {en ? `Pages (${inventory.pages.length})` : `페이지 (${inventory.pages.length})`}
              </summary>
              <div className="mt-4 max-h-[24rem] overflow-auto">
                <table className="data-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>{en ? "Page ID" : "페이지 ID"}</th>
                      <th>{en ? "Route" : "경로"}</th>
                      <th>{en ? "Menu Code" : "메뉴 코드"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.pages.map((item) => (
                      <tr key={item.pageId}>
                        <td>{item.pageId}</td>
                        <td className="break-all text-xs">{item.routePath || "-"}</td>
                        <td>{item.menuCode || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
              <summary className="cursor-pointer text-sm font-black text-[var(--kr-gov-text-primary)]">
                {en ? `APIs (${inventory.apis.length})` : `API (${inventory.apis.length})`}
              </summary>
              <div className="mt-4 max-h-[24rem] overflow-auto">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>{en ? "Route" : "경로"}</th>
                      <th>{en ? "Action" : "액션"}</th>
                      <th>{en ? "Controller" : "컨트롤러"}</th>
                      <th>{en ? "Service Method" : "서비스 메서드"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.apis.map((item) => (
                      <tr key={`${item.routePrefix}-${item.action}`}>
                        <td className="break-all text-xs">{item.routePrefix || "-"}</td>
                        <td>{item.action || "-"}</td>
                        <td>{item.controllerClass || "-"}</td>
                        <td className="break-all text-xs">{item.serviceMethod || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
              <summary className="cursor-pointer text-sm font-black text-[var(--kr-gov-text-primary)]">
                {en ? `Functions (${inventory.functions.length})` : `함수 (${inventory.functions.length})`}
              </summary>
              <div className="mt-4 max-h-[24rem] overflow-auto">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>{en ? "Function" : "함수"}</th>
                      <th>{en ? "Screen" : "화면"}</th>
                      <th>{en ? "Event" : "이벤트"}</th>
                      <th>{en ? "API / Route" : "API / 경로"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.functions.map((item, index) => (
                      <tr key={`${item.frontendFunction}-${item.screenId}-${index}`}>
                        <td>{item.frontendFunction || "-"}</td>
                        <td>{item.screenId || "-"}</td>
                        <td>{item.eventType || "-"}</td>
                        <td className="break-all text-xs">{item.apiOrRoute || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
              <summary className="cursor-pointer text-sm font-black text-[var(--kr-gov-text-primary)]">
                {en ? `High-risk Pages (${highRiskPages.length})` : `고위험 페이지 (${highRiskPages.length})`}
              </summary>
              <div className="mt-4 max-h-[24rem] overflow-auto">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>{en ? "Page ID" : "페이지 ID"}</th>
                      <th>{en ? "Route" : "경로"}</th>
                      <th>{en ? "Risk Tags" : "위험 태그"}</th>
                      <th>{en ? "Required Profiles" : "필수 프로필"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highRiskPages.map((item) => (
                      <tr key={`${item.pageId}-${item.routePath}`}>
                        <td>{item.pageId || "-"}</td>
                        <td className="break-all text-xs">{item.routePath || "-"}</td>
                        <td>{item.riskTags.join(", ") || "-"}</td>
                        <td className="break-all text-xs">{item.requiredProfiles.join(", ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
              <summary className="cursor-pointer text-sm font-black text-[var(--kr-gov-text-primary)]">
                {en ? `High-risk APIs (${highRiskApis.length})` : `고위험 API (${highRiskApis.length})`}
              </summary>
              <div className="mt-4 max-h-[24rem] overflow-auto">
                <table className="data-table min-w-[1080px]">
                  <thead>
                    <tr>
                      <th>{en ? "Route" : "경로"}</th>
                      <th>{en ? "Action" : "액션"}</th>
                      <th>{en ? "Risk Tags" : "위험 태그"}</th>
                      <th>{en ? "Required Profiles" : "필수 프로필"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highRiskApis.map((item) => (
                      <tr key={`${item.routePrefix}-${item.action}`}>
                        <td className="break-all text-xs">{item.routePrefix || "-"}</td>
                        <td>{item.action || "-"}</td>
                        <td>{item.riskTags.join(", ") || "-"}</td>
                        <td className="break-all text-xs">{item.requiredProfiles.join(", ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
              <summary className="cursor-pointer text-sm font-black text-[var(--kr-gov-text-primary)]">
                {en ? `Governed Test Profiles (${governedTestProfiles.length})` : `거버넌스 테스트 프로필 (${governedTestProfiles.length})`}
              </summary>
              <div className="mt-4 max-h-[24rem] overflow-auto">
                <table className="data-table min-w-[1080px]">
                  <thead>
                    <tr>
                      <th>{en ? "Profile ID" : "프로필 ID"}</th>
                      <th>{en ? "Type" : "유형"}</th>
                      <th>{en ? "Applies To" : "적용 범위"}</th>
                      <th>{en ? "Expiry Tracking" : "만료 추적"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {governedTestProfiles.map((profile) => (
                      <tr key={profile.profileId}>
                        <td>{profile.profileId}</td>
                        <td>{profile.type}</td>
                        <td>{profile.appliesTo.join(", ")}</td>
                        <td>{profile.requiresExpiryTracking ? (en ? "Required" : "필수") : (en ? "Optional" : "선택")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
              <summary className="cursor-pointer text-sm font-black text-[var(--kr-gov-text-primary)]">
                {en ? `Stored Tests (${inventory.tests.frontendE2e.length + inventory.tests.backend.length})` : `보관 테스트 (${inventory.tests.frontendE2e.length + inventory.tests.backend.length})`}
              </summary>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <CollectionResultPanel title={en ? "Frontend E2E" : "프런트 E2E"} description={en ? "Playwright specs stored for route and workflow verification." : "경로 및 워크플로 검증용 Playwright 스펙입니다."}>
                  {renderInventoryRows(inventory.tests.frontendE2e)}
                </CollectionResultPanel>
                <CollectionResultPanel title={en ? "Backend / Unit" : "백엔드 / 단위"} description={en ? "JUnit and service-level test assets currently stored in the repository." : "저장된 JUnit 및 서비스 단위 테스트 자산입니다."}>
                  {renderInventoryRows(inventory.tests.backend)}
                </CollectionResultPanel>
              </div>
            </details>
          </div>
        </section>

        <section className="gov-card" data-help-id="verification-center-log-policy">
          <GridToolbar title={en ? "Recommended next build steps" : "권장 다음 구축 단계"} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: en ? "1. Baseline registry table" : "1. 기준선 레지스트리 테이블",
                body: en
                  ? "Persist route, pageId, menuCode, baseline snapshot path, and required smoke scenario ids."
                  : "route, pageId, menuCode, baseline snapshot 경로, 필수 smoke 시나리오 id를 저장합니다."
              },
              {
                title: en ? "2. Scenario runner binding" : "2. 시나리오 실행기 바인딩",
                body: en
                  ? "Connect Playwright, curl, and save/calculate checks into one run contract."
                  : "Playwright, curl, save/calculate 점검을 하나의 run 계약으로 묶습니다."
              },
              {
                title: en ? "3. Test account vault" : "3. 테스트 계정 보관함",
                body: en
                  ? "Separate credential storage, expiry alerts, masking, and reset audit."
                  : "계정 보관, 만료 알림, masking, reset audit를 분리합니다."
              },
              {
                title: en ? "4. Sweep dashboard" : "4. 정기 점검 대시보드",
                body: en
                  ? "Show last run, failure count, drift count, and stale baseline count by page family."
                  : "페이지 계열별 마지막 실행, 실패 건수, drift 건수, stale baseline 건수를 보여줍니다."
              }
            ].map((item) => (
              <article className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-4" key={item.title}>
                <h3 className="text-base font-black text-[var(--kr-gov-text-primary)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
