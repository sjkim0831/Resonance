-- Align the fixture with the separately managed test-switch credential.
-- Only the salted one-way hash is persisted.
UPDATE comtnemplyrinfo
SET password='UHY/Q/HVlPt35CLMYnQOOcwmb6g43vD7GxcOssbVl8c=',
    lock_at=null,
    lock_cnt=0,
    lock_last_pnttm=null,
    chg_pwd_last_pnttm=current_timestamp
WHERE lower(emplyr_id)='qaassign26';
