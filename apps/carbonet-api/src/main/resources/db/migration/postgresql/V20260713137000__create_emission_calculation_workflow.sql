CREATE TABLE IF NOT EXISTS emission_calculation_run (
 calculation_id bigserial PRIMARY KEY, project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
 version_no integer NOT NULL, calculation_status varchar(20) NOT NULL DEFAULT 'CALCULATED', total_emission numeric(24,8) NOT NULL,
 calculated_at timestamp NOT NULL DEFAULT current_timestamp, UNIQUE(project_id,version_no)
);
CREATE TABLE IF NOT EXISTS emission_calculation_item (
 calculation_item_id bigserial PRIMARY KEY, calculation_id bigint NOT NULL REFERENCES emission_calculation_run(calculation_id) ON DELETE CASCADE,
 activity_id bigint NOT NULL REFERENCES emission_activity_data(activity_id), quantity numeric(20,6) NOT NULL, factor_value numeric(20,8) NOT NULL,
 emission_value numeric(24,8) NOT NULL, UNIQUE(calculation_id,activity_id)
);
