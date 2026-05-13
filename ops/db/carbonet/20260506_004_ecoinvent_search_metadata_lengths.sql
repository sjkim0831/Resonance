ALTER TABLE ecoinvent_master CHANGE activity_name activity_name VARCHAR(1000);
ALTER TABLE ecoinvent_master CHANGE product_name product_name VARCHAR(1000);
ALTER TABLE ecoinvent_master CHANGE geography geography VARCHAR(120);
ALTER TABLE ecoinvent_master CHANGE reference_product_unit reference_product_unit VARCHAR(120);
ALTER TABLE ecoinvent_master CHANGE indicator_name indicator_name VARCHAR(1000);
ALTER TABLE ecoinvent_master CHANGE score_unit score_unit VARCHAR(120);

COMMIT;
