SELECT class_name
FROM db_class
WHERE lower(class_name) IN ('ecoinvent_master', 'emission_mapping_log', 'db_migration_history')
ORDER BY class_name;
