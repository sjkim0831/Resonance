#!/usr/bin/env bash
set -Eeuo pipefail
fixture='{"contracts":[{"contractId":1},{"contractId":2},{"contractId":3}]}'
statuses='{"1":"VERIFIED","2":"DESIGN_COMPLETE"}'
actual="$(jq -c --argjson statuses "$statuses" '.contracts |= map(.contractStatus = ($statuses[(.contractId|tostring)] // "REVIEW_REQUIRED"))' <<<"$fixture")"
jq -e '.contracts[0].contractStatus=="VERIFIED" and .contracts[1].contractStatus=="DESIGN_COMPLETE" and .contracts[2].contractStatus=="REVIEW_REQUIRED"' <<<"$actual" >/dev/null
echo '{"status":"PASS","verified":1,"designComplete":1,"reviewRequiredFallback":1}'
