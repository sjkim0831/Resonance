ALTER TABLE emission_activity_submission_event
  DROP CONSTRAINT IF EXISTS emission_activity_submission_event_event_type_check;

ALTER TABLE emission_activity_submission_event
  ADD CONSTRAINT emission_activity_submission_event_event_type_check
  CHECK (event_type IN (
    'CREATED','SUBMITTED','ACCEPTED','REJECTED','CORRECTION_REQUESTED',
    'VERIFICATION_STARTED','VERIFIED','APPROVED','DEADLINE_EXTENDED'
  ));
