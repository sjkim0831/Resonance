# Wave 32: Deterministic 3B Agent Framework

This wave adds the minimum control plane needed for small local models to work safely.

Added:

- data/ai-runtime/deterministic-route-map.json
- data/ai-runtime/agent-stage-model-matrix.json
- docs/agent/deterministic-3b-agent-playbook.md
- skills/resonance-workflow/SKILL.md

Design:

- Deterministic code and manifests choose candidate files.
- 3B models classify, rank, perform bounded edits, and summarize verification.
- Large models are optional planners, not the default executor.
- Every implementation must pass a build or smoke gate, otherwise it stops with a concrete failure.

Next implementation step:

- Expose these maps through the operations console install and AI runtime pages.
- Wire the Ollama control-plane module to read the same JSON files.
- Add a route resolver command that returns candidate files without invoking a large model.
