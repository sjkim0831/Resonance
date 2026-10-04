# Project portfolio layout policy — 2026-09-29

Target: `/emission/project-portfolio` and `/en/emission/project-portfolio`.

The live component directly rendered `EmissionPageIntro` and five statistics buttons. No generator references this component in the inspected `source/scripts` or `ops/scripts`; deleting only a screenshot annotation never changed the page.

Layout contract: `src/features/emission-project-list/emissionProjectPortfolioLayout.json`.

- One plain page title, followed by existing search and project selection.
- No introduction hero/category/description or five summary statistics cards.
- No duplicate link to `/emission/project_list`.
- No quick-menu buttons for my tasks, deadlines, assignment, or completed projects. Their destination pages remain available through their existing routes. The same forbidden-link gate prevents these four buttons from returning to the portfolio component.
- No STEP 1 COMPLETION panel or its five display-only checklist items. The project list uses the available full width. Workflow loading/error messages remain visible; server authorization and work execution are unchanged.
- New project action belongs in the project list header; destination remains `/emission/project/create`.
- Existing filters, project selection, authorization and subsequent work remain in the component.
- Other pages and the shared `EmissionPageIntro` component are outside this change.

`npm run verify:portfolio-layout` parses the actual TSX, enforces the contract, and proves rejection of three representative reintroductions. It runs before development startup/build and before/after `npm run generate:screens`. Direct file writes still require running the gate; this is not a file-write prohibition or automatic rollback.

The definition DB, business process contracts, backend and production runtime are not changed. This policy governs this page's presentation source and generation lifecycle only.

## Verification

- Development proxy routes the frontend to port 5175; its process cwd is `/opt/Resonance/projects/carbonet-frontend/source`.
- `npm run verify:portfolio-layout`: PASS; three representative forbidden mutations rejected.
- Vite transformed the updated TSX successfully (HTTP 200). No full build or service restart was required for this development change.
- Live browser at `http://172.16.1.232/emission/project-portfolio`: one page heading followed by search; summary cards and duplicate list link absent; new-project link in list header; 18 existing projects rendered.
- Actual screenshots: `after.png`, `list-after.png` beside the local copy of this document. These are browser captures, not generated mockups.
- Backup on development server: `/opt/Resonance/var/change-backups/portfolio-layout-20260929` (48 KB).
- Full business-flow E2E was not run for this presentation-only change.
