# React Refresh And Cache Control

Use this document when frontend or backend changes must be visible immediately after a hard refresh.

## Goal

Meet both conditions at the same time:

- a hard refresh must load the newest shell and newest bundle
- repeat visits should still be fast

## Repository Standard

Use this split:

- React shell HTML and dynamic entry pages:
  - `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- built JS and CSS assets under `/react-migration/assets/`:
  - content-hash file names
  - long-lived immutable cache

This is the default standard for React migration pages in this repository.

## Why This Works

If the HTML shell is always fresh, the browser always receives the newest asset URLs.

If the asset URLs are hash-based, unchanged bundles stay cached and changed bundles are fetched immediately.

This avoids the common failure mode where `index.js` or `index.css` keeps an old browser cache after deployment.

## Required Implementation Pattern

### Frontend build

- keep `base: /react-migration/`
- enable Vite manifest output
- do not force fixed production asset names like `assets/index.js`
- allow hashed production file names

### Backend shell rendering

- resolve production JS and CSS from the Vite manifest
- cache the parsed manifest in memory and only reload when the manifest timestamp changes
- do not hardcode one static file name as the primary production asset path
- keep a fallback path only for recovery when the manifest is missing

### Backend response caching

- apply no-cache headers to the React shell views
- cache hashed assets aggressively

## Fastest Safe Workflow

When changing React migration code:

1. run the frontend build so the Vite manifest and hashed assets are regenerated
2. ensure Spring serves the updated static files
3. verify a hard refresh loads new hashed asset names
4. verify unchanged assets remain browser-cacheable

For local port `18000`, the repository default restart path is freshness-safe:

- `bash ops/scripts/build-restart-18000.sh`
- `bash ops/scripts/restart-18000.sh`

Reason:

- both commands rebuild frontend assets and package the backend jar before the runtime restart
- if you intentionally bypass that with `RESTART_MODE=runtime-only`, the runtime jar can still contain older React assets

When `CARBONET_REACT_APP_FS_OVERRIDE_ENABLED=true` is enabled for local `:18000`, the fast frontend-only path is:

- `bash ops/scripts/frontend-refresh-18000.sh`

That mode keeps Java runtime ownership in the packaged jar, but serves React assets from `src/main/resources/static/react-app` first. Verification must therefore compare the served manifest and asset responses against the filesystem override path, not just the jar contents.

## Verification Checklist

- shell response includes `Cache-Control: no-store`
- built assets under `/react-migration/assets/` use hashed filenames
- `.vite/manifest.json` exists in the built output
- shell template resolves JS and CSS from the manifest, not a fixed filename
- repeated shell requests do not re-parse the same unchanged manifest on every request
- after a rebuild, the asset filename changes when the bundle changes
- a hard refresh loads the new bundle without a stale-script issue

## AI Rule

When AI changes frontend build or React shell delivery, preserve this pattern unless the user explicitly asks to change the cache strategy.
