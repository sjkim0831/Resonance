# Request Flow Map

Document common request paths from UI to DB.

Suggested flow template:

`screen -> event -> frontend function -> route/api -> controller -> service -> mapper/xml -> table`

Prioritize:

- join flows
- approval flows
- file upload flows
- admin processing flows

Structure-governance note:

- do not use this request-flow template by itself to decide whether a builder structure wave is closed
- builder source-of-truth and shim/delete decisions are governed by `docs/architecture/builder-structure-wave-20260409-closure.md`
