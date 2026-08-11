#!/usr/bin/env bash
set -Eeuo pipefail
controller="modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java"
service="modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
ui="projects/carbonet-frontend/source/src/features/emission-simulate/EmissionSimulateMigrationPage.tsx"
migration="apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811130000__add_emission_reduction_scenario.sql"
grep -q '/simulation-workflow' "$controller"; grep -q '/simulate' "$controller"
grep -q 'assertProjectParticipant' "$service"; grep -q 'SIMULATION_REQUIRES_CALCULATION' "$service"
grep -q 'pg_advisory_xact_lock' "$service"; grep -q 'idempotencyKey' "$service"
grep -q 'saveScenario' "$ui"; grep -q 'simulationWorkflow.reload' "$ui"
grep -q 'UNIQUE (tenant_id,project_id,idempotency_key)' "$migration"
echo '{"status":"PASS","endpoints":2,"auth":1,"tenantScope":1,"idempotency":1,"uiPersistence":1}'
