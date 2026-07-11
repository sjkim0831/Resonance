INSERT INTO carbonet_liquibase_governance (governance_key, governance_value, description)
VALUES
    ('customer.trace.approval.source', 'human-review', 'Customer Trace approval decisions require an authenticated human reviewer'),
    ('customer.trace.verified.evidence', 'required', 'VERIFIED state requires one or more evidence references'),
    ('customer.trace.automatic.execution', 'disabled', 'Customer Trace SR execution and deployment remain disabled until explicit approval'),
    ('customer.trace.snapshot.role', 'builder-read-model', 'JSON Customer Trace artifacts are Builder read models; PostgreSQL is the approval ledger system of record')
ON CONFLICT (governance_key) DO UPDATE
SET governance_value = EXCLUDED.governance_value,
    description = EXCLUDED.description,
    updated_at = now();
