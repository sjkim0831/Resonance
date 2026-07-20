#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DB="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"
leader=""

while IFS= read -r pod; do
  if [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
    leader="$pod"
    break
  fi
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')

[[ -n "$leader" ]] || {
  echo "[unified-work-design] Patroni leader was not found" >&2
  exit 1
}

IFS='|' read -r process_count assurance_count active_work_type_count work_type_count project_binding_count embedded_assurance_count invalid_generated_count required_page_count page_design_count incomplete_page_count field_count required_field_count handoff_gap_count owner_gap_count <<<"$(
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -At -F '|' -c "
      select
        (select count(*) from framework_process_definition),
        (select count(*) from framework_process_design_assurance_matrix),
        (select count(*) from framework_business_work_type where use_at='Y'),
        (select count(*) from framework_work_type_design_assurance),
        (select count(*) from framework_project_process_applicability),
        (select count(*) from framework_project_process_applicability
          where criteria_snapshot ? 'designAssuranceStatus'
            and criteria_snapshot ? 'designAccuracyScore'
            and criteria_snapshot ? 'designNextAction'),
        (select count(*)
           from emission_project_task t
           join framework_process_design_assurance_matrix m
             on framework_task_matches_process(t.process_code,t.task_code,m.process_code)
          where m.assurance_status='DESIGN_BLOCKED'
            and t.task_code like 'AUTO\\_%' escape '\\'),
        (select coalesce(sum((requires_user_page::integer)+(requires_admin_page::integer)),0) from framework_process_step),
        (select count(*) from framework_page_design),
        (select incomplete_page_count from framework_page_design_summary),
        (select field_count from framework_page_design_summary),
        (select required_field_count from framework_page_design_summary),
        (select count(*) from framework_process_step s
          where exists(select 1 from framework_process_step n where n.process_code=s.process_code and n.step_order>s.step_order)
            and not exists(select 1 from framework_process_data_handoff h
              where h.process_code=s.process_code and h.from_step_code=s.step_code and h.handoff_type='STEP')),
        (select count(*) from framework_process_definition p
          where nullif(btrim(p.owner_actor_code),'') is null
             or not exists(select 1 from framework_actor_definition a where a.actor_code=p.owner_actor_code and a.use_at='Y'));
    "
)"

[[ "$process_count" == "$assurance_count" ]] || {
  echo "[unified-work-design] process assurance coverage mismatch: process=$process_count assurance=$assurance_count" >&2
  exit 2
}
[[ "$active_work_type_count" == "$work_type_count" ]] || {
  echo "[unified-work-design] work type assurance coverage mismatch: active=$active_work_type_count assurance=$work_type_count" >&2
  exit 3
}
[[ "$project_binding_count" == "$embedded_assurance_count" ]] || {
  echo "[unified-work-design] project applicability snapshot mismatch: binding=$project_binding_count embedded=$embedded_assurance_count" >&2
  exit 4
}
[[ "$invalid_generated_count" == "0" ]] || {
  echo "[unified-work-design] design-blocked processes have generated runtime tasks: $invalid_generated_count" >&2
  exit 5
}
[[ "$required_page_count" == "$page_design_count" ]] || {
  echo "[unified-work-design] required page design mismatch: required=$required_page_count designed=$page_design_count" >&2
  exit 6
}
[[ "$incomplete_page_count" == "0" ]] || {
  echo "[unified-work-design] incomplete field contracts: $incomplete_page_count" >&2
  exit 7
}
[[ "$field_count" -ge "$((page_design_count * 10))" && "$required_field_count" -ge "$((page_design_count * 5))" ]] || {
  echo "[unified-work-design] insufficient professional fields: pages=$page_design_count fields=$field_count required=$required_field_count" >&2
  exit 8
}
[[ "$handoff_gap_count" == "0" ]] || {
  echo "[unified-work-design] missing step data handoffs: $handoff_gap_count" >&2
  exit 9
}
[[ "$owner_gap_count" == "0" ]] || {
  echo "[unified-work-design] process owner gaps: $owner_gap_count" >&2
  exit 10
}

echo "[unified-work-design] PASS processes=$process_count work-types=$work_type_count pages=$page_design_count fields=$field_count handoffs=complete project-bindings=$project_binding_count invalid-generated=0"
