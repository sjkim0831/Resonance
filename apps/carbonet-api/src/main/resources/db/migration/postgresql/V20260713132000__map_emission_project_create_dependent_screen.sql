-- Menu Management's dependent-screen popup resolves this relation from the
-- visible project list entry to the hidden create screen.
UPDATE comtnmenuinfo
SET dependent_screen_code='H102010201', last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code='H1020102';
