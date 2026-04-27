# Resonance Wave 34 - Platform Install Agent UI

Date: 2026-04-26
Root: /opt/Resonance

## What changed

- Restored the AI reference documents from the archived Carbonet tree into the canonical Resonance docs root.
- Updated the frontend verification inventory generator so it reads /opt/Resonance/docs/ai first and falls back to the frontend-local docs path.
- Added the deterministic 3B/Ollama agent route map and stage/model matrix to the platform install page.
- Kept /opt/Resonance as the canonical root and removed the accidental lightweight /opt/projects/Resonance copy.

## Validation

- npm run build passed in projects/carbonet-frontend/source.
- Frontend assets were emitted into apps/carbonet-app/src/main/resources/static/react-app.
- Canonical Maven build passed for 25 reactor modules.
- Boot smoke passed for carbonet-app, operations-console, and project-runtime.

## Remaining work

- Add authenticated browser verification for the platform install page once an admin session is available.
- Decide whether the 14GB archive /opt/projects/_archive/carbonet-20260426-183930 can be removed after a final source parity check.
- Continue hardening the deterministic agent control plane: execution ledger, retry policy, rollback gate, and Ollama model health probes.
