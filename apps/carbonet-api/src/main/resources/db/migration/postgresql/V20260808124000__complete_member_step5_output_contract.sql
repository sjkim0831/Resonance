UPDATE framework_professional_screen_contract
SET field_contract = jsonb_build_array(
      jsonb_build_object('fieldCode','receiptNumber','fieldName','접수번호','dataType','STRING','controlType','READONLY_TEXT','required',true,'editable',false,'apiProperty','receiptNumber','sourceTable','comtnentrprsmber','sourceColumn','entrprs_mber_id','privacyClass','INTERNAL'),
      jsonb_build_object('fieldCode','applicationStatus','fieldName','가입 신청 상태','dataType','CODE','controlType','STATUS_BADGE','required',true,'editable',false,'apiProperty','applicationStatus','sourceTable','comtnentrprsmber','sourceColumn','entrprs_mber_sttus','privacyClass','INTERNAL'),
      jsonb_build_object('fieldCode','membershipType','fieldName','회원 유형','dataType','CODE','controlType','READONLY_TEXT','required',true,'editable',false,'apiProperty','membershipType','sourceTable','comtnentrprsmber','sourceColumn','entrprs_se_code','privacyClass','INTERNAL'),
      jsonb_build_object('fieldCode','submittedAt','fieldName','제출 일시','dataType','DATETIME','controlType','DATETIME','required',true,'editable',false,'apiProperty','submittedAt','sourceTable','comtnentrprsmber','sourceColumn','sbscrb_de','privacyClass','INTERNAL'),
      jsonb_build_object('fieldCode','nextAction','fieldName','다음 업무','dataType','STRING','controlType','WORK_GUIDE_LINK','required',true,'editable',false,'apiProperty','nextAction','sourceTable','framework_process_step','sourceColumn','step_code','privacyClass','PUBLIC')
    )::text,
    updated_by = 'codex-member-process-closure',
    updated_at = current_timestamp
WHERE process_code='MEMBER_REGISTRATION'
  AND step_code='MEMBER_REGISTRATION_S5'
  AND route_path='/join/step5';

DO $$
DECLARE matched integer; score integer;
BEGIN
  SELECT count(*) INTO matched
  FROM framework_professional_screen_contract
  WHERE process_code='MEMBER_REGISTRATION'
    AND step_code='MEMBER_REGISTRATION_S5'
    AND route_path='/join/step5'
    AND field_contract <> '[]';
  SELECT readiness_score INTO score
  FROM framework_professional_screen_readiness
  WHERE process_code='MEMBER_REGISTRATION'
    AND step_code='MEMBER_REGISTRATION_S5'
    AND route_path='/join/step5';
  IF matched<>1 OR score<>100 THEN
    RAISE EXCEPTION 'MEMBER_STEP5_OUTPUT_CONTRACT_INVALID matched=% score=%',matched,score;
  END IF;
END $$;
