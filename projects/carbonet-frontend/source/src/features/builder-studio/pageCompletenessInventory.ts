export type PageCompletenessStatus = "implemented" | "delegated" | "thin" | "placeholder-managed" | "missing";

export type PageCompletenessInventoryRow = {
  sourcePath: string;
  effectiveSourcePath: string;
  effectiveSourcePaths: string[];
  effectiveExportNames: string[];
  routeIds: string[];
  routeCount: number;
  status: PageCompletenessStatus;
  lineCount: number;
  reason: string;
  hasAsyncData: boolean;
  hasForm: boolean;
  hasTable: boolean;
  hasBuilderLink: boolean;
};

export const PAGE_COMPLETENESS_INVENTORY: PageCompletenessInventoryRow[] = [
  {
    "sourcePath": "features/access-history/AccessHistoryMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "access-history"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 785,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/admin-account-create/AdminAccountCreateMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "admin-create"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 600,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/admin-list/AdminListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "admin-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 249,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/admin-monitoring/AdminMonitoringOperationsPages.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "batch-monitoring",
      "cron-monitoring",
      "git-build-monitoring"
    ],
    "routeCount": 3,
    "status": "implemented",
    "lineCount": 994,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/admin-monitoring/MonitoringDashboardPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "admin-monitoring-dashboard"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 981,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/admin-permissions/AdminPermissionMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "admin-permission"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 240,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/admin-placeholder/AdminMenuPlaceholderPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "admin-menu-placeholder"
    ],
    "routeCount": 1,
    "status": "placeholder-managed",
    "lineCount": 78,
    "reason": "메뉴 접근과 메타데이터 표시는 가능하며, 상세 업무 화면 이관은 빌더에서 추적합니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/admin-sitemap/AdminSitemapMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "admin-sitemap"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 112,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/ai-management/AiAgentsPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "ai-agents"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 52,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/ai-management/AiDashboardPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "ai-dashboard"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 69,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/ai-management/AiLogsPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "ai-logs"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 53,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/ai-management/AiModelsPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "ai-models"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 56,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/ai-management/AiObservabilityPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "ai-observability"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 323,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/ai-management/AiQualityPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "ai-quality"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 53,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/ai-management/AiRagPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "ai-rag"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 294,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/ai-management/AiTrainingPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "ai-training"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 270,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/api-management/ApiManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "api-management"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/asset-deficiency-queue/AssetDeficiencyQueueMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "asset-deficiency-queue"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/auth-change/AuthChangeMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "auth-change"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 259,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/auth-groups/AuthGroupMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "auth-group"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 1771,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/backup-config/BackupConfigMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "backup-config",
      "backup-execution",
      "restore-execution"
    ],
    "routeCount": 3,
    "status": "implemented",
    "lineCount": 1386,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/banner-edit/BannerEditMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "banner-edit"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 165,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/banner-list/BannerListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "banner-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 331,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/batch-management/BatchManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "batch-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 506,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/blocklist/BlocklistMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "blocklist"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 975,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/board-add/BoardAddMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "board-add"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 498,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/board-list/BoardListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "board-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 322,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/builder-governance/BuilderGovernancePages.tsx",
    "effectiveSourcePath": "features/admin-ui/common.tsx",
    "effectiveSourcePaths": [
      "features/admin-ui/common.tsx"
    ],
    "effectiveExportNames": [
      "AdminSearchBar"
    ],
    "routeIds": [
      "theme",
      "theme-management"
    ],
    "routeCount": 2,
    "status": "implemented",
    "lineCount": 1193,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/builder-studio/BuilderStudioPage.tsx",
    "effectiveSourcePath": "features/builder-studio/BuilderStudioPage.tsx",
    "effectiveSourcePaths": [
      "features/builder-studio/BuilderStudioPage.tsx"
    ],
    "effectiveExportNames": [
      "BuilderStudioPage"
    ],
    "routeIds": [
      "builder-studio",
      "section-management"
    ],
    "routeCount": 2,
    "status": "implemented",
    "lineCount": 2466,
    "reason": "외부 런타임을 감싸는 관리형 화면이며 상태/조치 UI를 제공합니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/builder-studio/ComponentManagementPage.tsx",
    "effectiveSourcePath": "features/builder-studio/ComponentManagementPage.tsx",
    "effectiveSourcePaths": [
      "features/builder-studio/ComponentManagementPage.tsx"
    ],
    "effectiveExportNames": [
      "ComponentManagementPage"
    ],
    "routeIds": [
      "component-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 311,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/certificate-apply/CertificateApplyMigrationPage.tsx",
    "effectiveSourcePath": "features/certificate-apply/CertificateApplyMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/certificate-apply/CertificateApplyMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "CertificateApplyMigrationPage"
    ],
    "routeIds": [
      "certificate-apply"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 379,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-approve/CertificateApproveMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "certificate-approve"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 285,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-audit-log/CertificateAuditLogMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "certificate-audit-log"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 434,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-list/CertificateListMigrationPage.tsx",
    "effectiveSourcePath": "features/certificate-list/CertificateListMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/certificate-list/CertificateListMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "CertificateListMigrationPage"
    ],
    "routeIds": [
      "certificate-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 603,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-objection-list/CertificateObjectionListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "certificate-objection-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 384,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-pending/CertificatePendingMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "certificate-pending"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 312,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-rec-check/CertificateRecCheckMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "certificate-rec-check"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 371,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-report-edit/CertificateReportEditMigrationPage.tsx",
    "effectiveSourcePath": "features/certificate-report-edit/CertificateReportEditMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/certificate-report-edit/CertificateReportEditMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "CertificateReportEditMigrationPage"
    ],
    "routeIds": [
      "certificate-report-edit"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 564,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-report-form/CertificateReportFormMigrationPage.tsx",
    "effectiveSourcePath": "features/certificate-report-form/CertificateReportFormMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/certificate-report-form/CertificateReportFormMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "CertificateReportFormMigrationPage"
    ],
    "routeIds": [
      "certificate-report-form"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 484,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-report-list/CertificateReportListMigrationPage.tsx",
    "effectiveSourcePath": "features/certificate-report-list/CertificateReportListMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/certificate-report-list/CertificateReportListMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "CertificateReportListMigrationPage"
    ],
    "routeIds": [
      "certificate-report-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 324,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-review/CertificateReviewMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "certificate-review"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 348,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/certificate-statistics/CertificateStatisticsMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "certificate-statistics"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 291,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/co2-analysis/Co2AnalysisMigrationPage.tsx",
    "effectiveSourcePath": "features/co2-analysis/Co2AnalysisMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/co2-analysis/Co2AnalysisMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "Co2AnalysisMigrationPage"
    ],
    "routeIds": [
      "co2-analysis"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 699,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/co2-credit/Co2CreditMigrationPage.tsx",
    "effectiveSourcePath": "features/co2-credit/Co2CreditMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/co2-credit/Co2CreditMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "Co2CreditMigrationPage"
    ],
    "routeIds": [
      "co2-credit"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 946,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/co2-demand-list/Co2DemandListMigrationPage.tsx",
    "effectiveSourcePath": "features/co2-demand-list/Co2DemandListMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/co2-demand-list/Co2DemandListMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "Co2DemandListMigrationPage"
    ],
    "routeIds": [
      "co2-demand-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 644,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/co2-integrity/Co2IntegrityMigrationPage.tsx",
    "effectiveSourcePath": "features/co2-integrity/Co2IntegrityMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/co2-integrity/Co2IntegrityMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "Co2IntegrityMigrationPage"
    ],
    "routeIds": [
      "co2-integrity"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 700,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/co2-production-list/Co2ProductionListMigrationPage.tsx",
    "effectiveSourcePath": "features/co2-production-list/Co2ProductionListMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/co2-production-list/Co2ProductionListMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "Co2ProductionListMigrationPage"
    ],
    "routeIds": [
      "co2-production-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 780,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/co2-search/Co2SearchMigrationPage.tsx",
    "effectiveSourcePath": "features/co2-search/Co2SearchMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/co2-search/Co2SearchMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "Co2SearchMigrationPage"
    ],
    "routeIds": [
      "co2-search"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 817,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/column-management/ColumnManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "column-management"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/company-account/CompanyAccountMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "company-account"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 353,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/company-approve/CompanyApproveMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "company-approve"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 254,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/company-detail/CompanyDetailMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "company-detail"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 226,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/company-list/CompanyListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "company-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 241,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/controller-management/ControllerManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "controller-management"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/db-monitoring/DbMonitoringPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "db-monitoring"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 580,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/db-promotion-policy/DbPromotionPolicyMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "db-promotion-policy"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 273,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/db-sync-deploy/DbSyncDeployMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "db-sync-deploy"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 488,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/dept-role-mapping/DeptRoleMappingMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "dept-role"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 170,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/download-list/index.ts",
    "effectiveSourcePath": "features/download-list/DownloadListMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/download-list/DownloadListMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "DownloadListMigrationPage"
    ],
    "routeIds": [
      "download-list"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/edu-apply/EduApplyMigrationPage.tsx",
    "effectiveSourcePath": "features/edu-apply/EduApplyMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/edu-apply/EduApplyMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EduApplyMigrationPage"
    ],
    "routeIds": [
      "edu-apply"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 379,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/edu-certificate/EduCertificateMigrationPage.tsx",
    "effectiveSourcePath": "features/edu-certificate/EduCertificateMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/edu-certificate/EduCertificateMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EduCertificateMigrationPage"
    ],
    "routeIds": [
      "edu-certificate"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 376,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/edu-content/EduContentMigrationPage.tsx",
    "effectiveSourcePath": "features/edu-content/EduContentMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/edu-content/EduContentMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EduContentMigrationPage"
    ],
    "routeIds": [
      "edu-content"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 552,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/edu-course-detail/EduCourseDetailMigrationPage.tsx",
    "effectiveSourcePath": "features/edu-course-detail/EduCourseDetailMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/edu-course-detail/EduCourseDetailMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EduCourseDetailMigrationPage"
    ],
    "routeIds": [
      "edu-course-detail"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 550,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/edu-course-list/EduCourseListMigrationPage.tsx",
    "effectiveSourcePath": "features/edu-course-list/EduCourseListMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/edu-course-list/EduCourseListMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EduCourseListMigrationPage"
    ],
    "routeIds": [
      "edu-course-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 577,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/edu-my-course/EduMyCourseMigrationPage.tsx",
    "effectiveSourcePath": "features/edu-my-course/EduMyCourseMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/edu-my-course/EduMyCourseMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EduMyCourseMigrationPage"
    ],
    "routeIds": [
      "edu-my-course"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 549,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/edu-progress/EduProgressMigrationPage.tsx",
    "effectiveSourcePath": "features/edu-progress/EduProgressMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/edu-progress/EduProgressMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EduProgressMigrationPage"
    ],
    "routeIds": [
      "edu-progress"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 610,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/edu-survey/EduSurveyMigrationPage.tsx",
    "effectiveSourcePath": "features/edu-survey/EduSurveyMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/edu-survey/EduSurveyMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EduSurveyMigrationPage"
    ],
    "routeIds": [
      "edu-survey"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 309,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-data-history/EmissionDataHistoryMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "emission-data-history"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 348,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-data-input/EmissionDataInputMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-data-input/EmissionDataInputMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/emission-data-input/EmissionDataInputMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EmissionDataInputMigrationPage"
    ],
    "routeIds": [
      "emission-data-input"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 639,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-definition-studio/index.ts",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "emission-definition-studio"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-ecoinvent-admin/EmissionEcoinventAdminMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "emission-ecoinvent-admin"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 596,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-gwp-values/EmissionGwpValuesMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-gwp-values/react.tsx",
    "effectiveSourcePaths": [
      "features/emission-gwp-values/react.tsx"
    ],
    "effectiveExportNames": [
      "Fragment"
    ],
    "routeIds": [
      "emission-gwp-values"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 1698,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-home-validate/EmissionHomeValidateMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-home-validate/EmissionHomeValidateMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/emission-home-validate/EmissionHomeValidateMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EmissionHomeValidateMigrationPage"
    ],
    "routeIds": [
      "emission-home-validate"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 631,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-lca/EmissionLcaMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-lca/EmissionLcaMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/emission-lca/EmissionLcaMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EmissionLcaMigrationPage"
    ],
    "routeIds": [
      "emission-lca"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 370,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-lci-classification/EmissionLciClassificationMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "emission-lci-classification"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 376,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-lci/EmissionLciMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-lci/EmissionLciMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/emission-lci/EmissionLciMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EmissionLciMigrationPage"
    ],
    "routeIds": [
      "emission-lci"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 684,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-management/EmissionManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-management/react.tsx",
    "effectiveSourcePaths": [
      "features/emission-management/react.tsx"
    ],
    "effectiveExportNames": [
      "Fragment"
    ],
    "routeIds": [
      "emission-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 4234,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-project-list/EmissionProjectListMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-project-list/EmissionProjectListMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/emission-project-list/EmissionProjectListMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EmissionProjectListMigrationPage"
    ],
    "routeIds": [
      "emission-project-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 643,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-reduction/EmissionReductionMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-reduction/EmissionReductionMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/emission-reduction/EmissionReductionMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EmissionReductionMigrationPage"
    ],
    "routeIds": [
      "emission-reduction"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 578,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-report-submit/EmissionReportSubmitMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-report-submit/EmissionReportSubmitMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/emission-report-submit/EmissionReportSubmitMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EmissionReportSubmitMigrationPage"
    ],
    "routeIds": [
      "emission-report-submit"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 628,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-result-detail/EmissionResultDetailMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "emission-result-detail"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 321,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-result-list/EmissionResultListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "emission-result-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 376,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-simulate/EmissionSimulateMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-simulate/EmissionSimulateMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/emission-simulate/EmissionSimulateMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "EmissionSimulateMigrationPage"
    ],
    "routeIds": [
      "emission-simulate"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 566,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/emission-site-management/EmissionSiteManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "emission-site-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 204,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-survey-admin-data/EmissionSurveyAdminDataMigrationPage.tsx",
    "effectiveSourcePath": "features/emission-survey-admin-data/react.tsx",
    "effectiveSourcePaths": [
      "features/emission-survey-admin-data/react.tsx"
    ],
    "effectiveExportNames": [
      "Fragment"
    ],
    "routeIds": [
      "emission-survey-admin-data"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 1395,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-survey-admin/EmissionSurveyAdminMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "emission-survey-admin"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 2828,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "emission-survey-lca-summary-print",
      "emission-survey-report",
      "emission-survey-report-print"
    ],
    "routeCount": 3,
    "status": "implemented",
    "lineCount": 2192,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/emission-validate/EmissionValidateMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "emission-validate"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 420,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/error-log/ErrorLogMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "error-log"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 303,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/event-management/EventManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "event-management"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-connection-add/ExternalConnectionAddMigrationPage.tsx",
    "effectiveSourcePath": "features/external-connection-edit/ExternalConnectionEditMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/external-connection-edit/ExternalConnectionEditMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "ExternalConnectionFormMigrationPage"
    ],
    "routeIds": [
      "external-connection-add"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 4,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-connection-edit/ExternalConnectionEditMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-connection-edit"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 432,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-connection-list/ExternalConnectionListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-connection-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 561,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-keys/ExternalKeysMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-keys"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 492,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-logs/ExternalLogsMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-logs"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 226,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-maintenance/ExternalMaintenanceMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-maintenance"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 358,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-monitoring/ExternalMonitoringMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-monitoring"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 234,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-retry/ExternalRetryMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-retry"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 232,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-schema/ExternalSchemaMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-schema"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 514,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-sync/ExternalSyncMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-sync"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 326,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-usage/ExternalUsageMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-usage"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 180,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/external-webhooks/ExternalWebhooksMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "external-webhooks"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 313,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/faq-management/FaqManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "faq-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 376,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/file-management/FileManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "file-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 682,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/flutter-app/FlutterAppPage.tsx",
    "effectiveSourcePath": "features/flutter-app/FlutterAppPage.tsx",
    "effectiveSourcePaths": [
      "features/flutter-app/FlutterAppPage.tsx"
    ],
    "effectiveExportNames": [
      "default"
    ],
    "routeIds": [
      "flutter-app"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 48,
    "reason": "외부 런타임을 감싸는 관리형 화면이며 상태/조치 UI를 제공합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/function-console/FunctionConsoleMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "function-console"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/function-management/FunctionManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "function-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 273,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/hermes-workflow/HermesWorkflowMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "hermes-workflow"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 315,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/home-entry/HomeEntryPages.tsx",
    "effectiveSourcePath": "features/home-entry/HomeEntryPages.tsx",
    "effectiveSourcePaths": [
      "features/home-entry/HomeEntryPages.tsx"
    ],
    "effectiveExportNames": [
      "HomeLandingPage"
    ],
    "routeIds": [
      "home"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 147,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/home-placeholder/HomeMenuPlaceholderPage.tsx",
    "effectiveSourcePath": "features/home-placeholder/HomeMenuPlaceholderPage.tsx",
    "effectiveSourcePaths": [
      "features/home-placeholder/HomeMenuPlaceholderPage.tsx"
    ],
    "effectiveExportNames": [
      "HomeMenuPlaceholderPage"
    ],
    "routeIds": [
      "home-menu-placeholder"
    ],
    "routeCount": 1,
    "status": "placeholder-managed",
    "lineCount": 97,
    "reason": "메뉴 접근과 메타데이터 표시는 가능하며, 상세 업무 화면 이관은 빌더에서 추적합니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/ip-whitelist/IpWhitelistMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "ip-whitelist"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 603,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx",
    "effectiveSourcePath": "features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "JoinCompanyReapplyMigrationPage"
    ],
    "routeIds": [
      "join-company-reapply"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 549,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/join-company-register/JoinCompanyRegisterCompleteMigrationPage.tsx",
    "effectiveSourcePath": "features/join-company-register/JoinCompanyRegisterCompleteMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/join-company-register/JoinCompanyRegisterCompleteMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "JoinCompanyRegisterCompleteMigrationPage"
    ],
    "routeIds": [
      "join-company-register-complete"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 203,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/join-company-register/JoinCompanyRegisterMigrationPage.tsx",
    "effectiveSourcePath": "features/join-company-register/JoinCompanyRegisterMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/join-company-register/JoinCompanyRegisterMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "JoinCompanyRegisterMigrationPage"
    ],
    "routeIds": [
      "join-company-register"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 765,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/join-wizard/JoinAuthMigrationPage.tsx",
    "effectiveSourcePath": "features/join-wizard/JoinAuthMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/join-wizard/JoinAuthMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "JoinAuthMigrationPage"
    ],
    "routeIds": [
      "join-auth"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 462,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/join-wizard/JoinCompleteMigrationPage.tsx",
    "effectiveSourcePath": "features/join-wizard/JoinCompleteMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/join-wizard/JoinCompleteMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "JoinCompleteMigrationPage"
    ],
    "routeIds": [
      "join-complete"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 234,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/join-wizard/JoinInfoMigrationPage.tsx",
    "effectiveSourcePath": "features/join-wizard/JoinInfoMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/join-wizard/JoinInfoMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "JoinInfoMigrationPage"
    ],
    "routeIds": [
      "join-info"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 774,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/join-wizard/JoinTermsMigrationPage.tsx",
    "effectiveSourcePath": "features/join-wizard/JoinTermsMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/join-wizard/JoinTermsMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "JoinTermsMigrationPage"
    ],
    "routeIds": [
      "join-terms"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 264,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/join-wizard/JoinWizardMigrationPage.tsx",
    "effectiveSourcePath": "features/join-wizard/JoinWizardMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/join-wizard/JoinWizardMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "JoinWizardMigrationPage"
    ],
    "routeIds": [
      "join-wizard"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 253,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/login-history/LoginHistoryMigrationPage.tsx",
    "effectiveSourcePath": "features/security-history/LoginHistorySharedPage.tsx",
    "effectiveSourcePaths": [
      "features/security-history/LoginHistorySharedPage.tsx"
    ],
    "effectiveExportNames": [
      "LoginHistorySharedPage"
    ],
    "routeIds": [
      "login-history"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 23,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/member-approve/MemberApproveMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "member-approve"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 259,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/member-detail/MemberDetailMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "member-detail"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 303,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/member-edit/MemberEditMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "member-edit"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 351,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/member-list/MemberListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "member-activate",
      "member-list",
      "member-withdrawn"
    ],
    "routeCount": 3,
    "status": "implemented",
    "lineCount": 392,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/member-register/MemberRegisterMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "member-register"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 717,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/member-stats/MemberStatsMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "member-stats"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 131,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/menu-management/FaqMenuManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "faq-menu-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 397,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/menu-management/FullStackManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "full-stack-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 1236,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/menu-management/MenuManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "menu-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 1554,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/module-management/ModuleManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "module"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 279,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/monitoring-dashboard/MonitoringAlertsMigrationPage.tsx",
    "effectiveSourcePath": "features/monitoring-dashboard/MonitoringAlertsMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/monitoring-dashboard/MonitoringAlertsMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MonitoringAlertsMigrationPage"
    ],
    "routeIds": [
      "monitoring-alerts"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 714,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/monitoring-dashboard/MonitoringDashboardMigrationPage.tsx",
    "effectiveSourcePath": "features/monitoring-dashboard/MonitoringDashboardMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/monitoring-dashboard/MonitoringDashboardMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MonitoringDashboardMigrationPage"
    ],
    "routeIds": [
      "monitoring-dashboard"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 853,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/monitoring-dashboard/MonitoringRealtimeMigrationPage.tsx",
    "effectiveSourcePath": "features/monitoring-dashboard/MonitoringRealtimeMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/monitoring-dashboard/MonitoringRealtimeMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MonitoringRealtimeMigrationPage"
    ],
    "routeIds": [
      "monitoring-realtime"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 853,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/monitoring-export/MonitoringExportMigrationPage.tsx",
    "effectiveSourcePath": "features/monitoring-export/MonitoringExportMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/monitoring-export/MonitoringExportMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MonitoringExportMigrationPage"
    ],
    "routeIds": [
      "monitoring-export"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 839,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/monitoring-reduction-trend/MonitoringReductionTrendMigrationPage.tsx",
    "effectiveSourcePath": "features/monitoring-reduction-trend/MonitoringReductionTrendMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/monitoring-reduction-trend/MonitoringReductionTrendMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MonitoringReductionTrendMigrationPage"
    ],
    "routeIds": [
      "monitoring-reduction-trend"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 797,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/monitoring-share/MonitoringShareMigrationPage.tsx",
    "effectiveSourcePath": "features/member/common.tsx",
    "effectiveSourcePaths": [
      "features/member/common.tsx"
    ],
    "effectiveExportNames": [
      "MemberButton"
    ],
    "routeIds": [
      "monitoring-share"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 666,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/monitoring-statistics/MonitoringStatisticsMigrationPage.tsx",
    "effectiveSourcePath": "features/monitoring-statistics/MonitoringStatisticsMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/monitoring-statistics/MonitoringStatisticsMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MonitoringStatisticsMigrationPage"
    ],
    "routeIds": [
      "monitoring-statistics"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 810,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/monitoring-track/MonitoringTrackMigrationPage.tsx",
    "effectiveSourcePath": "features/monitoring-track/MonitoringTrackMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/monitoring-track/MonitoringTrackMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MonitoringTrackMigrationPage"
    ],
    "routeIds": [
      "monitoring-track"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 962,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/mtn-status/MtnStatusMigrationPage.tsx",
    "effectiveSourcePath": "features/mtn-status/MtnStatusMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/mtn-status/MtnStatusMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MtnStatusMigrationPage"
    ],
    "routeIds": [
      "mtn-status"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 643,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/my-inquiry/MyInquiryMigrationPage.tsx",
    "effectiveSourcePath": "features/my-inquiry/MyInquiryMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/my-inquiry/MyInquiryMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MyInquiryMigrationPage"
    ],
    "routeIds": [
      "my-inquiry"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 525,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/mypage-company/MypageCompanyMigrationPage.tsx",
    "effectiveSourcePath": "features/mypage-company/MypageCompanyMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/mypage-company/MypageCompanyMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MypageCompanyMigrationPage"
    ],
    "routeIds": [
      "mypage-company"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 430,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/mypage-email/MypageEmailMigrationPage.tsx",
    "effectiveSourcePath": "features/mypage-email/MypageEmailMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/mypage-email/MypageEmailMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MypageEmailMigrationPage"
    ],
    "routeIds": [
      "mypage-email"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 173,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/mypage-password/MypagePasswordMigrationPage.tsx",
    "effectiveSourcePath": "features/mypage-password/MypagePasswordMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/mypage-password/MypagePasswordMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MypagePasswordMigrationPage"
    ],
    "routeIds": [
      "mypage-password"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 311,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/mypage-staff/MypageStaffMigrationPage.tsx",
    "effectiveSourcePath": "features/mypage-staff/MypageStaffMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/mypage-staff/MypageStaffMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MypageStaffMigrationPage"
    ],
    "routeIds": [
      "mypage-staff"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 548,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/mypage/MypageMarketingMigrationPage.tsx",
    "effectiveSourcePath": "features/mypage/MypageMarketingMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/mypage/MypageMarketingMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MypageMarketingMigrationPage"
    ],
    "routeIds": [
      "mypage-marketing"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 414,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/mypage/MypageMigrationPage.tsx",
    "effectiveSourcePath": "features/mypage/MypageMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/mypage/MypageMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MypageMigrationPage"
    ],
    "routeIds": [
      "mypage"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 788,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/mypage/MypageNotificationMigrationPage.tsx",
    "effectiveSourcePath": "features/mypage/MypageNotificationMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/mypage/MypageNotificationMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "MypageNotificationMigrationPage"
    ],
    "routeIds": [
      "mypage-notification"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 473,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/new-page/index.ts",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "new-page"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/notice-list/index.ts",
    "effectiveSourcePath": "features/notice-list/NoticeListMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/notice-list/NoticeListMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "NoticeListMigrationPage"
    ],
    "routeIds": [
      "notice-list"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/notification-center/NotificationCenterMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "notification"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 899,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/operations-center/OperationsCenterMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "monitoring-center"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 1080,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/operations-inventory/OperationsInventoryPages.tsx",
    "effectiveSourcePath": "features/operations-inventory/OperationsInventoryPages.tsx",
    "effectiveSourcePaths": [
      "features/operations-inventory/OperationsInventoryPages.tsx"
    ],
    "effectiveExportNames": [
      "AiHangarMigrationPage",
      "InstalledProgramsMigrationPage",
      "OperationsLogManagementMigrationPage",
      "SystemResourcesMigrationPage"
    ],
    "routeIds": [
      "ai-hangar",
      "installed-programs",
      "operations-log-management",
      "system-resources"
    ],
    "routeCount": 4,
    "status": "implemented",
    "lineCount": 248,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/page-management/PageManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "page-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 876,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/password-reset/PasswordResetMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "password-reset"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 458,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/payment-history/PaymentHistoryMigrationPage.tsx",
    "effectiveSourcePath": "features/payment-history/PaymentHistoryMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/payment-history/PaymentHistoryMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "PaymentHistoryMigrationPage"
    ],
    "routeIds": [
      "payment-history"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 568,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/payment-notify/PaymentNotifyMigrationPage.tsx",
    "effectiveSourcePath": "features/payment-notify/PaymentNotifyMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/payment-notify/PaymentNotifyMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "PaymentNotifyMigrationPage"
    ],
    "routeIds": [
      "payment-notify"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 689,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/payment-pay/PaymentPayMigrationPage.tsx",
    "effectiveSourcePath": "features/payment-pay/PaymentPayMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/payment-pay/PaymentPayMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "PaymentPayMigrationPage"
    ],
    "routeIds": [
      "payment-pay"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 914,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/payment-receipt/PaymentReceiptMigrationPage.tsx",
    "effectiveSourcePath": "features/payment-receipt/PaymentReceiptMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/payment-receipt/PaymentReceiptMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "PaymentReceiptMigrationPage"
    ],
    "routeIds": [
      "payment-receipt"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 941,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/payment-refund-account/PaymentRefundAccountMigrationPage.tsx",
    "effectiveSourcePath": "features/payment-refund-account/PaymentRefundAccountMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/payment-refund-account/PaymentRefundAccountMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "PaymentRefundAccountMigrationPage"
    ],
    "routeIds": [
      "payment-refund-account"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 875,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/payment-refund/PaymentRefundMigrationPage.tsx",
    "effectiveSourcePath": "features/payment-refund/PaymentRefundMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/payment-refund/PaymentRefundMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "PaymentRefundMigrationPage"
    ],
    "routeIds": [
      "payment-refund"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 854,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/payment-virtual-account/PaymentVirtualAccountMigrationPage.tsx",
    "effectiveSourcePath": "features/payment-virtual-account/PaymentVirtualAccountMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/payment-virtual-account/PaymentVirtualAccountMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "PaymentVirtualAccountMigrationPage"
    ],
    "routeIds": [
      "payment-virtual-account"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 1150,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/performance/PerformanceMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "performance"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 406,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/popup-edit/PopupEditMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "popup-edit"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 420,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/popup-list/PopupListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "popup-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 358,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/post-list/PostListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "post-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 316,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/qna-category/QnaCategoryMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "qna-category"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 521,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/qna-list/index.ts",
    "effectiveSourcePath": "features/qna-list/QnaListMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/qna-list/QnaListMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "QnaListMigrationPage"
    ],
    "routeIds": [
      "qna-list"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/refund-list/RefundListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "refund-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 269,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/refund-process/RefundProcessMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "refund-process"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 377,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/scheduler-management/SchedulerManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "scheduler-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 152,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/screen-builder/ScreenBuilderDashboardPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "screen-builder-dashboard"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 299,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/screen-management/ScreenFlowManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "screen-flow-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 435,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/screen-management/ScreenManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "screen-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 473,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": true
  },
  {
    "sourcePath": "features/screen-management/ScreenMenuAssignmentManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "screen-menu-assignment-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 573,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/security-audit/SecurityAuditMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "security-audit"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 757,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/security-history/MemberSecurityHistoryMigrationPage.tsx",
    "effectiveSourcePath": "features/security-history/LoginHistorySharedPage.tsx",
    "effectiveSourcePaths": [
      "features/security-history/LoginHistorySharedPage.tsx"
    ],
    "effectiveExportNames": [
      "LoginHistorySharedPage"
    ],
    "routeIds": [
      "member-security-history"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 26,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/security-history/SecurityHistoryMigrationPage.tsx",
    "effectiveSourcePath": "features/security-history/SystemSecurityHistoryMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/security-history/SystemSecurityHistoryMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "SystemSecurityHistoryMigrationPage"
    ],
    "routeIds": [
      "security-history"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 12,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/security-monitoring/SecurityMonitoringMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "security-monitoring"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 1691,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/security-policy/SecurityPolicyMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "security-policy"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 2039,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/sensor-add/SensorAddMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "sensor-add"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 339,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/sensor-edit/SensorEditMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "sensor-edit"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 422,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/sensor-list/SensorListMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "sensor-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 574,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/settlement-calendar/SettlementCalendarMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "settlement-calendar"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 326,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/sitemap/SitemapMigrationPage.tsx",
    "effectiveSourcePath": "features/sitemap/SitemapMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/sitemap/SitemapMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "SitemapMigrationPage"
    ],
    "routeIds": [
      "sitemap"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 119,
    "reason": "데이터 기반 포털/조회 화면으로 구성되어 있습니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/support-faq/SupportFaqMigrationPage.tsx",
    "effectiveSourcePath": "features/support-faq/SupportFaqMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/support-faq/SupportFaqMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "SupportFaqMigrationPage"
    ],
    "routeIds": [
      "support-faq"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 306,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/support-inquiry/SupportInquiryMigrationPage.tsx",
    "effectiveSourcePath": "features/support-inquiry/SupportInquiryMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/support-inquiry/SupportInquiryMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "SupportInquiryMigrationPage"
    ],
    "routeIds": [
      "support-inquiry"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 581,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/system-code/SystemCodeSimplePage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "system-code-inquiry",
      "system-code-inquiry-class",
      "system-code-inquiry-detail",
      "system-code-inquiry-group",
      "system-code-register",
      "system-code-register-class",
      "system-code-register-detail",
      "system-code-register-group"
    ],
    "routeCount": 8,
    "status": "implemented",
    "lineCount": 356,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/system-infra/InfraManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "infra"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 346,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/tag-management/TagManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "tag-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 369,
    "reason": "자체 UI와 동작 로직이 있는 라우트 화면입니다.",
    "hasAsyncData": false,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-approve/TradeApproveMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "trade-approve"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 433,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-auto-order/TradeAutoOrderMigrationPage.tsx",
    "effectiveSourcePath": "features/trade-auto-order/TradeAutoOrderMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/trade-auto-order/TradeAutoOrderMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "TradeAutoOrderMigrationPage"
    ],
    "routeIds": [
      "trade-auto-order"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 697,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-buy-request/TradeBuyRequestMigrationPage.tsx",
    "effectiveSourcePath": "features/trade-buy-request/TradeBuyRequestMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/trade-buy-request/TradeBuyRequestMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "TradeBuyRequestMigrationPage"
    ],
    "routeIds": [
      "trade-buy-request"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 598,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-complete/TradeCompleteMigrationPage.tsx",
    "effectiveSourcePath": "features/trade-complete/TradeCompleteMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/trade-complete/TradeCompleteMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "TradeCompleteMigrationPage"
    ],
    "routeIds": [
      "trade-complete"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 783,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-duplicate/TradeDuplicateMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "trade-duplicate"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 344,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-list/TradeListMigrationPage.tsx",
    "effectiveSourcePath": "features/trade-list/TradeListMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/trade-list/TradeListMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "TradeListMigrationPage"
    ],
    "routeIds": [
      "trade-list"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 581,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-market/TradeMarketMigrationPage.tsx",
    "effectiveSourcePath": "features/trade-market/TradeMarketMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/trade-market/TradeMarketMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "TradeMarketMigrationPage"
    ],
    "routeIds": [
      "trade-market"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 577,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-price-alert/TradePriceAlertMigrationPage.tsx",
    "effectiveSourcePath": "features/trade-price-alert/TradePriceAlertMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/trade-price-alert/TradePriceAlertMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "TradePriceAlertMigrationPage"
    ],
    "routeIds": [
      "trade-price-alert"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 548,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-reject/TradeRejectMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "trade-reject"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 352,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": false,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-report/TradeReportMigrationPage.tsx",
    "effectiveSourcePath": "features/trade-report/TradeReportMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/trade-report/TradeReportMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "TradeReportMigrationPage"
    ],
    "routeIds": [
      "trade-report"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 658,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-sell/TradeSellMigrationPage.tsx",
    "effectiveSourcePath": "features/trade-sell/TradeSellMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/trade-sell/TradeSellMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "TradeSellMigrationPage"
    ],
    "routeIds": [
      "trade-sell"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 512,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/trade-statistics/TradeStatisticsMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "trade-statistics"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 279,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/verification-asset-management/VerificationAssetManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "verification-asset-management"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/version-management/index.ts",
    "effectiveSourcePath": "features/version-management/VersionManagementMigrationPage.tsx",
    "effectiveSourcePaths": [
      "features/version-management/VersionManagementMigrationPage.tsx"
    ],
    "effectiveExportNames": [
      "VersionManagementMigrationPage"
    ],
    "routeIds": [
      "mtn-version"
    ],
    "routeCount": 1,
    "status": "delegated",
    "lineCount": 1,
    "reason": "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다.",
    "hasAsyncData": false,
    "hasForm": false,
    "hasTable": false,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/virtual-issue/VirtualIssueMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "virtual-issue"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 379,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  },
  {
    "sourcePath": "features/wbs-management/WbsManagementMigrationPage.tsx",
    "effectiveSourcePath": "features/admin-entry/AdminPageShell.tsx",
    "effectiveSourcePaths": [
      "features/admin-entry/AdminPageShell.tsx"
    ],
    "effectiveExportNames": [
      "AdminPageShell"
    ],
    "routeIds": [
      "wbs-management"
    ],
    "routeCount": 1,
    "status": "implemented",
    "lineCount": 571,
    "reason": "데이터와 UI/동작 신호가 있는 라우트 화면입니다.",
    "hasAsyncData": true,
    "hasForm": true,
    "hasTable": true,
    "hasBuilderLink": false
  }
];
