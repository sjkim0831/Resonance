# Builder 8-Layer Screen Generation - Quick Reference

## Architecture

```
L01: Design Extraction   → DB (contracts) → Python objects
L02: Parse & Normalize    → Parse/normalize contract data
L03: Validation          → Validate integrity (non-blocking)
L04: Template Generation  → types.ts, hooks.ts, FieldFactory.tsx, etc.
L05: Screen Composition   → Compose React components
L06: Screen Generation    → Generate .tsx files (checksum tracking)
L07: Export              → routes.tsx, catalog.json, navigation.json
L08: Design Watcher      → Monitor changes, trigger regeneration
```

## Commands

```bash
cd /opt/Resonance/ai-builder

# Full pipeline run
python3 -m builder.master_orchestrator --force

# Resume from checkpoint
python3 -m builder.master_orchestrator

# Reset and run from beginning
python3 -m builder.master_orchestrator --reset --force

# Start from specific layer
python3 -m builder.master_orchestrator --from 5

# Check status
python3 -m builder.master_orchestrator --status

# Build and deploy in one step
bash scripts/build-and-deploy.sh --force

# Sync output to frontend
bash scripts/sync-to-frontend.sh
```

## File Locations

### Builder Output
```
/tmp/builder_output/
├── 01_design/           # Extracted contracts
├── 02_parse/           # Parsed contracts  
├── 03_validate/        # Validation report
├── 04_template/         # Generated templates
│   ├── types.ts
│   ├── hooks.ts
│   ├── utils.ts
│   ├── FieldFactory.tsx   (21 field types)
│   ├── SectionComponents.tsx
│   ├── FormComponents.tsx
│   ├── api_client.ts
│   └── screen_registry.ts
├── 05_compose/         # Composed components
├── 06_generate/screens/  # Generated .tsx files (1066 screens)
├── 07_export/          # routes.tsx, catalog.json, navigation.json
└── .checkpoints/       # Recovery checkpoints
```

### Frontend Integration
```
/opt/Resonance/projects/carbonet-frontend/
├── source/src/generated/screens/   # Screen components
└── src/main/resources/static/react-app/runtime/templates/  # Shared templates
```

## Checkpoint-Based Recovery

Each layer saves a checkpoint after successful completion:
```
.checkpoints/
├── layer_01.json   # L01 completed
├── layer_02.json   # L02 completed
├── ...
└── history.json   # Full history
```

On error, choose:
1. **Skip** - Continue without repeating this layer
2. **Retry** - Repeat this layer
3. **Reset** - Clear checkpoints from this layer onwards

## Field Types (21 supported)

| Type | Description |
|------|-------------|
| TEXT, TEXTAREA, CODE | Text input |
| NUMBER, CALCULATED | Numeric |
| DATE, DATETIME | Date/time |
| SELECT, CODE, ENUM | Dropdown selection |
| CHECKBOX, SWITCH | Boolean |
| RADIO | Single selection |
| AUTOCOMPLETE | Searchable dropdown |
| SLIDER | Range input |
| FILE, IMAGE | File upload |
| EMAIL, PASSWORD, PHONE | Formatted text |
| ADDRESS | Address input |
| HIDDEN | Hidden field |

## Change Detection

L06 (Screen Generation) tracks file checksums. Only changed files are regenerated.

L08 (Design Watcher) monitors changes and can trigger regeneration.

## Status Codes

Pipeline stores status in:
```bash
cat /tmp/builder_output/pipeline_summary.json
```

## Notes

- L03 validation is non-blocking - data issues are logged but processing continues
- 178 duplicate routes exist in source data (normal for the system)
- Builder extracts 1066 contracts from database
- All 1066 screens are validated and generated successfully

## Deployment Status (2026-07-25)

### Runtime Status
- **Backend**: UP (verified via /actuator/health)
- **DB Contracts**: 1066 contracts available
- **Service**: carbonet-runtime on NodePort 44810

### Generated Routes (Sample)
```
1: /emission/project/create
2: /admin/emission/project-operations
3: /emission/validate?tab=approval
4: /admin/emission/approval-workflow
5: /emission/activity-data
...
Total: 1066 routes
```

### Files Generated
- `/tmp/builder_output/07_export/catalog.json` (5.7MB)
- `/tmp/builder_output/07_export/routes.tsx` (105KB)
- `/tmp/builder_output/07_export/navigation.json` (257KB)
- `/tmp/builder_output/06_generate/screens/` (1066 .tsx files)
- `/tmp/builder_output/04_template/` (9 template files)

### Next Steps
1. Access runtime at NodePort 44810
2. Screen routes are dynamically loaded from catalog.json
3. To regenerate screens: `cd /opt/Resonance/ai-builder && python3 -m builder.master_orchestrator --force`

### Known Data Issues
- 178 duplicate routes exist in source DB (normal for shared workflows)
- 8785 warnings for selection fields without options (informational)

### Troubleshooting
```bash
# Check runtime health
curl http://localhost:44810/actuator/health

# Check DB contracts
kubectl -n carbonet-prod exec postgres-patroni-0 -- \\
  psql -h 127.0.0.1 -U postgres -d carbonet -c \\
  "SELECT COUNT(*) FROM framework_professional_screen_contract WHERE contract_status IN ('VERIFIED', 'DESIGN_COMPLETE');"

# Check pods
kubectl -n carbonet-prod get pods -l app=carbonet-runtime

# Check builder status
cd /opt/Resonance/ai-builder && python3 -m builder.master_orchestrator --status
```
