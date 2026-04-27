# Emission Management Rollout Fixtures

This directory holds the canonical fixture payloads used by the local
`/admin/emission/management` rollout verification scripts.

Files:

- `scopes.tsv`
  - source of truth for the supported rollout scope matrix
  - columns: `scope`, `category_subcode`, `tier`, `expected_input_var`, `fixture_file`
- `CEMENT-1.json` .. `LIME-3.json`
  - canonical save payloads for each supported scope

Used by:

- `ops/scripts/list-emission-management-rollout-scopes.sh`
- `ops/scripts/verify-emission-management-rollout-fixtures.sh`
- `ops/scripts/verify-emission-management-rollout-scope.sh`
- `ops/scripts/fill-emission-management-rollout-snapshots.sh`
- `ops/scripts/build-restart-fill-verify-emission-management-rollout-18000.sh`
- `ops/scripts/show-emission-management-rollout-status.sh`
- `ops/scripts/verify-emission-management-rollout-readonly.sh`

Maintenance rule:

1. Update `scopes.tsv` when a supported rollout scope is added, removed, or renamed.
2. Add or update the matching JSON fixture file.
3. Run `bash ops/scripts/verify-emission-management-rollout-fixtures.sh`.
4. Run `bash ops/scripts/verify-emission-management-rollout-tooling.sh` for non-runtime helper smoke checks.
5. Then run the relevant scope or rollout verification command.

The fixture verifier currently checks:

1. every non-comment row in `scopes.tsv` is unique and complete
2. every referenced fixture file exists
3. `categoryId`, `tier`, `createdBy`, and `expected_input_var` stay aligned with metadata
4. fixture file names follow the canonical `${scope/:/-}.json` pattern
5. no unexpected non-markdown files exist in this directory outside the metadata and referenced fixtures

Shared implementation note:

- rollout scripts now share metadata lookup and default-scope derivation through `ops/scripts/emission-management-auth-common.sh`
- rollout JSON and text render helpers now live in `ops/scripts/emission_rollout_json_common.py`

Useful commands:

- show the full rollout command index:
  `bash ops/scripts/help-emission-management-rollout.sh`
- show the full rollout command index as JSON:
  `EMISSION_HELP_OUTPUT=json bash ops/scripts/help-emission-management-rollout.sh`
  this JSON payload includes `schemaVersion=1`, `catalogMode=grouped`, and `commandCount`
- show the full rollout command index as versioned flat JSON:
  `EMISSION_HELP_OUTPUT=flat-json bash ops/scripts/help-emission-management-rollout.sh`
  this JSON payload includes `schemaVersion=1`, `catalogMode=flat`, `commandCount`, and `commands`
- show the full rollout command index as a flat command list:
  `EMISSION_HELP_OUTPUT=commands bash ops/scripts/help-emission-management-rollout.sh`
  this mode is intentionally unstructured and does not include `schemaVersion` or `commandCount`
- list the currently supported rollout scopes:
  `bash ops/scripts/list-emission-management-rollout-scopes.sh`
- list the currently supported rollout scopes as JSON:
  `EMISSION_SCOPE_LIST_OUTPUT=json bash ops/scripts/list-emission-management-rollout-scopes.sh`
  this JSON payload includes `schemaVersion=1`, `scopeCount`, and `scopes`
- emit the default `EMISSION_SCOPES` value:
  `EMISSION_SCOPE_LIST_OUTPUT=scopes bash ops/scripts/list-emission-management-rollout-scopes.sh`
- verify metadata and fixture consistency:
  `bash ops/scripts/verify-emission-management-rollout-fixtures.sh`
- verify metadata and fixture consistency with JSON output:
  `EMISSION_FIXTURE_VERIFY_OUTPUT=json bash ops/scripts/verify-emission-management-rollout-fixtures.sh`
  this JSON payload includes `schemaVersion=1` and `status=ok`
- run the non-runtime rollout tooling smoke verifier:
  `bash ops/scripts/verify-emission-management-rollout-tooling.sh`
- show one read-only rollout status summary:
  `bash ops/scripts/show-emission-management-rollout-status.sh`
- show one read-only rollout status summary as JSON without hitting the board:
  `EMISSION_STATUS_OUTPUT=json EMISSION_STATUS_INCLUDE_BOARD=false bash ops/scripts/show-emission-management-rollout-status.sh`
  this JSON payload includes `schemaVersion=1`, `mode=summary`, `status=ok`, and metadata-derived `expectedReadyScopes`
- rollout output selector variables fail fast on unsupported values, including `EMISSION_SCOPE_LIST_OUTPUT`, `EMISSION_FIXTURE_VERIFY_OUTPUT`, `EMISSION_STATUS_OUTPUT`, `EMISSION_STATUS_INCLUDE_BOARD`, `EMISSION_READONLY_VERIFY_OUTPUT`, and `EMISSION_ROLLOUT_OUTPUT`
- wrapper boolean selectors also fail fast on unsupported values, including `SHOW_ROLLOUT_BOARD_AT_END` and `IGNORE_ROLLOUT_BOARD_SHOW_FAILURE`
- run the read-only verification bundle:
  `bash ops/scripts/verify-emission-management-rollout-readonly.sh`
- run the read-only verification bundle with JSON output:
  `EMISSION_READONLY_VERIFY_OUTPUT=json bash ops/scripts/verify-emission-management-rollout-readonly.sh`
  this JSON payload includes `schemaVersion=1`, `mode=verify`, `status=ok`, and metadata-derived `expectedReadyScopes`
- replay one canonical scope:
  `bash ops/scripts/verify-emission-management-rollout-scope.sh CEMENT:1`
- list valid scope arguments for that wrapper:
  `bash ops/scripts/verify-emission-management-rollout-scope.sh list`
- emit the wrapper's default space-separated scope set:
  `bash ops/scripts/verify-emission-management-rollout-scope.sh list-scopes`
