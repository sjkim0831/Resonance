-- Complete the login authority projection for the test assignment account.
INSERT INTO comtnemplyrscrtyestbs(scrty_dtrmn_trget_id,mber_ty_code,author_code)
SELECT esntl_id,'USR03','ROLE_USER'
FROM comtnemplyrinfo
WHERE lower(emplyr_id)='qaassign26'
ON CONFLICT(scrty_dtrmn_trget_id) DO UPDATE SET
  mber_ty_code=excluded.mber_ty_code,
  author_code=excluded.author_code;
