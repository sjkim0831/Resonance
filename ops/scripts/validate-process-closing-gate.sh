#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${PGDATABASE:-carbonet}"
leader=""

for pod in $(kubectl -n "$NAMESPACE" get pods -l application=spilo -o name 2>/dev/null | sed 's#pod/##'); do
  recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
  if [[ "$recovery" == "f" ]]; then leader="$pod"; break; fi
done

if [[ -z "$leader" ]]; then
  for pod in postgres-patroni-0 postgres-patroni-1 postgres-patroni-2; do
    recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
    if [[ "$recovery" == "f" ]]; then leader="$pod"; break; fi
  done
fi

[[ -n "$leader" ]] || { echo "PROCESS_CLOSING_FAIL reason=postgres-leader-not-found"; exit 2; }

read -r total steps closed review blocked structural routes implementation bound_steps approved_tests automated_tests passed_tests optional_route_steps guided_steps < <(
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d "$DATABASE" -AtF ' ' -c "
    with assurance as (
      select count(*) total,coalesce(sum(step_count),0) steps,
             count(*) filter(where design_blocker_count=0 and approved_safety_test_type_count=5) closed,
             count(*) filter(where design_blocker_count=0 and approved_safety_test_type_count<5) review,
             count(*) filter(where design_blocker_count>0) blocked,
             coalesce(sum(design_blocker_count),0) structural,
             coalesce(sum(missing_user_route_count+missing_admin_route_count),0) routes,
             count(*) filter(where assurance_status='IMPLEMENTATION_VERIFIED') implementation
        from framework_process_design_assurance_matrix
    ), step_evidence as (
      select count(*) filter(where exists(
               select 1 from framework_step_test_binding binding
                where binding.process_code=step.process_code and binding.step_code=step.step_code
             )) bound_steps,
             count(*) filter(where not step.requires_user_page and not step.requires_admin_page
                               and coalesce(nullif(step.user_path,''),nullif(step.admin_path,'')) is null) optional_route_steps,
             count(*) filter(where exists(
               select 1 from framework_step_guidance_contract guidance
                where guidance.process_code=step.process_code and guidance.step_code=step.step_code
                  and guidance.use_at='Y'
             )) guided_steps
        from framework_process_step step
    ), test_evidence as (
      select count(*) filter(where simulation.case_status='APPROVED') approved_tests,
             count(*) filter(where simulation.case_status='APPROVED' and simulation.automated) automated_tests,
             count(*) filter(where simulation.case_status='APPROVED' and exists(
               select 1 from framework_simulation_run run
                where run.case_code=simulation.case_code and run.result='PASSED'
             )) passed_tests
        from framework_simulation_case simulation
    )
    select assurance.*,
           step_evidence.bound_steps,
           test_evidence.approved_tests,test_evidence.automated_tests,test_evidence.passed_tests,
           step_evidence.optional_route_steps,step_evidence.guided_steps
      from assurance cross join step_evidence cross join test_evidence" | tr -d '\r'
)

echo "PROCESS_CLOSING total=$total steps=$steps design_closed=$closed review=$review blocked=$blocked structural_blockers=$structural missing_required_routes=$routes implementation_closed=$implementation"
echo "PROCESS_TEST_CLOSING bound_steps=$bound_steps/$steps approved=$approved_tests automated=$automated_tests passed=$passed_tests optional_route_steps=$optional_route_steps guided_steps=$guided_steps/$steps"

if [[ "$total" -eq 0 || "$closed" -ne "$total" || "$review" -ne 0 || "$blocked" -ne 0 || "$structural" -ne 0 || "$routes" -ne 0 ]]; then
  echo "PROCESS_CLOSING_FAIL reason=design-contract-open"
  exit 1
fi

if [[ "$bound_steps" -ne "$steps" || "$automated_tests" -ne "$approved_tests" || "$passed_tests" -ne "$approved_tests" ]]; then
  echo "PROCESS_CLOSING_FAIL reason=test-evidence-open"
  exit 1
fi

echo "PROCESS_CLOSING_PASS next_gate=SCREEN_DESIGN_CLOSING"
