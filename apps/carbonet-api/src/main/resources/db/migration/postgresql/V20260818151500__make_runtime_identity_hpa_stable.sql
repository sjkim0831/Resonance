-- HPA owns Deployment generation and desired replicas. Validate those live
-- coordinates, but bind identity only to UID, image and canonical PodTemplate.
CREATE OR REPLACE FUNCTION framework_candidate_runtime_identity_hash_v2(
  p_source_commit varchar,p_deployment_namespace varchar,p_deployment_name varchar,
  p_deployment_uid varchar,p_deployment_generation bigint,p_observed_generation bigint,
  p_desired_replicas integer,p_image_ref varchar,p_image_id varchar,
  p_pod_template_sha256 varchar
) RETURNS varchar(64)
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $candidate_hash$
  SELECT CASE
    WHEN p_source_commit~'^[0-9a-f]{40}$'
     AND nullif(p_deployment_namespace,'') IS NOT NULL
     AND nullif(p_deployment_name,'') IS NOT NULL
     AND nullif(p_deployment_uid,'') IS NOT NULL
     AND p_deployment_generation>0
     AND p_observed_generation>=p_deployment_generation
     AND p_desired_replicas>0
     AND nullif(p_image_ref,'') IS NOT NULL
     AND p_image_id~'sha256:[0-9a-f]{64}$'
     AND p_pod_template_sha256~'^[0-9a-f]{64}$'
    THEN encode(sha256(convert_to(jsonb_build_array(
      'CARBONET_RUNTIME_IDENTITY_V3_HPA_STABLE',p_source_commit,
      p_deployment_namespace,p_deployment_name,p_deployment_uid,
      p_image_ref,p_image_id,'UP',p_pod_template_sha256
    )::text,'UTF8')),'hex')::varchar(64)
    ELSE NULL
  END
$candidate_hash$;

CREATE OR REPLACE FUNCTION framework_runtime_release_identity_hash(
  p_runtime framework_runtime_release_state
) RETURNS varchar(64)
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $function$
  SELECT CASE
    WHEN (p_runtime).release_key<>'CARBONET_RUNTIME' THEN NULL
    WHEN framework_runtime_release_uses_legacy_identity_v1(p_runtime)
    THEN encode(sha256(convert_to(concat_ws('|',
      (p_runtime).source_commit,(p_runtime).deployment_namespace,
      (p_runtime).deployment_name,(p_runtime).deployment_uid,
      (p_runtime).deployment_generation,(p_runtime).observed_generation,
      (p_runtime).desired_replicas,(p_runtime).image_ref,
      (p_runtime).image_id,(p_runtime).health_status
    ),'UTF8')),'hex')::varchar(64)
    WHEN (p_runtime).deployment_generation>0
     AND (p_runtime).observed_generation>=(p_runtime).deployment_generation
     AND (p_runtime).desired_replicas>0
     AND (p_runtime).health_status='UP'
     AND (p_runtime).pod_template_sha256~'^[0-9a-f]{64}$'
    THEN framework_candidate_runtime_identity_hash_v2(
      (p_runtime).source_commit,(p_runtime).deployment_namespace,
      (p_runtime).deployment_name,(p_runtime).deployment_uid,
      (p_runtime).deployment_generation,(p_runtime).observed_generation,
      (p_runtime).desired_replicas,(p_runtime).image_ref,
      (p_runtime).image_id,(p_runtime).pod_template_sha256)
    ELSE NULL
  END
$function$;

COMMENT ON FUNCTION framework_candidate_runtime_identity_hash_v2(
  varchar,varchar,varchar,varchar,bigint,bigint,integer,varchar,varchar,varchar
) IS 'HPA-stable runtime identity; live scale is validated but excluded from the immutable hash.';
COMMENT ON FUNCTION framework_runtime_release_identity_hash(framework_runtime_release_state) IS
  'HPA-stable V3 runtime identity with the exact audited legacy-76a bridge.';
