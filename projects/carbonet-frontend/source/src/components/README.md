# Shared Component Boundaries

Use subfolders here to reduce multi-session collisions.

- `access/`
  - permission and capability gating
- `help/`
  - overlay and guided-help UI

Do not drop unrelated shared UI directly under `components/`.

Prefer a dedicated subfolder per shared concern so one session can own one component family at a time.
