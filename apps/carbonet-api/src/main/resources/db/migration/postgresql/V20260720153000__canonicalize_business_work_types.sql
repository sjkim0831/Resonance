-- Collapse legacy process domains into the ten user-facing work types.
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;

UPDATE framework_process_definition
SET domain_code=CASE
    WHEN domain_code IN ('CARBON_EMISSION','CCUS_MRV') THEN 'EMISSION'
    WHEN domain_code='PRODUCT_LCA' THEN 'LCA'
    WHEN domain_code='CONTENT' THEN 'EDUCATION'
    WHEN domain_code='CUSTOMER_HOME' THEN 'COMMON'
    WHEN domain_code='IDENTITY' THEN 'MEMBER'
    WHEN domain_code IN ('GOVERNANCE','INTEGRATION','PLATFORM') THEN 'SYSTEM'
    WHEN domain_code='PAYMENT' THEN 'TRADE'
    WHEN domain_code='REPORTING' THEN 'CERTIFICATE'
    ELSE domain_code END,
    updated_at=current_timestamp
WHERE domain_code IN ('CARBON_EMISSION','CCUS_MRV','PRODUCT_LCA','CONTENT','CUSTOMER_HOME','IDENTITY','GOVERNANCE','INTEGRATION','PLATFORM','PAYMENT','REPORTING');

ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

UPDATE framework_business_work_type
SET use_at='N',updated_at=current_timestamp
WHERE work_type_code IN ('CARBON_EMISSION','CCUS_MRV','PRODUCT_LCA','CONTENT','CUSTOMER_HOME','IDENTITY','GOVERNANCE','INTEGRATION','PLATFORM','PAYMENT','REPORTING');
