CREATE TABLE IF NOT EXISTS emission_factor_reference (
 factor_id varchar(40) PRIMARY KEY, factor_name varchar(200) NOT NULL, category varchar(80) NOT NULL,
 unit varchar(30) NOT NULL, factor_value numeric(20,8) NOT NULL, source_name varchar(100) NOT NULL
);
INSERT INTO emission_factor_reference VALUES
('EF-ELEC-KR','전력(대한민국 전력망)','전력','kWh',0.00045941,'국가 배출계수'),
('EF-LNG','액화천연가스(LNG)','연료','Nm3',0.00217600,'국가 배출계수'),
('EF-DIESEL','경유','연료','L',0.00260600,'국가 배출계수'),
('EF-GASOLINE','휘발유','연료','L',0.00217900,'국가 배출계수'),
('EF-STEAM','스팀','에너지','ton',0.05500000,'기본 배출계수')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS emission_activity_data (
 activity_id bigserial PRIMARY KEY, project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id) ON DELETE CASCADE,
 activity_name varchar(200) NOT NULL, category varchar(80) NOT NULL, activity_period varchar(20) NOT NULL,
 quantity numeric(20,6) NOT NULL, unit varchar(30) NOT NULL, evidence_note varchar(500),
 factor_id varchar(40) REFERENCES emission_factor_reference(factor_id), mapping_status varchar(20) NOT NULL DEFAULT 'UNMAPPED',
 created_at timestamp NOT NULL DEFAULT current_timestamp, updated_at timestamp NOT NULL DEFAULT current_timestamp
);
CREATE INDEX IF NOT EXISTS ix_emission_activity_project ON emission_activity_data(project_id,activity_period);
