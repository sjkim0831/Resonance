-- Store only the salted SHA-256 test credential projection expected by
-- AuthServiceImpl; no plaintext credential is persisted in source or DB.
UPDATE comtnemplyrinfo
SET password='cfH9a8BPk7B4pfg1y6dfLEudQjmS+aGfb1HYe0xubBc=',
    lock_at=null,
    lock_cnt=0,
    lock_last_pnttm=null,
    chg_pwd_last_pnttm=current_timestamp
WHERE lower(emplyr_id)='qaassign26';
