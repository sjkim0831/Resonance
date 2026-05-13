SELECT COUNT(*) AS geography_common_code_count
FROM COMTCCMMNDETAILCODE
WHERE CODE_ID = 'ECOGEO'
  AND CODE IN ('KR', 'ROW', 'RER', 'GLO', 'EU', 'JP', 'CH', 'IN');
