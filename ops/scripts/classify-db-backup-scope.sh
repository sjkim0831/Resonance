#!/usr/bin/env bash
set -euo pipefail

paths="$(cat)"
if [[ -z "$paths" ]]; then
  echo full
elif ! grep -Evi '/[^/]*(menu|navigation)[^/]*\.sql$' <<<"$paths" | grep -q .; then
  echo menu
elif ! grep -Evi '/[^/]*(actor|process|governance|delivery|workflow|topology|portfolio|handoff|notification|assignment|assignee|emission_site|onboarding|gnb|component|design|theme|section|page|screen|builder|asset|contract|professional)[^/]*\.sql$' <<<"$paths" | grep -q .; then
  echo governance
elif ! grep -Evi '/[^/]*(activity|submission|quality|evidence|collection|acceptance|accepted|calculation|factor|mapping)[^/]*\.sql$' <<<"$paths" | grep -q .; then
  echo activity
elif ! grep -Evi '/[^/]*(account|member|identity|credential|password|signin|login|auth|recovery|session|token)[^/]*\.sql$' <<<"$paths" | grep -q .; then
  echo identity
else
  echo full
fi
