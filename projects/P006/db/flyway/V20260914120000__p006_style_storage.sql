-- P006 style storage contract: nullable, backward-compatible JSONB fields.
SET search_path=p006_registry,public;
ALTER TABLE canvas_instance ADD COLUMN IF NOT EXISTS style jsonb NULL;
ALTER TABLE factory_layout ADD COLUMN IF NOT EXISTS scene_style jsonb NULL;
