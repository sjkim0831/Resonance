#!/usr/bin/env bash
set -euo pipefail
root=/home/sjkim/OmniverseProjects/p006-bulk-coverage-v1
kit=/home/sjkim/kit-app-template/_build/linux-x86_64/release
exec "$kit/kit/kit" "$kit/apps/my_company.my_editormy_omniverse_app.kit" --no-window --exec "$root/render-bulk-coverage.py" --/app/window/enabled=false --/app/extensions/registryEnabled=false --/log/file="$root/render.log" --/persistent/app/viewport/displayOptions=0
