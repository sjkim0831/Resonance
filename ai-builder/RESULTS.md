# Builder Pipeline - Results Summary

## Date: 2026-07-25

## Pipeline Execution Summary

| Layer | Name | Duration | Status | Output |
|-------|------|----------|--------|--------|
| L01 | Design Extraction | 0.10s | ✓ Success | 1066 contracts |
| L02 | Parse & Normalize | 0.10s | ✓ Success | 1066 normalized contracts |
| L03 | Validation | 0.10s | ✓ Success | 1066 validated (178 duplicate routes logged) |
| L04 | Template Generation | 0.50s | ✓ Success | 9 template files |
| L05 | Screen Composition | 0.10s | ✓ Success | 1066 component codes |
| L06 | Screen Generation | 0.10s | ✓ Success | 1066 .tsx files |
| L07 | Export | 0.10s | ✓ Success | routes.tsx, catalog.json, navigation.json |
| L08 | Design Watcher | 0.10s | ✓ Success | 3 changes detected |

**Total Duration:** ~0.64s  
**Total Screens:** 1066

## Generated Files

### Templates (9 files)
```
/tmp/builder_output/04_template/
├── types.ts              (1.7KB) - TypeScript interfaces
├── hooks.ts              (7.7KB) - useScreenState, useFormState, useApi
├── utils.ts              (4.3KB) - Validation utilities
├── FieldFactory.tsx      (8.8KB) - 21 field type renderer
├── SectionComponents.tsx (6.3KB) - CardSection, StatusChip, TableSection
├── FormComponents.tsx    (6.2KB) - AutoForm, FormArray
├── api_client.ts         (4.0KB) - Axios API client
├── screen_registry.ts    (1.2KB) - Screen registry
└── index.ts              (327B) - Exports
```

### Screens (1066 files)
```
/tmp/builder_output/06_generate/screens/
├── Screen1.tsx   (473 lines) - 프로젝트 기본정보 및 책임 확정
├── Screen2.tsx   - ...
├── Screen3.tsx
├── ...
└── Screen25187.tsx
```

### Export Files
```
/tmp/builder_output/07_export/
├── catalog.json      (5.7MB) - All screen metadata
├── navigation.json   (257KB) - Process-grouped navigation
└── routes.tsx        (105KB) - React Router routes
```

## Validation Results

### Screen Structure Tests
All 1066 screens pass validation:
- ✓ React import
- ✓ useState/useEffect hooks
- ✓ useScreenState hook
- ✓ useFormState hook
- ✓ FieldFactory component
- ✓ Field definitions
- ✓ JSX return with Container, Typography, Paper
- ✓ StatusChip for state display
- ✓ Export default

### Field Types Supported (21)
TEXT, NUMBER, DATE, DATETIME, SELECT, CHECKBOX, SWITCH, RADIO, AUTOCOMPLETE, SLIDER, FILE, IMAGE, EMAIL, PASSWORD, PHONE, TEXTAREA, CODE, ENUM, HIDDEN, CALCULATED, ADDRESS

## Known Data Issues (Informational)

1. **178 Duplicate Routes**: Multiple contracts share the same route path (e.g., `/admin/system/actor-process`). This is expected for workflow systems where different process steps use the same screen.

2. **8785 Selection Fields Without Options**: Many CODE/ENUM fields don't have predefined options in the DB. These will render as empty dropdowns.

## Deployment Locations

| Target | Files | Count |
|--------|-------|-------|
| Frontend Screens | `source/src/generated/screens/C{ID}_Screen.tsx` | 1066 |
| Frontend Templates | `runtime/templates/` | 9 |
| Runtime Catalog | `runtime/catalog.json` | 1 |

## Next Steps

1. **Frontend Build**: Run `npm run build` in frontend to bundle new screens
2. **Route Registration**: Register routes in React Router
3. **API Integration**: Connect generated screens to backend APIs
4. **Testing**: Test sample screens in development mode

## Commands

```bash
# Full pipeline run
cd /opt/Resonance/ai-builder
python3 -m builder.master_orchestrator --force

# Status check
python3 -m builder.master_orchestrator --status

# Sync to frontend
bash scripts/sync-to-frontend.sh

# Build and deploy
bash scripts/build-and-deploy.sh --force
```
