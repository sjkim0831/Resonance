CREATE OR REPLACE FUNCTION framework_record_diagnostic(
  requested_error_type varchar, requested_message text,
  requested_resources jsonb DEFAULT '[]'::jsonb,
  requested_paths jsonb DEFAULT '[]'::jsonb,
  requested_verification jsonb DEFAULT '[]'::jsonb,
  requested_prevention jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE normalized text; next_fingerprint varchar; resolved_id bigint;
BEGIN
  normalized := lower(regexp_replace(regexp_replace(coalesce(requested_message,''),
    '\m[0-9a-f]{8,}\M','<hash>','gi'),'\m[0-9]+\M','<n>','g'));
  next_fingerprint := (md5(upper(trim(requested_error_type))||'|'||normalized)||
    md5('DIAGNOSTIC_V1|'||upper(trim(requested_error_type))||'|'||normalized))::varchar;
  INSERT INTO framework_diagnostic_signature(
    fingerprint,error_type,normalized_message,affected_resource_keys,
    affected_source_paths,verification_commands,prevention_contract)
  VALUES(next_fingerprint,upper(trim(requested_error_type)),normalized,
    coalesce(requested_resources,'[]'::jsonb),coalesce(requested_paths,'[]'::jsonb),
    coalesce(requested_verification,'[]'::jsonb),coalesce(requested_prevention,'{}'::jsonb))
  ON CONFLICT(fingerprint) DO UPDATE SET
    occurrence_count=framework_diagnostic_signature.occurrence_count+1,
    last_seen_at=current_timestamp,
    affected_resource_keys=CASE WHEN excluded.affected_resource_keys='[]'::jsonb
      THEN framework_diagnostic_signature.affected_resource_keys ELSE excluded.affected_resource_keys END,
    affected_source_paths=CASE WHEN excluded.affected_source_paths='[]'::jsonb
      THEN framework_diagnostic_signature.affected_source_paths ELSE excluded.affected_source_paths END,
    verification_commands=CASE WHEN excluded.verification_commands='[]'::jsonb
      THEN framework_diagnostic_signature.verification_commands ELSE excluded.verification_commands END,
    prevention_contract=framework_diagnostic_signature.prevention_contract||excluded.prevention_contract
  RETURNING diagnostic_id INTO resolved_id;
  RETURN jsonb_build_object('success',true,'diagnosticId',resolved_id,
    'fingerprint',next_fingerprint,'normalizedMessage',normalized);
END $$;

CREATE OR REPLACE FUNCTION framework_resolve_diagnostic(
  requested_fingerprint varchar, requested_prevention jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE changed integer;
BEGIN
  UPDATE framework_diagnostic_signature SET resolution_status='RESOLVED',
    resolved_at=current_timestamp,last_seen_at=current_timestamp,
    prevention_contract=prevention_contract||coalesce(requested_prevention,'{}'::jsonb)
  WHERE fingerprint=requested_fingerprint;
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN jsonb_build_object('success',changed=1,'resolved',changed);
END $$;

CREATE OR REPLACE VIEW framework_open_diagnostic_work_queue AS
SELECT diagnostic_id,fingerprint,error_type,normalized_message,
  affected_resource_keys,affected_source_paths,verification_commands,
  prevention_contract,occurrence_count,first_seen_at,last_seen_at
FROM framework_diagnostic_signature
WHERE resolution_status='OPEN'
ORDER BY occurrence_count DESC,last_seen_at DESC;
