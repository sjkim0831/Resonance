#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MAPPER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/util/ReactPageUrlMapper.java"
MAPPER_TEST="$ROOT/modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/common/util/ReactPageUrlMapperTest.java"
BROWSER="$ROOT/ops/scripts/validate-company-reapplication-browser.mjs"
TASK_PANEL="$ROOT/projects/carbonet-frontend/source/src/features/task-quest/TaskQuestPanel.tsx"
NOTE_PANEL="$ROOT/projects/carbonet-frontend/source/src/features/screen-development-note/ScreenDevelopmentNotePanel.tsx"

for file in "$MAPPER" "$MAPPER_TEST" "$BROWSER" "$TASK_PANEL" "$NOTE_PANEL"; do
  [[ -f "$file" ]] || { echo "[company-reapplication-route-guards] missing $file" >&2; exit 1; }
done

node - "$MAPPER" "$MAPPER_TEST" "$BROWSER" "$TASK_PANEL" "$NOTE_PANEL" <<'NODE'
const fs=require("node:fs");
const [mapperPath,mapperTestPath,browserPath,taskPath,notePath]=process.argv.slice(2);
const mapper=fs.readFileSync(mapperPath,"utf8");
const mapperTest=fs.readFileSync(mapperTestPath,"utf8");
const browser=fs.readFileSync(browserPath,"utf8");
const task=fs.readFileSync(taskPath,"utf8");
const note=fs.readFileSync(notePath,"utf8");
const assert=(value,message)=>{if(!value)throw new Error(message);};

assert(mapper.includes('"join-company-reapply", "/join/companyReapply", "/join/en/companyReapply"'),
  "public reapplication route is missing from the active React URL mapper");
assert(mapperTest.includes("resolvesCompanyReapplicationWithoutFallingBackToHome"),
  "route mapper regression test is missing");
assert(browser.includes("window.__CARBONET_REACT_APP_MOUNTED__===true")&&browser.includes('document.querySelector("#lookup-bizNo")'),
  "browser harness does not wait for the actual reapplication screen");
assert(browser.includes('submitButton.press("Enter")')&&browser.includes("submit did not issue POST")&&browser.includes("requiredValues"),
  "browser harness does not exercise keyboard submit with fail-closed diagnostics");
assert(!browser.includes('page.keyboard.press("Enter")'),
  "browser harness still relies on page-global keyboard focus");
assert(task.includes("const canLoadPrivateTasks=frontendSession.authenticated===true")&&task.includes("if(!canLoadPrivateTasks)"),
  "anonymous public pages can still call the private task API");
assert(note.includes("const canUseAdminDesignNotes=frontendSession.authenticated===true&&frontendSession.canEnterAdminConsole===true")&&note.includes("if(!canUseAdminDesignNotes)"),
  "non-admin pages can still call the admin design-note API");
console.log("[company-reapplication-route-guards] PASS route=1 mount=1 keyboardSubmit=1 diagnostics=1 anonymousApiGuards=2");
NODE
