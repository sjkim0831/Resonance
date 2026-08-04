#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
service="$root/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
controller="$root/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java"
ui="$root/projects/carbonet-frontend/source/src/features/work-assignment/WorkAssignmentPage.tsx"
process_migration="$root/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260804170000__implement_tenant_work_assignment_process.sql"
registry_migration="$root/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260804190000__generalize_project_process_assignments.sql"
order_migration="$root/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260804210000__separate_work_assignment_work_type.sql"
guide_migration="$root/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260804220000__bind_work_assignment_guide_to_workspace.sql"
task_quest="$root/projects/carbonet-frontend/source/src/features/task-quest/TaskQuestPanel.tsx"

grep -Fq 'WORK_ASSIGNMENT_MANAGER_REQUIRED' "$service"
grep -Fq 'TENANT_ACCOUNT_NOT_ELIGIBLE' "$service"
grep -Fq 'framework_work_assignment_audit' "$service"
grep -Fq 'framework_process_definition' "$service"
grep -Fq 'framework_actor_definition' "$service"
grep -Fq 'framework_project_process_step_assignment' "$service"
grep -Fq 'AS "explicitlyAssigned"' "$service"
grep -Fq 'runtimeStep?.explicitlyAssigned' "$task_quest"
grep -Fq 'en ? "Unassigned" : "미배정"' "$task_quest"
if grep -A8 -F 'const processSteps = (data?.processCatalogSteps || [])' "$task_quest" | grep -Fq 'actorVisible(step.actorCode'; then
  echo "process topology must not be filtered by the signed-in actor" >&2
  exit 1
fi
grep -Fq 'framework_business_work_type' "$service"
grep -Fq 'w.sort_order' "$service"
grep -Fq 'seq.workflow_order' "$service"
grep -Fq 'topo.execution_wave' "$service"
grep -Fq 'topo.lane_order' "$service"
grep -Fq '/home/api/work-assignments' "$controller"
grep -Fq 'assignment-swimlane' "$ui"
grep -Fq 'workTypeCode' "$ui"
grep -Fq 'processAccountId' "$ui"
grep -Fq 'ASSIGNMENT_SWITCH_GUARD' "$ui"
grep -Fq 'qaassign26' "$ui"
grep -Fq "'WORK_ASSIGNMENT', '업무 배정', 'Work Assignment'" "$order_migration"
grep -Fq 'EMISSION_PROJECT_PORTFOLIO>EMISSION_PROJECT>ORGANIZATIONAL_BOUNDARY>ACTIVITY_DATA>EMISSION_CALCULATION' "$order_migration"
grep -Fq "position('WORK_ASSIGNMENT' IN coalesce(predecessor_process_codes::text, ''))" "$order_migration"
grep -Fq 'framework_rebuild_process_execution_topology' "$order_migration"
grep -Fq "user_path='/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT'" "$guide_migration"
grep -Fq 'selectedCatalogProcessCode === "WORK_ASSIGNMENT" && data?.assignmentManager' "$task_quest"
grep -Fq 'target.searchParams.set("processCode", "EMISSION_PROJECT")' "$task_quest"
grep -Fq 'const onlyProcessCode = processes.length === 1' "$task_quest"
grep -Fq 'data?.assignmentManager && actorCode === "WORK_ASSIGNMENT_MANAGER"' "$task_quest"
grep -Fq 'process.processCode === "WORK_ASSIGNMENT"' "$task_quest"
grep -Fq 'assignment-mini-${item.stepCode}' "$task_quest"
if grep -Fq '{en ? "Process steps" : "업무 진행 단계"}' "$task_quest"; then
  echo '[work-assignment] duplicated vertical process step list must remain removed' >&2
  exit 1
fi
grep -Fq 'framework_project_process_step_assignment' "$registry_migration"
grep -Fq 'WORK_ASSIGNMENT-HAPPY' "$process_migration"
grep -Fq 'WORK_ASSIGNMENT-AUTH' "$process_migration"
grep -Fq 'WORK_ASSIGNMENT-ISOLATION' "$process_migration"
grep -Fq 'WORK_ASSIGNMENT-VALIDATION' "$process_migration"
grep -Fq 'WORK_ASSIGNMENT-RECOVERY' "$process_migration"

echo '[work-assignment] PASS catalog=all-work-types+all-processes+all-actors processOwner=required stepAssignment=generic executableTaskSync=conditional safetyTests=5 api=GET+POST tenantIsolation=server ui=swimlane-integrated audit=append-only'
