# Current Worktree Snapshot

Reconciled on `2026-03-30` from `git status --short`.

## Shared Frontend Contract Files

- `data/full-stack-management/registry.json`
- `frontend/src/app/hooks/useRuntimeNavigation.ts`
- `frontend/src/app/routes/definitions.ts`
- `frontend/src/app/routes/pageRegistry.tsx`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/navigation/runtime.ts`
- `frontend/src/generated/systemComponentCatalog.json`

## Frontend Feature Files Already In Play

- `frontend/src/features/emission-project-list/EmissionProjectListMigrationPage.tsx`
- `frontend/src/features/environment-management/EnvironmentManagementHubPage.tsx`
- `frontend/src/features/home-entry/HomeEntryPages.tsx`
- `frontend/src/features/menu-management/FullStackManagementMigrationPage.tsx`
- `frontend/src/features/security-monitoring/SecurityMonitoringMigrationPage.tsx`
- `frontend/src/features/system-code/SystemCodeMigrationPage.tsx`
- `frontend/src/features/tag-management/TagManagementMigrationPage.tsx`
- `frontend/src/features/batch-management/`
- `frontend/src/features/external-connection-add/`
- `frontend/src/features/external-connection-list/`
- `frontend/src/features/notification-center/`
- `frontend/src/features/operations-center/`
- `frontend/src/features/performance/`
- `frontend/src/features/sensor-add/`
- `frontend/src/features/sensor-edit/`
- `frontend/src/features/sensor-list/`
- `frontend/src/features/system-infra/`

## Backend Files Already In Play

- `src/main/java/egovframework/com/common/audit/PersistingAuditEventWriter.java`
- `src/main/java/egovframework/com/common/error/ErrorEventService.java`
- `src/main/java/egovframework/com/common/mapper/ObservabilityMapper.java`
- `src/main/java/egovframework/com/common/service/impl/ObservabilityQueryServiceImpl.java`
- `src/main/java/egovframework/com/common/util/ReactPageUrlMapper.java`
- `src/main/java/egovframework/com/feature/admin/service/impl/AdminSummaryServiceImpl.java`
- `src/main/java/egovframework/com/feature/admin/service/impl/ScreenCommandCenterServiceImpl.java`
- `src/main/java/egovframework/com/feature/admin/web/AdminMainController.java`
- `src/main/java/egovframework/com/feature/admin/web/AdminObservabilityController.java`
- `src/main/java/egovframework/com/feature/admin/web/AdminObservabilityPageService.java`
- `src/main/java/egovframework/com/feature/admin/web/AdminSystemCodeController.java`
- `src/main/java/egovframework/com/feature/admin/mapper/AdminNotificationHistoryMapper.java`
- `src/main/resources/egovframework/mapper/com/common/ObservabilityMapper.xml`
- `src/main/resources/egovframework/mapper/com/feature/admin/AdminNotificationHistoryMapper.xml`
- `docs/sql/20260330_admin_notification_history.sql`

## Runtime And Generated Output Files In Play

- `ops/scripts/start-18000.sh`
- `src/main/resources/static/react-app/.vite/manifest.json`
- `src/main/resources/static/react-app/index.html`
- `src/main/resources/static/react-app/assets/**`

## Existing Durable Context To Reopen

- `docs/ai/session-notes/builder-master-summary.md`
- `docs/ai/session-notes/builder-10-verification-docs.md`
- `docs/architecture/tmux-multi-account-delivery-playbook.md`
- `docs/operations/operator-session-map.md`

## Non-Overlap Decision

- do not open a second lane that edits `frontend/src/app/routes/**`
- do not open a second lane that edits `src/main/resources/egovframework/mapper/com/common/ObservabilityMapper.xml`
- do not treat `src/main/resources/static/react-app/**` as a feature-lane workspace
