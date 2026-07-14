ALTER TABLE framework_screen_blueprint
  ADD COLUMN IF NOT EXISTS implementation_strategy varchar(30) NOT NULL DEFAULT 'GENERATE_NEW',
  ADD COLUMN IF NOT EXISTS source_reference varchar(500),
  ADD COLUMN IF NOT EXISTS transition_status varchar(30) NOT NULL DEFAULT 'PLANNED';

ALTER TABLE framework_screen_blueprint
  DROP CONSTRAINT IF EXISTS framework_screen_blueprint_process_code_step_code_audience_key;

ALTER TABLE framework_screen_blueprint
  ADD CONSTRAINT ck_screen_blueprint_strategy
  CHECK (implementation_strategy IN ('ADOPT_EXISTING','STANDARDIZE_RUNTIME','GENERATE_NEW'));

CREATE INDEX IF NOT EXISTS ix_screen_blueprint_transition
  ON framework_screen_blueprint(implementation_strategy,transition_status);
