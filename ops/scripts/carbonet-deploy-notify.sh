#!/usr/bin/env bash
set -euo pipefail

state_dir="${CARBONET_DEPLOY_STATE_DIR:-/opt/resonance-data/deploy}"
status_file="${CARBONET_DEPLOY_STATUS_FILE:-$state_dir/deploy-status.json}"
webhook_file="${CARBONET_TEAMS_WEBHOOK_FILE:-/opt/resonance-data/control-plane/secrets/teams-deploy-webhook.url}"
alert_history="$state_dir/deploy-alerts.jsonl"
dedupe_dir="$state_dir/notification-dedupe"
mkdir -p "$dedupe_dir"

[[ -s "$status_file" ]] || { echo "[deploy-notify] status file missing" >&2; exit 2; }
status="$(jq -r '.status // "UNKNOWN"' "$status_file")"
category="$(jq -r '.category // "UNKNOWN"' "$status_file")"
target="$(jq -r '.targetCommit // "unknown"' "$status_file")"
checked_at="$(jq -r '.checkedAt // ""' "$status_file")"
evidence="$(jq -r '.evidence // ""' "$status_file")"
dedupe_key="$(printf '%s|%s|%s' "$target" "$status" "$category" | sha256sum | awk '{print $1}')"
dedupe_marker="$dedupe_dir/$dedupe_key.notified"

if [[ -e "$dedupe_marker" ]]; then
  echo "[deploy-notify] duplicate suppressed key=${dedupe_key:0:12}"
  exit 0
fi

delivery=NOT_CONFIGURED
http_status=0
if [[ -s "$webhook_file" ]]; then
  webhook_url="$(tr -d '\r\n' <"$webhook_file")"
  payload="$(jq -n \
    --arg title "Resonance 자동 배포 $status" \
    --arg category "$category" \
    --arg target "${target:0:12}" \
    --arg checkedAt "$checked_at" \
    --arg evidence "$evidence" \
    '{type:"message",attachments:[{contentType:"application/vnd.microsoft.card.adaptive",contentUrl:null,content:{type:"AdaptiveCard",version:"1.4",body:[{type:"TextBlock",weight:"Bolder",size:"Medium",text:$title},{type:"FactSet",facts:[{title:"분류",value:$category},{title:"커밋",value:$target},{title:"발생 시각",value:$checkedAt},{title:"증적",value:$evidence}]}]}}]}')"
  http_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --max-time 10 --header 'Content-Type: application/json' --data "$payload" "$webhook_url" || true)"
  [[ "$http_status" =~ ^[0-9]{3}$ ]] || http_status=0
  if [[ "$http_status" =~ ^2[0-9][0-9]$ ]]; then
    delivery=SENT
  else
    delivery=FAILED
  fi
fi

alert="$(jq -cn \
  --arg createdAt "$(date -Iseconds)" \
  --arg status "$status" \
  --arg category "$category" \
  --arg targetCommit "$target" \
  --arg delivery "$delivery" \
  --argjson httpStatus "${http_status:-0}" \
  '{createdAt:$createdAt,status:$status,category:$category,targetCommit:$targetCommit,teamsDelivery:$delivery,httpStatus:$httpStatus}')"
printf '%s\n' "$alert" >>"$alert_history"
jq --argjson alert "$alert" '. + {alert:$alert}' "$status_file" >"${status_file}.tmp"
chmod 0644 "${status_file}.tmp"
mv "${status_file}.tmp" "$status_file"
: >"$dedupe_marker"
echo "[deploy-notify] status=$status category=$category teams=$delivery"
