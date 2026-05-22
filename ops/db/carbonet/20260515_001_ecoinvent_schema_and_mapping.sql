-- Carbonet ecoinvent local catalog and Korean/English pre-mapping schema.
-- Region priority in service/UI: KR, ROW, RER, GLO, EU, US, JP, CN, IN.

CREATE TABLE IF NOT EXISTS ecoinvent_master (
  id BIGINT NOT NULL,
  material_name VARCHAR(255) NOT NULL,
  activity_name VARCHAR(1000),
  activity_type VARCHAR(255),
  product_name VARCHAR(1000),
  geography VARCHAR(120),
  reference_product_unit VARCHAR(120),
  time_period VARCHAR(255),
  indicator_id BIGINT,
  indicator_name VARCHAR(1000),
  impact_score DOUBLE NOT NULL,
  unit VARCHAR(255) NOT NULL,
  score_unit VARCHAR(120),
  version VARCHAR(255),
  last_sync_date DATETIME,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS emission_mapping_log (
  id BIGINT NOT NULL,
  raw_material_name VARCHAR(255) NOT NULL,
  mapped_material_id BIGINT,
  note VARCHAR(255),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS emission_material_translation (
  raw_name VARCHAR(500) NOT NULL,
  english_name VARCHAR(1000) NOT NULL,
  source_type VARCHAR(40),
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (raw_name)
);

CREATE TABLE IF NOT EXISTS emission_chemical_material_dictionary (
  id BIGINT NOT NULL,
  cas_no VARCHAR(80),
  korean_name VARCHAR(1000) NOT NULL,
  english_name VARCHAR(1000) NOT NULL,
  synonyms VARCHAR(4000),
  source_type VARCHAR(80),
  source_url VARCHAR(1000),
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (id)
);
