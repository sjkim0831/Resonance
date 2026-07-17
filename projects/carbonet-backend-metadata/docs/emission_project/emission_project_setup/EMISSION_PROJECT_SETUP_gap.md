# EMISSION_PROJECT_SETUP Gap Document

## Job Context
- **Job ID**: 272
- **process**: EMISSION_PROJECT
- **step**: EMISSION_PROJECT_SETUP
- **type**: FRONTEND_ADMIN
- **target**: `/admin/emission/management` (route: `emission-management`)
- **page**: `EmissionManagementMigrationPage.tsx`
- **commit**: 8a6209bac375bd3718b6d9b0eb74c2f71efd9d89

## Screen Implementation Status

### Already Implemented
The page `projects/carbonet-frontend/source/src/features/emission-management/EmissionManagementMigrationPage.tsx` exists with comprehensive functionality (~4414 lines):

- Category/Tier selection wizard
- Variable input management with formula display
- Element definition registry management
- Input session lifecycle (create, save, calculate)
- Scope status tracking (publish → materialize → runtime → primary)
- Precheck and materialization workflows
- Lime default factor handling
- Calculation result display with factor cards
- Classification catalog panel integration
- Definition scope management
- Activity feed and evidence tracking

### Blocking Issue: Design Basis Not Registered
- **screenDevelopmentBasis**: "미등록 - 구현 착수 전에 해당 화면의 설계 버튼에서 기준을 등록해야 함"
- **noteRequiredBeforeImplementation**: true

The screen design basis is **NOT registered** in the build-studio. According to the job specification, the design basis must be registered before implementation proceeds. This is a **blocking condition**.

## Required Actions

### 1. Register Design Basis (BLOCKING)
Before full implementation can be considered complete, the design basis for `/admin/emission/management` must be registered through the build-studio UI:
- Navigate to the design button on the emission-management screen
- Register the compiled screen design reference
- Register KRDS design tokens and components used

### 2. Actor Test Contract Evidence
The specification mentions "액터 테스트 계약 구현" (actor test contract implementation). The following actor test evidence may be needed:
- Verify calculation flow with different user roles (ROLE_SYSTEM_MASTER, ROLE_SYSTEM_ADMIN, ROLE_ADMIN, ROLE_OPERATION_ADMIN)
- Verify scope lifecycle transitions (DRAFT → PUBLISHED → MATERIALIZED → RUNTIME_READY → PRIMARY_ACTIVE)
- Verify permission boundaries and tenant isolation

## Actor Test Contract Status

### Existing Test Evidence
The actor test contract is partially verified through SQL orchestration tests:

1. **`verify-emission-actor-process-task-orchestration.sql`** - Validates:
   - Task process/actor binding contracts
   - Project actor assignments (e.g., COMPANY_MANAGER role binding)
   - Task status transitions (BLOCKED → READY → DONE)
   - Predecessor dependency handling

2. **`verify-emission-tenant-isolation.sql`** - Validates:
   - Cross-tenant access prevention
   - Tenant-scoped data visibility

### Remaining Actor Test Gaps
- UI-level actor permission tests (browser tests at mobile/tablet/desktop)
- API contract tests for AdminEmissionManagementService endpoints
- Calculation workflow actor authorization tests

## References
- Route definition: `projects/carbonet-frontend/source/src/app/routes/families/emissionMonitoringFamily.ts`
- Page implementation: `projects/carbonet-frontend/source/src/features/emission-management/EmissionManagementMigrationPage.tsx`
- Service interface: `modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/service/AdminEmissionManagementService.java`
- Service impl: `AdminEmissionManagementServiceImpl.java`
- Build-studio: `/admin/system/build-studio` (SDUI control plane for design basis registration)
- Actor test SQL: `ops/tests/verify-emission-actor-process-task-orchestration.sql`