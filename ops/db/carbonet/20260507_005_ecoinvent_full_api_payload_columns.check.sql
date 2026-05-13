SELECT attr_name, data_type, prec
FROM db_attribute
WHERE class_name = 'ecoinvent_master'
  AND attr_name IN (
    'activity_spold_uuid',
    'activity_type',
    'product_spold_uuid',
    'description',
    'geography_spold_uuid',
    'included_activity_starts',
    'included_activity_ends',
    'isic_class',
    'isic_section',
    'sectors',
    'technology_comment',
    'time_period',
    'time_period_comment',
    'dataset_url',
    'url_history',
    'score_method',
    'score_category',
    'impact_scores_json',
    'raw_search_json',
    'raw_batch_json'
  )
ORDER BY attr_name;
