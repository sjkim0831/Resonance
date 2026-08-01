-- Legacy projects predate the professional setup contract. Derive only
-- missing values so operator-entered settings are never overwritten.
WITH project_year AS (
  SELECT project_id,
         coalesce(
           reporting_year,
           nullif(substring(calculation_period from '(20[0-9]{2})'), '')::integer,
           extract(year from due_date)::integer,
           extract(year from current_date)::integer
         ) AS resolved_year
  FROM emission_project_registry
)
UPDATE emission_project_registry project
SET reporting_year = coalesce(project.reporting_year, source.resolved_year),
    period_start = coalesce(project.period_start, make_date(source.resolved_year, 1, 1)),
    period_end = coalesce(project.period_end, make_date(source.resolved_year, 12, 31)),
    organization_boundary = coalesce(project.organization_boundary, 'OPERATIONAL_CONTROL'),
    emission_standard = coalesce(project.emission_standard, 'ISO_14064_1'),
    methodology_version = coalesce(project.methodology_version, '2018'),
    verification_level = coalesce(project.verification_level, 'LIMITED'),
    collection_cycle = coalesce(project.collection_cycle, 'MONTHLY'),
    materiality_threshold = coalesce(project.materiality_threshold, 5),
    settings_snapshot = coalesce(project.settings_snapshot, jsonb_build_object(
      'source', 'LEGACY_PROJECT_BACKFILL',
      'reportingYear', source.resolved_year,
      'organizationBoundary', 'OPERATIONAL_CONTROL',
      'emissionStandard', 'ISO_14064_1',
      'methodologyVersion', '2018',
      'verificationLevel', 'LIMITED',
      'collectionCycle', 'MONTHLY',
      'materialityThreshold', 5
    )),
    updated_at = current_timestamp
FROM project_year source
WHERE source.project_id = project.project_id
  AND (
    project.reporting_year IS NULL OR project.period_start IS NULL OR project.period_end IS NULL OR
    project.organization_boundary IS NULL OR project.emission_standard IS NULL OR
    project.methodology_version IS NULL OR project.verification_level IS NULL OR
    project.collection_cycle IS NULL OR project.materiality_threshold IS NULL OR
    project.settings_snapshot IS NULL
  );
