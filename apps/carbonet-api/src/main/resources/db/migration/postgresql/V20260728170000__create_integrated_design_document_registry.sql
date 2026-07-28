CREATE TABLE IF NOT EXISTS integrated_design_document (
  document_id bigserial PRIMARY KEY,
  process_code varchar(100) NOT NULL,
  step_code varchar(100) NOT NULL DEFAULT '',
  route_path varchar(500) NOT NULL DEFAULT '',
  document_type varchar(50) NOT NULL,
  title varchar(300) NOT NULL,
  content text NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','READY','IN_REVIEW','APPROVED','VERIFIED')),
  revision bigint NOT NULL DEFAULT 1,
  active_yn char(1) NOT NULL DEFAULT 'Y',
  updated_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(process_code,step_code,route_path,document_type)
);

CREATE TABLE IF NOT EXISTS integrated_design_document_version (
  document_id bigint NOT NULL REFERENCES integrated_design_document(document_id) ON DELETE CASCADE,
  revision bigint NOT NULL,
  title varchar(300) NOT NULL,
  content text NOT NULL,
  status varchar(20) NOT NULL,
  archived_by varchar(100) NOT NULL,
  archived_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(document_id,revision)
);

CREATE INDEX IF NOT EXISTS ix_integrated_design_document_context
  ON integrated_design_document(process_code,step_code,route_path,active_yn,document_type);

CREATE OR REPLACE FUNCTION archive_integrated_design_document()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title
     OR OLD.content IS DISTINCT FROM NEW.content
     OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO integrated_design_document_version(
      document_id,revision,title,content,status,archived_by)
    VALUES(OLD.document_id,OLD.revision,OLD.title,OLD.content,OLD.status,
      coalesce(NEW.updated_by,'SYSTEM'))
    ON CONFLICT DO NOTHING;
    NEW.revision := OLD.revision+1;
    NEW.updated_at := current_timestamp;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_archive_integrated_design_document ON integrated_design_document;
CREATE TRIGGER trg_archive_integrated_design_document
BEFORE UPDATE ON integrated_design_document
FOR EACH ROW EXECUTE FUNCTION archive_integrated_design_document();
