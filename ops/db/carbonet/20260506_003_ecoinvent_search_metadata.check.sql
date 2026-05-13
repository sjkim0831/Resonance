SELECT attr_name
FROM db_attribute
WHERE class_name = 'ecoinvent_master'
  AND attr_name IN (
    'activity_name',
    'product_name',
    'geography',
    'reference_product_unit',
    'indicator_id',
    'indicator_name',
    'score_unit'
  )
ORDER BY attr_name;
