SET search_path=p006_registry,public;
CREATE TABLE IF NOT EXISTS factory_layout(
 id uuid PRIMARY KEY,name text NOT NULL,owner_id varchar NOT NULL REFERENCES public.dt_project_account(account_id),
 version integer NOT NULL DEFAULT 1,settings jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS canvas_instance(
 layout_id uuid NOT NULL REFERENCES factory_layout(id) ON DELETE CASCADE,id uuid NOT NULL,
 asset_id text REFERENCES asset(id),entry_usd text,template_id text,
 equipment_id uuid REFERENCES equipment_instance(id),intake_id text REFERENCES equipment_intake(id),
 label text NOT NULL,position jsonb NOT NULL,rotation jsonb NOT NULL,scale jsonb NOT NULL,parameters jsonb NOT NULL,
 PRIMARY KEY(layout_id,id),CHECK(asset_id IS NOT NULL OR template_id IS NOT NULL),CHECK(equipment_id IS NULL OR intake_id IS NULL));
CREATE TABLE IF NOT EXISTS layout_relationship(
 layout_id uuid NOT NULL REFERENCES factory_layout(id) ON DELETE CASCADE,id uuid NOT NULL,
 from_id uuid NOT NULL,to_id uuid NOT NULL,type text NOT NULL,source jsonb NOT NULL,
 PRIMARY KEY(layout_id,id),FOREIGN KEY(layout_id,from_id) REFERENCES canvas_instance(layout_id,id) ON DELETE CASCADE,
 FOREIGN KEY(layout_id,to_id) REFERENCES canvas_instance(layout_id,id) ON DELETE CASCADE,
 CHECK(from_id<>to_id),CHECK(type IN('REQUIRES','CONNECTS_TO','INPUT_FROM','OUTPUT_TO','OPTIONAL_WITH','SAFETY_FOR','CONTROLLED_BY','UTILITY_FOR')));
CREATE TABLE IF NOT EXISTS factory_layout_revision(
 layout_id uuid NOT NULL REFERENCES factory_layout(id) ON DELETE CASCADE,version integer NOT NULL,document jsonb NOT NULL,actor_id varchar NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(layout_id,version));
CREATE TABLE IF NOT EXISTS composer_relationship_rule(
 id text PRIMARY KEY,from_asset_id text NOT NULL REFERENCES asset(id),target_asset_id text REFERENCES asset(id),target_domain text,
 type text NOT NULL,source jsonb NOT NULL,CHECK((target_asset_id IS NOT NULL)<>(target_domain IS NOT NULL)),
 CHECK(type IN('REQUIRES','CONNECTS_TO','INPUT_FROM','OUTPUT_TO','OPTIONAL_WITH','SAFETY_FOR','CONTROLLED_BY','UTILITY_FOR')));
CREATE INDEX IF NOT EXISTS composer_rule_source ON composer_relationship_rule(from_asset_id);
CREATE INDEX IF NOT EXISTS layout_owner ON factory_layout(owner_id,updated_at);
