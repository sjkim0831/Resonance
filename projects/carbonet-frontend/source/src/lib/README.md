# Shared Frontend Library Boundaries

Use subfolders here to keep session ownership explicit.

- `api/`
  - HTTP client and request-response helpers
- `auth/`
  - permission derivation and auth-adjacent helpers
- `navigation/`
  - runtime route, locale, and browser navigation helpers

Do not place unrelated cross-cutting helpers in the same file when they serve different session owners.
