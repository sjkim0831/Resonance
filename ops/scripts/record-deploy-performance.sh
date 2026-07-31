#!/usr/bin/env bash
set -euo pipefail

mode="${1:?deployment mode is required}"
revision="${2:?revision is required}"
elapsed_ms="${3:?elapsed milliseconds are required}"
root="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
state_dir="${CARBONET_DEPLOY_PERFORMANCE_DIR:-$root/var/run/deploy-performance}"
history_file="$state_dir/history.jsonl"
latest_file="$state_dir/latest.json"
diagnostic_file="$state_dir/diagnostic-required.env"
phase_history_file="$state_dir/phase-history.jsonl"
phase_latest_file="$state_dir/phase-latest.json"
phase_file="${CARBONET_DEPLOY_PHASE_FILE:-}"

[[ "$elapsed_ms" =~ ^[0-9]+$ ]] || {
  echo "[deploy-performance] invalid elapsed milliseconds: $elapsed_ms" >&2
  exit 2
}

case "$mode" in
  catalog|automation) target_ms="${CARBONET_FAST_DEPLOY_TARGET_MS:-15000}" ;;
  frontend|runtime|backstage) target_ms="${CARBONET_RUNTIME_DEPLOY_TARGET_MS:-60000}" ;;
  *) echo "[deploy-performance] unsupported mode: $mode" >&2; exit 2 ;;
esac
hard_limit_ms="${CARBONET_DEPLOY_HARD_LIMIT_MS:-120000}"
verification_target_ms="${CARBONET_DEPLOY_VERIFICATION_TARGET_MS:-90000}"

build_duration_seconds=0
release_manifest="$root/var/ai-runtime/k8s-release-manifest.jsonl"
if [[ -s "$release_manifest" ]]; then
  build_duration_seconds="$(
    tail -n 1 "$release_manifest" |
      jq -r '.duration // 0' 2>/dev/null || echo 0
  )"
fi

# Runtime-style deployments have two distinct operator promises:
#   1. the changed service is built and ready within 60 seconds;
#   2. the complete fail-closed contract suite finishes within 90 seconds.
# The release manifest is written only after rollout readiness and therefore
# measures the first promise without counting Git preparation or post-deploy
# governance checks. Fast metadata deployments continue to use wall time.
slo_elapsed_ms="$elapsed_ms"
if [[ "$mode" =~ ^(frontend|runtime|backstage)$ ]] \
   && [[ "$build_duration_seconds" =~ ^[0-9]+$ ]] \
   && (( build_duration_seconds > 0 )); then
  slo_elapsed_ms=$((build_duration_seconds * 1000))
fi

mkdir -p "$state_dir"
exec 8>"$state_dir/.lock"
flock -w 5 8

phase_summary='[]'
slowest_phase=""
slowest_phase_ms=0
regressed_phases='[]'
if [[ -n "$phase_file" && -s "$phase_file" ]]; then
  if ! jq -e -s '
      length > 0 and
      all(.[]; (.phase | type == "string") and
        (.durationMs | type == "number") and .durationMs >= 0)
    ' "$phase_file" >/dev/null; then
    echo "[deploy-performance] invalid phase telemetry: $phase_file" >&2
    jq -c . "$phase_file" >&2 || true
    exit 3
  fi

  phase_summary="$(
    jq -s '
      group_by(.phase)
      | map({phase:.[0].phase,durationMs:(map(.durationMs) | add)})
      | sort_by(-.durationMs)
    ' "$phase_file"
  )"
  slowest_phase="$(jq -r '.[0].phase // ""' <<<"$phase_summary")"
  slowest_phase_ms="$(jq -r '.[0].durationMs // 0' <<<"$phase_summary")"

  phase_baselines='{}'
  if [[ -s "$phase_history_file" ]]; then
    phase_baselines="$(
      jq -s '
        group_by(.phase)
        | map({
            key:.[0].phase,
            value:(
              map(.durationMs) | .[-20:] | sort |
              {
                sampleCount:length,
                p50Ms:(if length == 0 then 0 else .[length / 2 | floor] end),
                p95Ms:(if length == 0 then 0 else .[((length * 95 / 100) | ceil) - 1] end)
              }
            )
          })
        | from_entries
      ' "$phase_history_file"
    )"
  fi

  phase_summary="$(
    jq -c --argjson baselines "$phase_baselines" '
      map(
        . as $phase |
        ($baselines[$phase.phase] // {sampleCount:0,p50Ms:0,p95Ms:0}) as $baseline |
        . + $baseline + {
          regressed:(
            $baseline.sampleCount >= 5 and $baseline.p50Ms > 0 and
            $phase.durationMs > (($baseline.p50Ms * 125 / 100) | ceil)
          )
        }
      )
    ' <<<"$phase_summary"
  )"
  regressed_phases="$(jq -c '[.[] | select(.regressed) | .phase]' <<<"$phase_summary")"
fi

