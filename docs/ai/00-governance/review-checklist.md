# Review Checklist

Use this checklist for AI-assisted changes:

- Is the target screen listed in `20-ui/screen-index.csv`?
- Are changed UI events reflected in `20-ui/event-map.csv`?
- Are affected endpoints reflected in `40-backend/api-catalog.csv`?
- Are changed tables reflected in `50-data/table-screen-api-map.csv`?
- Did the change alter workflow states or status transitions?
- Did the change alter role-based access or menu exposure?
- Did Korean and English routes remain aligned where required?
- Did the change introduce admin-review, reject, or reapply gaps?
- Were risky operational side effects added to `60-operations/known-risk-areas.md`?
- Did the change create new local-only files, generated outputs, env files, cache folders, logs, or uploads that require a `.gitignore` update?
