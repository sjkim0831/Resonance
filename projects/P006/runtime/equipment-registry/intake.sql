SET search_path=p006_registry,public;
CREATE TABLE IF NOT EXISTS equipment_intake (
 id text PRIMARY KEY, batch text NOT NULL, source_name text NOT NULL,
 evidence jsonb NOT NULL, classification jsonb NOT NULL, recommendation jsonb NOT NULL,
 asset_id text REFERENCES asset(id), grade text NOT NULL CHECK(grade IN('EXACT_MATCH','CLOSE_MATCH','REFERENCE_MATCH','NO_MATCH','BLOCKED')),
 attribution_status text NOT NULL DEFAULT 'UNCONFIRMED' CHECK(attribution_status IN('UNCONFIRMED','CONFIRMED')),
 process_id uuid REFERENCES process(id), attribution_evidence text,
 manufacturer text NOT NULL DEFAULT 'UNKNOWN', model text NOT NULL DEFAULT 'UNKNOWN', dimensions jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((attribution_status='UNCONFIRMED' AND process_id IS NULL) OR (attribution_status='CONFIRMED' AND process_id IS NOT NULL AND length(attribution_evidence)>10))
);
CREATE INDEX IF NOT EXISTS intake_attribution ON equipment_intake(attribution_status);
INSERT INTO schema_version(version) VALUES(2) ON CONFLICT DO NOTHING;
