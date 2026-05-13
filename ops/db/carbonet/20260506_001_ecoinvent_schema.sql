CREATE TABLE IF NOT EXISTS ecoinvent_master (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  material_name VARCHAR(255) NOT NULL,
  activity_name VARCHAR(1000),
  activity_spold_uuid VARCHAR(120),
  activity_type VARCHAR(255),
  product_name VARCHAR(1000),
  product_spold_uuid VARCHAR(120),
  description VARCHAR(4000),
  geography VARCHAR(120),
  geography_spold_uuid VARCHAR(120),
  reference_product_unit VARCHAR(120),
  included_activity_starts VARCHAR(120),
  included_activity_ends VARCHAR(120),
  isic_class VARCHAR(1000),
  isic_section VARCHAR(1000),
  sectors VARCHAR(2000),
  technology_comment VARCHAR(4000),
  time_period VARCHAR(255),
  time_period_comment VARCHAR(1000),
  dataset_url VARCHAR(1000),
  url_history VARCHAR(4000),
  indicator_id BIGINT,
  indicator_name VARCHAR(1000),
  score_method VARCHAR(1000),
  score_category VARCHAR(1000),
  impact_score DOUBLE NOT NULL,
  unit VARCHAR(255) NOT NULL,
  score_unit VARCHAR(120),
  impact_scores_json VARCHAR(65535),
  raw_search_json VARCHAR(65535),
  raw_batch_json VARCHAR(65535),
  version VARCHAR(255),
  last_sync_date DATETIME
);

CREATE TABLE IF NOT EXISTS emission_mapping_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  raw_material_name VARCHAR(255) NOT NULL,
  mapped_material_id BIGINT,
  note VARCHAR(255),
  CONSTRAINT fk_emission_mapping_log_ecoinvent
    FOREIGN KEY (mapped_material_id)
    REFERENCES ecoinvent_master (id)
);
