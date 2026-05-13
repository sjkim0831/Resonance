ALTER TABLE ecoinvent_master DROP COLUMN impact_scores_json;
ALTER TABLE ecoinvent_master DROP COLUMN raw_search_json;
ALTER TABLE ecoinvent_master DROP COLUMN raw_batch_json;

ALTER TABLE ecoinvent_master ADD COLUMN impact_scores_json VARCHAR(65535);
ALTER TABLE ecoinvent_master ADD COLUMN raw_search_json VARCHAR(65535);
ALTER TABLE ecoinvent_master ADD COLUMN raw_batch_json VARCHAR(65535);

COMMIT;
