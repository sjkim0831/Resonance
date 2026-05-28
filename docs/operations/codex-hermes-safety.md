# Codex / Hermes Safety Upgrade

This repository uses generated frontend artifacts, local vector databases, and runtime AI state. Treat them as separate asset classes.

## Required workflow

1. Work from `/opt/Resonance` and confirm `git rev-parse --show-toplevel` before editing.
2. Commit source changes first.
3. Run `npx tsc -b --pretty false` and `npm run build` from `projects/carbonet-frontend/source`.
4. Commit frontend build artifacts only when explicitly requested.
5. Never commit local vector DB files, SQLite runtime state, cache files, or secrets.
6. Use `ops/scripts/codex-safe-status.sh` before `git add -A`.

## RAG / vector DB rules

- Local vector stores belong under runtime data or backup directories, not Git history.
- Back up the Hermes vector DB with `ops/scripts/codex-vector-db-backup.sh` before reindexing.
- Reindex jobs must write a manifest containing source paths, commit hash, embedding model, chunker version, and row count.
- Search answers should carry source path and line/asset evidence whenever possible.

## Fine-tuning / LoRA rules

- Export success/failure cases as JSONL with explicit labels: `good_pattern`, `bad_pattern`, `blocked_reason`, `verification`.
- Include failure cases such as wrong Git root, minified bundle grep mistakes, and oversized SQLite commits.
- Do not train on secrets, tokens, database dumps, or private credentials.

## Hermes agent rules

- Run a preflight: Git root, branch, dirty state, large files, service mount path.
- Run a postflight: typecheck, build, artifact evidence, commit hash, push status.
- If a push fails due to file size, remove the file from the commit with `git rm --cached`; do not delete the server file.
