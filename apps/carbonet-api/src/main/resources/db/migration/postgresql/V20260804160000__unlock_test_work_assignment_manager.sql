-- The account may have accumulated failed attempts before its authority
-- projection was installed. Keep the reproducible test fixture unlocked.
UPDATE comtnemplyrinfo
SET lock_at=null,
    lock_cnt=0,
    lock_last_pnttm=null
WHERE lower(emplyr_id)='qaassign26';
