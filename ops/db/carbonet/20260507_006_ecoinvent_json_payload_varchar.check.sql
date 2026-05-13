SELECT attr_name, data_type, prec
FROM db_attribute
WHERE class_name = 'ecoinvent_master'
  AND attr_name IN ('impact_scores_json', 'raw_search_json', 'raw_batch_json')
ORDER BY attr_name;