baseline_ms="$(
  if [[ -s "$history_file" ]]; then
    jq -rs --arg mode "$mode" '
      [ .[] | select(.mode == $mode and .status == "PASS") | (.sloElapsedMs // .elapsedMs) ]
      | .[-10:]
      | if length == 0 then 0 else sort | .[length / 2 | floor] end
    ' "$history_file"
  else
    echo 0
  fi
)"
regression_limit_ms="$target_ms"
if (( baseline_ms > 0 )); then
  baseline_limit_ms=$(( baseline_ms * 125 / 100 ))
  (( baseline_limit_ms > regression_limit_ms )) &&
    regression_limit_ms="$baseline_limit_ms"
fi

status="PASS"
reason="WITHIN_TARGET"
if (( elapsed_ms > hard_limit_ms )); then
  status="SLO_BREACH"
  reason="HARD_LIMIT_EXCEEDED"
elif (( elapsed_ms > verification_target_ms )); then
  status="SLO_BREACH"
  reason="VERIFICATION_TARGET_EXCEEDED"
elif (( slo_elapsed_ms > regression_limit_ms )); then
  status="SLO_BREACH"
  reason="READY_TARGET_OR_25_PERCENT_REGRESSION"
fi

record="$(
  jq -cn \
    --arg timestamp "$(date -Iseconds)" \
    --arg mode "$mode" \
    --arg revision "$revision" \
    --arg status "$status" \
    --arg reason "$reason" \
    --argjson elapsedMs "$elapsed_ms" \
    --argjson sloElapsedMs "$slo_elapsed_ms" \
    --argjson targetMs "$target_ms" \
    --argjson verificationTargetMs "$verification_target_ms" \
    --argjson hardLimitMs "$hard_limit_ms" \
    --argjson baselineMs "$baseline_ms" \
    --argjson regressionLimitMs "$regression_limit_ms" \
    --argjson buildDurationSeconds "$build_duration_seconds" \
    --arg slowestPhase "$slowest_phase" \
    --argjson slowestPhaseMs "$slowest_phase_ms" \
    --argjson phaseSummary "$phase_summary" \
    --argjson regressedPhases "$regressed_phases" \
    '{
      timestamp:$timestamp,mode:$mode,revision:$revision,status:$status,
      reason:$reason,elapsedMs:$elapsedMs,sloElapsedMs:$sloElapsedMs,
      targetMs:$targetMs,verificationTargetMs:$verificationTargetMs,
      hardLimitMs:$hardLimitMs,baselineMs:$baselineMs,
      regressionLimitMs:$regressionLimitMs,
      buildDurationSeconds:$buildDurationSeconds,
      slowestPhase:$slowestPhase,slowestPhaseMs:$slowestPhaseMs,
      phaseSummary:$phaseSummary,regressedPhases:$regressedPhases
    }'
)"
printf '%s\n' "$record" >>"$history_file"
printf '%s\n' "$record" >"${latest_file}.tmp"
mv "${latest_file}.tmp" "$latest_file"

# Publish the last successful deployment in the same bounded contract consumed
# by the operations dashboard. A systemd OnFailure handler overwrites this file
# only when a later deployment fails.
deploy_status_file="${CARBONET_DEPLOY_STATUS_FILE:-/opt/resonance-data/deploy/deploy-status.json}"
jq -n \
  --arg checkedAt "$(date -Iseconds)" \
  --arg status SUCCESS \
  --arg category NONE \
  --arg targetCommit "$revision" \
  --arg mode "$mode" \
  --argjson elapsedMs "$elapsed_ms" \
  '{checkedAt:$checkedAt,status:$status,category:$category,targetCommit:$targetCommit,mode:$mode,elapsedMs:$elapsedMs,retryAllowed:false,retryAttempted:false,evidence:""}' \
  >"${deploy_status_file}.tmp"
chmod 0644 "${deploy_status_file}.tmp"
mv "${deploy_status_file}.tmp" "$deploy_status_file"

if [[ "$(jq 'length' <<<"$phase_summary")" -gt 0 ]]; then
  jq -c --arg timestamp "$(date -Iseconds)" --arg mode "$mode" --arg revision "$revision" '
    .[] | {
      timestamp:$timestamp,mode:$mode,revision:$revision,
      phase:.phase,durationMs:.durationMs
    }
  ' <<<"$phase_summary" >>"$phase_history_file"
  jq -cn \
    --arg timestamp "$(date -Iseconds)" \
    --arg mode "$mode" \
    --arg revision "$revision" \
    --arg slowestPhase "$slowest_phase" \
    --argjson slowestPhaseMs "$slowest_phase_ms" \
    --argjson phases "$phase_summary" \
    --argjson regressedPhases "$regressed_phases" \
    '{
      timestamp:$timestamp,mode:$mode,revision:$revision,
      slowestPhase:$slowestPhase,slowestPhaseMs:$slowestPhaseMs,
      phases:$phases,regressedPhases:$regressedPhases
    }' >"${phase_latest_file}.tmp"
  mv "${phase_latest_file}.tmp" "$phase_latest_file"
fi

if [[ "$status" == "SLO_BREACH" ]]; then
  cat >"${diagnostic_file}.tmp" <<EOF
DEPLOY_PERFORMANCE_DIAGNOSTIC_REQUIRED=true
DEPLOY_PERFORMANCE_MODE=$mode
DEPLOY_PERFORMANCE_REVISION=$revision
DEPLOY_PERFORMANCE_ELAPSED_MS=$elapsed_ms
DEPLOY_PERFORMANCE_REASON=$reason
EOF
  mv "${diagnostic_file}.tmp" "$diagnostic_file"
  echo "[deploy-performance] WARN mode=$mode ready=${slo_elapsed_ms}ms verified=${elapsed_ms}ms target=${target_ms}ms verificationTarget=${verification_target_ms}ms baseline=${baseline_ms}ms reason=$reason" >&2
else
  rm -f "$diagnostic_file"
  echo "[deploy-performance] PASS mode=$mode ready=${slo_elapsed_ms}ms verified=${elapsed_ms}ms target=${target_ms}ms verificationTarget=${verification_target_ms}ms baseline=${baseline_ms}ms slowest=${slowest_phase:-none}:${slowest_phase_ms}ms"
fi
