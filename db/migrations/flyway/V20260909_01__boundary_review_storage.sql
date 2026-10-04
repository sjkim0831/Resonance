-- Contract: EmissionProjectRegistryService organizationalBoundary / decideOrganizationalBoundaryVerification.
-- Additive repair only. Does not rewrite existing boundary state or grant user roles.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE IF NOT EXISTS emission_organizational_boundary_review (
 review_id bigserial PRIMARY KEY,
 boundary_id bigint NOT NULL REFERENCES emission_organizational_boundary(boundary_id) ON DELETE CASCADE,
 tenant_id varchar(100) NOT NULL,
 project_id varchar(100) NOT NULL,
 decision varchar(16) NOT NULL CHECK (decision IN ('PASS','RETURN')),
 reviewer_id varchar(255) NOT NULL,
 comment_text text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT current_timestamp,
 CHECK (decision <> 'RETURN' OR length(trim(comment_text))>0)
);
CREATE INDEX IF NOT EXISTS ix_boundary_review_boundary ON emission_organizational_boundary_review(boundary_id,review_id DESC);
DO $$
DECLARE owner_name text;
BEGIN
 SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='emission_organizational_boundary'::regclass;
 EXECUTE format('ALTER TABLE emission_organizational_boundary_review OWNER TO %I',owner_name);
END $$;
COMMIT;
