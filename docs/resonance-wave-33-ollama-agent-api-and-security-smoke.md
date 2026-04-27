# Wave 33: Ollama Agent API And Security Smoke

This wave wires deterministic small-model agent configuration into the operations platform.

Implemented:

- Registered modules/resonance-ops/ollama-control-plane in modules/pom.xml.
- Added operations-console dependency on resonance-ollama-control-plane.
- Added API endpoints:
  - GET /admin/api/platform/ollama/deterministic-route-map
  - GET /admin/api/platform/ollama/agent-stage-model-matrix
- Fixed CarbonetSecurityOverrideConfig lazy-init failure by removing ApplicationContext holder supplier usage and switching override beans to constructor autowiring.

Smoke result:

- operations-console starts.
- New agent API paths no longer return 500.
- Unauthenticated smoke receives 302 to login, which means the endpoints are registered behind the admin security boundary.

Known follow-up:

- TRACE_EVENT insert can fail if the live CUBRID schema does not contain PROJECT_ID. This is an observability schema alignment issue, not an Ollama agent API registration issue.
- A logged-in/API-token smoke should be added after the operations console authentication test harness is standardized.

3B agent implication:

- Small models must start from data/ai-runtime/deterministic-route-map.json and data/ai-runtime/agent-stage-model-matrix.json.
- The operations platform can now expose these maps without asking a model to scan source first.
