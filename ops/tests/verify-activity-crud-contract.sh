#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
controller="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java"
service="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
test_file="$ROOT/modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/feature/home/web/EmissionProjectRegistryControllerAuthenticationTest.java"
for file in "$controller" "$service" "$test_file"; do [[ -s "$file" ]] || { echo "missing $file" >&2; exit 1; }; done
grep -Fq '@GetMapping({"/home/api/emission-projects/{id}/activities/{activityId}"' "$controller"
grep -Fq '@PostMapping({"/home/api/emission-projects/{id}/activities/{activityId}"' "$controller"
grep -Fq '@DeleteMapping({"/home/api/emission-projects/{id}/activities/{activityId}"' "$controller"
grep -Fq 'if(!c.isAuthenticated()) return ResponseEntity.status(401)' "$controller"
grep -Fq 'requireProjectActor(projectId,tenant,user,"SITE_DATA_OWNER",override)' "$service"
grep -Fq 'ACTIVITY_DELETE_BLOCKED_BY_DEPENDENCY' "$service"
grep -Fq "'ACTIVITY_UPDATED'" "$service"
grep -Fq "'ACTIVITY_DELETED'" "$service"
grep -Fq 'activityDeleteDependencyConflictIsReportedWithoutDeleting' "$test_file"
printf '{"status":"PASS","routes":3,"auth":true,"dependencyGuard":true,"auditEvents":2}\n'
