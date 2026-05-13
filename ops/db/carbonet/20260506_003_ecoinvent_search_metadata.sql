ALTER TABLE ecoinvent_master ADD COLUMN activity_name VARCHAR(1000);
ALTER TABLE ecoinvent_master ADD COLUMN product_name VARCHAR(1000);
ALTER TABLE ecoinvent_master ADD COLUMN geography VARCHAR(120);
ALTER TABLE ecoinvent_master ADD COLUMN reference_product_unit VARCHAR(120);
ALTER TABLE ecoinvent_master ADD COLUMN indicator_id BIGINT;
ALTER TABLE ecoinvent_master ADD COLUMN indicator_name VARCHAR(1000);
ALTER TABLE ecoinvent_master ADD COLUMN score_unit VARCHAR(120);

UPDATE ecoinvent_master
SET activity_name = material_name
WHERE activity_name IS NULL;

UPDATE ecoinvent_master
SET product_name = material_name
WHERE product_name IS NULL;

UPDATE ecoinvent_master
SET reference_product_unit = unit
WHERE reference_product_unit IS NULL;

UPDATE ecoinvent_master
SET score_unit = unit
WHERE score_unit IS NULL;

COMMIT;
