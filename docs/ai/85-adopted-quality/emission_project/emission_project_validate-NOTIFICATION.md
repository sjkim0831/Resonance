# Verified existing in-app notification adoption: EMISSION_PROJECT / EMISSION_PROJECT_VALIDATE

- Job: 297
- Process: EMISSION_PROJECT
- Step: EMISSION_PROJECT_VALIDATE
- Type: NOTIFICATION
- Target: notification/emission_project_emission_project_validate
- Approved requirement: 입력·산정·증빙의 완전성, 정확성, 일관성과 이상치를 검증한다.

## Adopted contract

- Persisted workflow event types written to `emission_activity_submission_event`:
  - `VERIFICATION_STARTED` (validation run begins on a SUBMITTED submission)
  - `VERIFIED` (validation decision PASSED, target state IN_VERIFICATION -> VERIFIED)
  - `CORRECTION_REQUESTED` (validation decision CORRECTION_REQUESTED, target state IN_VERIFICATION -> CORRECTION_REQUIRED)
- Authenticated user-facing readers:
  - `GET /home/api/emission-projects/{id}/submissions` -> `submissions(projectId, tenantId)`
  - `GET /home/api/emission-projects/{id}/review-workflow` -> `reviewWorkflow(projectId, tenantId)`
- Workflow evidence SQL tests:
  - `ops/tests/verify-emission-activity-quality.sql`
  - `ops/tests/verify-emission-review-workflow.sql`
- Deterministic validator: `ops/scripts/validate-existing-emission-project-notification.sh`

## Deterministic promotion gate

```
bash ops/scripts/validate-existing-emission-project-notification.sh . EMISSION_PROJECT EMISSION_PROJECT_VALIDATE
bash ops/scripts/validate-emission-project-workflow.sh
```

## Acceptance evidence

Adopt existing emission project registry service/controller contracts. The
worker added the `EMISSION_PROJECT_VALIDATE` case to the deterministic
validator with the exact event types, reader service methods, controller
delegations, and SQL tests that already exist. Any missing event, reader, or
test leaves the job incomplete.
