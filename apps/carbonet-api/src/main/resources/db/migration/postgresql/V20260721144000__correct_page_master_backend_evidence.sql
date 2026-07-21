UPDATE framework_page_development_item item
SET backend_status=CASE
      WHEN EXISTS(SELECT 1 FROM framework_screen_capability capability WHERE capability.screen_resource_id=item.screen_resource_id)
       AND NOT EXISTS(SELECT 1 FROM framework_screen_capability capability WHERE capability.screen_resource_id=item.screen_resource_id AND capability.implementation_status<>'VERIFIED')
        THEN 'VERIFIED'
      ELSE 'PLANNED'
    END,
    updated_at=current_timestamp,
    updated_by='EVIDENCE_RECONCILIATION';

COMMENT ON COLUMN framework_page_development_item.backend_status IS
  '화면 기능 계약의 실제 구현 증적 상태. 기능 계약 존재만으로 완료 처리하지 않고 모든 기능이 VERIFIED일 때만 VERIFIED다.';
