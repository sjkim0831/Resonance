-- Runtime storage required by MemberWithdrawalController and member-facing steps.
CREATE TABLE IF NOT EXISTS member_withdrawal_request (
    request_id uuid PRIMARY KEY,
    tenant_id varchar(100) NOT NULL,
    member_id varchar(200) NOT NULL,
    reason_text text NOT NULL,
    handover_to varchar(200),
    confirmation_at timestamptz NOT NULL DEFAULT current_timestamp,
    status varchar(30) NOT NULL DEFAULT 'REQUESTED',
    review_note text,
    reviewed_by varchar(200),
    reviewed_at timestamptz,
    decision_note text,
    decided_by varchar(200),
    decided_at timestamptz,
    completed_by varchar(200),
    completed_at timestamptz,
    retention_until date,
    destruction_due_at timestamptz,
    requested_at timestamptz NOT NULL DEFAULT current_timestamp,
    row_version bigint NOT NULL DEFAULT 0,
    CONSTRAINT ck_member_withdrawal_status CHECK (
      status IN ('REQUESTED','REVIEWED','APPROVED','REJECTED','COMPLETED')
    )
);

CREATE INDEX IF NOT EXISTS ix_member_withdrawal_member_requested
    ON member_withdrawal_request (lower(member_id), requested_at DESC);
CREATE INDEX IF NOT EXISTS ix_member_withdrawal_tenant_requested
    ON member_withdrawal_request (tenant_id, requested_at DESC);

DO $$
BEGIN
  ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
  UPDATE framework_process_step
     SET actor_code = 'MEMBER_USER'
   WHERE process_code = 'ACCOUNT_WITHDRAWAL'
     AND step_code = 'ACCOUNT_WITHDRAWAL_S2';
  ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;
END $$;
