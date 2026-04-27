# Resonance AI Working Docs

This folder holds documentation for the **Resonance AI Framework**, our core AI/Agent engine for faster, safer code changes and reviews.

## Resonance Core Documents

- **Architecture**: `10-architecture/resonance-ai-framework.md`
- **Design Patterns**: `docs/architecture/resonance-design-patterns.md`
- **Skill Patterns**: `80-skills/resonance-skill-and-doc-update-pattern.md`

## Principles

- keep source design documents separate from AI working summaries
- prefer CSV maps for cross-linking screens, APIs, tables, and permissions
- update these files together with code changes
- treat missing rows here as a risk signal during AI-assisted work
- when a task is driven by local design artifacts, use `/home/imaneya/workspace/화면설계` as the primary source workspace
- within that workspace, treat the top-level `1.`, `2.`, `3.`, `4.` HTML files as the first and most important entry points before drilling into detailed mirrors
- review `.gitignore` whenever a change introduces generated output, logs, local env files, uploads, caches, or new local tooling artifacts

Minimum update set for a new screen:

1. `20-ui/screen-index.csv`
2. `20-ui/event-map.csv`
3. `40-backend/api-catalog.csv`
4. `50-data/table-screen-api-map.csv`

Minimum update set for a workflow change:

1. relevant file under `30-domain/state-machines/`
2. `30-domain/code-dictionaries/status-codes.csv`
3. `40-backend/auth-policy.csv`
4. `60-operations/known-risk-areas.md` when the flow is operationally sensitive

Repository hygiene reminder:

- if a task creates new local-only files or directories, decide in the same turn whether they belong in Git or in `.gitignore`

Design-source reminder:

1. `/home/imaneya/workspace/화면설계/1. main_home_menu_designed.html`
2. `/home/imaneya/workspace/화면설계/2. main_home_menu.html`
3. `/home/imaneya/workspace/화면설계/3. admin_menu_dashboard.html`
4. `/home/imaneya/workspace/화면설계/4. requirements_gap_dashboard.html`
