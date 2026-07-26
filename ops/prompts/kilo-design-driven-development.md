# Kilo M2.7 design-driven development

Start by running:

```bash
cd /opt/Resonance
bash ops/scripts/generate-system-design-deliverables.sh generate
bash ops/scripts/generate-system-design-deliverables.sh check
```

Read `var/ai-runtime/system-design-generator/latest/development/work-queue.json`, select one bounded contract, and read its packet under `development/packets/`.

Treat the packet as the implementation contract because it and the 18 design documents were generated from the same live snapshot. Preserve actor/process/task/route traceability. Use `/admin/system/build-studio`, project-owned metadata, SDUI and static assets first. Do not build or deploy for page-only work. Run changed-route smoke before the complete screen quality gate. If the packet needs a new core API, DB schema or security behavior, stop and create a design revision instead of inventing behavior.
