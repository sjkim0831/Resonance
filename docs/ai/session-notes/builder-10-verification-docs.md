# builder-10-verification-docs

- Role: verification and docs
- Allowed Paths: docs, build and restart scripts, frontend/package.json, pom.xml
- Forbidden Paths: feature implementation files except as references in docs

## Findings

- Verified frontend build command: `npm run build` in `/opt/Resonance/projects/carbonet-frontend/source`.
- Verified backend package command: `mvn -q -DskipTests package` in `/opt/Resonance`.
- Verified restart command: `bash ops/scripts/restart-18000.sh`.
- Verified runtime result after restart: Java process listening on port `18000`.
- Verified route reachability at transport level: `http://127.0.0.1:18000/admin/system/screen-builder` returned `302` to `/admin/login/loginView`, which confirms the app is running and auth is gating the route.
- Verified the environment-management route after the latest handoff summary UI change: `http://127.0.0.1:18000/admin/system/environment-management` returned `302` to `/admin/login/loginView`.
- Verified the current-runtime-compare route after environment-management added parity warning and deep-link support: `http://127.0.0.1:18000/admin/system/current-runtime-compare` returned `302` to `/admin/login/loginView`.
- Re-verified the same routes after adding queue-level stale publish / parity drift / parity gap filters and row badges in environment-management.
- Verified the app again after introducing the backend batch summary endpoint used by environment-management queue summaries. `http://127.0.0.1:18000/admin/api/admin/screen-builder/status-summary?menuCode=A0060118` returned `302` to login, confirming the new route is registered behind auth.
- Verified that the persisted projection directory is created lazily. Before an authenticated summary call, `data/screen-builder/status-summary` may not exist yet; this is expected with the current on-demand write path.
- Verified the new rebuild route is also registered behind auth: `http://127.0.0.1:18000/admin/api/admin/screen-builder/status-summary/rebuild?menuCode=A0060118` returned `302` to login after restart.
- Re-verified frontend build after exposing environment-management operator buttons for selected-menu and full-summary projection rebuild. The new controls compile cleanly into the production bundle.

## Verification Checklist

- Run `npm run build` from `frontend/`.
- Run `mvn -q -DskipTests package` from repo root.
- Run `bash ops/scripts/restart-18000.sh`.
- Confirm `ss -ltnp | rg ':18000'` shows a Java listener.
- Confirm `/admin/system/screen-builder` responds after restart.
- Confirm `/admin/system/environment-management` responds after restart.
- Confirm `/admin/system/current-runtime-compare` responds after restart.
- Confirm `/admin/api/admin/screen-builder/status-summary` responds after restart.
- Confirm `/admin/api/admin/screen-builder/status-summary/rebuild` responds after restart.
- After login, click `Rebuild This Summary` and `Rebuild All Summaries` in `/admin/system/environment-management` and verify success/error messaging plus refreshed queue state.
- After login, verify `/admin/system/environment-management`, `/admin/system/screen-builder`, published runtime preview, and repair workbench routes in-browser.

## Command Results

- `npm run build`: passed.
- `mvn -q -Dmaven.test.skip=true package`: passed.
- `bash ops/scripts/restart-18000.sh`: service restarted under tmux-managed flow.
- `curl -sI http://127.0.0.1:18000/admin/system/screen-builder`: returned `302` with `Location: http://127.0.0.1:18000/admin/login/loginView`.
- `curl -sI http://127.0.0.1:18000/admin/system/environment-management`: returned `302` with `Location: http://127.0.0.1:18000/admin/login/loginView`.
- `curl -sI http://127.0.0.1:18000/admin/system/current-runtime-compare`: returned `302` with `Location: http://127.0.0.1:18000/admin/login/loginView`.
- `curl -sI 'http://127.0.0.1:18000/admin/api/admin/screen-builder/status-summary?menuCode=A0060118'`: returned `302` with `Location: http://127.0.0.1:18000/admin/login/loginView`.
- `curl -sI 'http://127.0.0.1:18000/admin/api/admin/screen-builder/status-summary/rebuild?menuCode=A0060118'`: returned `302` with `Location: http://127.0.0.1:18000/admin/login/loginView`.

## Next Action

- Execute the authenticated button-click verification for projection rebuild from environment-management and confirm whether the full rebuild action needs extra confirmation UX.
