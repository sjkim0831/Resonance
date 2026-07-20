#!/usr/bin/env bash
set -euo pipefail

paths="$(cat)"
if [[ -z "$paths" ]]; then
  echo full
elif ! grep -Evi '/[^/]*(menu|navigation)[^/]*\.sql$' <<<"$paths" | grep -q .; then
  echo menu
elif ! grep -Evi '/[^/]*(actor|process|governance|delivery|workflow|handoff|notification|assignment|assignee|emission_site|onboarding|gnb|component|design|theme|section|page|screen|builder|asset)[^/]*\.sql$' <<<"$paths" | grep -q .; then
  echo governance
elif ! grep -Evi '/[^/]*(activity|submission|quality|evidence|collection|acceptance|accepted|calculation|factor|mapping)[^/]*\.sql$' <<<"$paths" | grep -q .; then
  echo activity
else
  echo full
fi
