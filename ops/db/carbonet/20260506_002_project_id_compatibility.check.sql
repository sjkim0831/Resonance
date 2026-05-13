SELECT COUNT(*) AS project_id_column_count
FROM db_attribute
WHERE class_name IN ('comtnentrprsmber', 'access_event', 'audit_event')
  AND attr_name = 'project_id';
