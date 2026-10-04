# 탄소배출 v3 명령별 입력·출력 계약

모두 목표 계약이며 현재 운영 API의 존재나 호환을 보장하지 않는다. 화면 필드 합집합을 모든 명령의 필수 입력으로 사용하지 않는다. 회사/실제 처리자는 서버 세션에서 얻는다.

## 1. 배출량 프로젝트 목록

조회: GET /api/v2/emission/company/project
입력: keyword, siteId, periodFrom, periodTo, status, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 2. 사업장·배출원 원장

조회: GET /api/v2/emission/company/site
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E02.create|siteCode, siteName, address, active, effectiveFrom, revision|siteId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E02.update|siteId, revision, patch|siteId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E02.deactivate|siteId, revision|siteId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 3. 프로젝트 등록

조회: GET /api/v2/emission/company/project
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E03.create|name, siteIds, periodStart, periodEnd, idempotencyKey|projectId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 4. 프로젝트 상세

조회: GET /api/v2/emission/projects/{projectId}/project
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E04.update|projectId, revision, patch|projectId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 5. 프로세스 진행

조회: GET /api/v2/emission/projects/{projectId}/workflow
입력: projectId, status
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 6. 프로젝트 포트폴리오

조회: GET /api/v2/emission/company/portfolio
입력: periodFrom, periodTo, status
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 7. 관리자 프로젝트 운영

조회: GET /api/v2/emission/company/project-operations
입력: menuCode, projectId, siteId, status, periodFrom, periodTo, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 8. 프로젝트 사전 설정

조회: GET /api/v2/emission/company/readiness
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 9. 프로젝트 설정 후보

조회: GET /api/v2/emission/projects/{projectId}/project
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 10. 배출 정의 관리

조회: GET /api/v2/emission/company/source-definition
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E10.create|definitionType, code, name, effectiveFrom, revision|definitionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E10.update|definitionId, revision, patch|definitionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E10.publish|definitionId, revision, validatedRevision|definitionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E10.retire|definitionId, revision|definitionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 11. 조직경계·사업장별 범위 설정

조회: GET /api/v2/emission/projects/{projectId}/boundary
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E11.saveDraft|projectId, draftPayload|boundaryId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E11.submit|projectId, siteSources, boundaryMethod, standardCode, standardVersion, periodStart, periodEnd, revision|boundaryId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E11.publish|projectId, boundaryId, revision, validatedRevision|boundaryId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 12. 조직경계 검토

조회: GET /api/v2/emission/projects/{projectId}/boundary-review
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E12.approve|projectId, boundaryVersionId, revision, reason|boundaryVersionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E12.return|projectId, boundaryVersionId, revision, reason|boundaryVersionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 13. 배출계수 관리

조회: GET /api/v2/emission/company/factor
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E13.create|factorCode, name, value, numeratorUnit, denominatorUnit, gasOrCO2e, sourceCitation, effectiveFrom, version, revision|factorId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E13.update|factorId, revision, patch|factorId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E13.publish|factorId, revision, validatedRevision|factorId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E13.retire|factorId, revision|factorId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 14. ecoinvent 계수 관리

조회: GET /api/v2/emission/company/factor-catalog
입력: keyword, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E14.adopt|keyword, page, pageSize|catalogId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 15. 산정식 관리

조회: GET /api/v2/emission/company/calculation-rule
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E15.saveDraft|draftPayload|ruleId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E15.validate|ruleCode, name, formulaExpression, inputDimensions, outputDimension, roundingPolicy, version, testVectors, revision|ruleId, revision, status, nextActions, correlationId|도메인 조회/검사|
|E15.publish|ruleId, revision, validatedRevision|ruleId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E15.retire|ruleId, revision|ruleId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 16. GWP 값 관리

조회: GET /api/v2/emission/company/gwp
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E16.saveDraft|draftPayload|gwpId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E16.publish|gwpId, revision, validatedRevision|gwpId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E16.retire|gwpId, revision|gwpId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 17. 배출 변수 관리

조회: GET /api/v2/emission/company/variable
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E17.saveDraft|draftPayload|variableId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E17.publish|variableId, revision, validatedRevision|variableId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E17.retire|variableId, revision|variableId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 18. 입력 양식 관리

조회: GET /api/v2/emission/company/input-template
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E18.saveDraft|draftPayload|templateId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E18.preview|draftPayload|templateId, revision, status, nextActions, correlationId|도메인 조회/검사|
|E18.publish|templateId, revision, validatedRevision|templateId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E18.retire|templateId, revision|templateId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 19. 검증 규칙 관리

조회: GET /api/v2/emission/company/quality-rule
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E19.saveDraft|draftPayload|ruleId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E19.test|ruleCode, severity, predicate, message, applicability, testVectors, version, revision|ruleId, revision, status, nextActions, correlationId|도메인 조회/검사|
|E19.publish|ruleId, revision, validatedRevision|ruleId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E19.retire|ruleId, revision|ruleId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 20. 승인·알림 정책

조회: GET /api/v2/emission/company/approval-policy
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E20.saveDraft|draftPayload|policyId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E20.simulate|policyCode, applicableActions, requiredRoles, separationRules, notificationRules, version, revision|policyId, revision, status, nextActions, correlationId|도메인 조회/검사|
|E20.publish|policyId, revision, validatedRevision|policyId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E20.retire|policyId, revision|policyId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 21. 자료 제출 요청

조회: GET /api/v2/emission/projects/{projectId}/activity-request
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E21.create|projectId, siteIds, periodStart, periodEnd, requestedItems, assigneeIds, dueAt, idempotencyKey|requestId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E21.remind|projectId, requestId, idempotencyKey|requestId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E21.cancel|projectId, requestId, revision, reason|requestId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 22. 활동자료 관리

조회: GET /api/v2/emission/projects/{projectId}/sites/{siteId}/activity
입력: projectId, siteId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E22.create|projectId, siteId, sourceId, activityName, activityPeriod, quantity, unit, revision|activityId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E22.update|projectId, siteId, activityId, revision, patch|activityId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E22.deleteDraft|projectId, siteId, activityId, revision|activityId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E22.submit|projectId, siteId, sourceId, activityName, activityPeriod, quantity, unit, revision|activityId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 23. 활동자료 입력 기존 경로

조회: GET /api/v2/emission/projects/{projectId}/sites/{siteId}/activity
입력: projectId, siteId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 24. 엑셀 업로드·원본 열 매핑

조회: GET /api/v2/emission/projects/{projectId}/sites/{siteId}/import
입력: projectId, siteId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E24.preview|projectId, siteId, file|importToken, revision, status, nextActions, correlationId|도메인 조회/검사|
|E24.validate|projectId, siteId, file, columnMapping, sourceMapping, idempotencyKey|importToken, revision, status, nextActions, correlationId|도메인 조회/검사|
|E24.commit|projectId, siteId, importToken, mappingRevision, validatedHash, idempotencyKey|importToken, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 25. 증빙 자료함

조회: GET /api/v2/emission/projects/{projectId}/sites/{siteId}/evidence
입력: projectId, siteId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E25.upload|projectId, siteId, file, documentType, revision|evidenceId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E25.link|projectId, siteId, file, documentType, revision|evidenceId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E25.unlinkDraft|projectId, siteId, evidenceId, revision|evidenceId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 26. 관리자 증빙 관리

조회: GET /api/v2/emission/company/evidence-operations
입력: projectId, siteId, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 27. 외부 데이터 연계

조회: GET /api/v2/emission/projects/{projectId}/sites/{siteId}/external-import
입력: projectId, siteId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E27.preview|projectId, siteId, file|syncRunId, revision, status, nextActions, correlationId|도메인 조회/검사|
|E27.sync|projectId, siteId, connectionId, sourceMapping, periodStart, periodEnd, idempotencyKey|syncRunId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E27.retry|projectId, siteId, syncRunId, idempotencyKey|syncRunId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 28. 외부 시스템 연계 관리

조회: GET /api/v2/emission/company/connection
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E28.create|name, providerType, endpoint, credentialRef, mappingVersion, revision|connectionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E28.update|connectionId, revision, patch|connectionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E28.test|name, providerType, endpoint, credentialRef, mappingVersion, revision|connectionId, revision, status, nextActions, correlationId|도메인 조회/검사|
|E28.disable|name, providerType, endpoint, credentialRef, mappingVersion, revision|connectionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E28.retryRun|connectionId, idempotencyKey|connectionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 29. 내 업무

조회: GET /api/v2/emission/company/my-task
입력: projectId, status, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 30. 프로젝트 업무 배정

조회: GET /api/v2/emission/projects/{projectId}/assignment
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E30.assign|projectId, taskIds, assigneeIds, revision|assignmentId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E30.reassign|projectId, assignmentId, revision, patch|assignmentId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E30.revoke|projectId, assignmentId, revision, reason|assignmentId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 31. 공통 업무 실행

조회: GET /api/v2/emission/projects/{projectId}/task-execution
입력: taskId, projectId, siteId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E31.execute|taskId, projectId, revision, actionPayload|taskId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 32. 마감·지연 현황

조회: GET /api/v2/emission/company/deadline
입력: projectId, siteId, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E32.remind|taskId, idempotencyKey|taskId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 33. 데이터 검증

조회: GET /api/v2/emission/projects/{projectId}/quality-check
입력: projectId, submissionId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E33.run|projectId, submissionId, qualityRuleVersionId, idempotencyKey|submissionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 34. 검증·보정 공통 화면

조회: GET /api/v2/emission/projects/{projectId}/validation-workspace
입력: projectId, submissionId, calculationId, mode, tab
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 35. 관리자 검증

조회: GET /api/v2/emission/projects/{projectId}/submission-review
입력: projectId, submissionId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E35.accept|projectId, submissionId, revision, reason|submissionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E35.return|projectId, submissionId, revision, reason|submissionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 36. 보완·재산정

조회: GET /api/v2/emission/projects/{projectId}/correction
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E36.saveDraft|projectId, draftPayload|correctionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E36.resubmit|projectId, correctionId, sourceVersion, resolvedIssueIds, note, revision|correctionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 37. 배출량 산정·계수 매핑

조회: GET /api/v2/emission/projects/{projectId}/calculation
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E37.validateMapping|projectId, boundaryVersionId, acceptedSubmissionIds, factorMappings, ruleSetVersionId, idempotencyKey|calculationId, revision, status, nextActions, correlationId|도메인 조회/검사|
|E37.saveMapping|projectId, boundaryVersionId, acceptedSubmissionIds, factorMappings, ruleSetVersionId, idempotencyKey|calculationId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E37.run|projectId, boundaryVersionId, acceptedSubmissionIds, factorMappings, ruleSetVersionId, idempotencyKey|calculationId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E37.retry|projectId, calculationId, idempotencyKey|calculationId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 38. 산정 결과

조회: GET /api/v2/emission/projects/{projectId}/calculation-result
입력: projectId, calculationId, compareCalculationId, siteId, scope
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 39. 결과 조회 기존 경로

조회: GET /api/v2/emission/projects/{projectId}/calculation-result
입력: projectId, calculationId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 40. 관리자 산정 결과 목록

조회: GET /api/v2/emission/company/result-operations
입력: projectId, siteId, status, periodFrom, periodTo, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 41. 관리자 결과 상세

조회: GET /api/v2/emission/projects/{projectId}/result-detail
입력: projectId, calculationId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 42. 검토·승인

조회: GET /api/v2/emission/projects/{projectId}/result-review
입력: projectId, calculationId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E42.requestReview|projectId, calculationId, approverId, idempotencyKey|reviewId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E42.approve|projectId, reviewId, revision, comment, idempotencyKey|reviewId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E42.return|projectId, reviewId, revision, comment, issueIds, idempotencyKey|reviewId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 43. 배출량 확정

조회: GET /api/v2/emission/projects/{projectId}/result-lock
입력: projectId, calculationId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E43.lock|projectId, lockedResultId, revision|lockedResultId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E43.requestChange|projectId, lockedResultId, revision, reason|lockedResultId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 44. 보고서 양식 관리

조회: GET /api/v2/emission/company/report-template
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E44.saveDraft|draftPayload|templateId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E44.preview|draftPayload|templateId, revision, status, nextActions, correlationId|도메인 조회/검사|
|E44.publish|templateId, revision, validatedRevision|templateId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E44.retire|templateId, revision|templateId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 45. 보고서 작성

조회: GET /api/v2/emission/projects/{projectId}/report
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E45.saveDraft|projectId, draftPayload|reportId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E45.preview|projectId, draftPayload|reportId, revision, status, nextActions, correlationId|도메인 조회/검사|
|E45.requestIssue|projectId, lockedResultId, templateVersionId, title, reportMetadata, revision|reportId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 46. 보고서 작성 기존 경로

조회: GET /api/v2/emission/projects/{projectId}/report
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 47. 관리자 보고서

조회: GET /api/v2/emission/projects/{projectId}/report-operations
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 48. PDF 출력·발급

조회: GET /api/v2/emission/projects/{projectId}/issuance
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E48.issue|projectId, reportId, reportRevision, idempotencyKey|issuanceJobId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E48.retry|projectId, issuanceJobId, idempotencyKey|issuanceJobId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 49. 보고서·인증서 발급 관리

조회: GET /api/v2/emission/company/certificate-operations
입력: projectId, certificateId, status, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E49.reissue|certificateId, reason, idempotencyKey|certificateId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E49.revoke|certificateId, revision, reason|certificateId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 50. 인증서 관리 후보

조회: GET /api/v2/emission/company/certificate-operations
입력: certificateId, projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 51. 보고서·인증서 다운로드

조회: GET /api/v2/emission/projects/{projectId}/report-download
입력: projectId, certificateId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E51.createShare|projectId, certificateId|certificateId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E51.revokeShare|projectId, certificateId, revision|certificateId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 52. 공개 진위 확인

조회: POST /api/v2/emission/public/public-verification:verify
입력: file, certificateId
규칙: file OR certificateId; both supplied means compare requested certificate

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 53. 관리자 리포트 진위 확인

조회: GET /api/v2/emission/company/verification-operations
입력: certificateId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 54. 규제기관 제출

조회: GET /api/v2/emission/projects/{projectId}/regulatory-submission
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E54.prepare|projectId, lockedResultId, reportIds, authority, submissionType, revision|regulatorySubmissionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E54.recordSubmission|projectId, lockedResultId, reportIds, authority, submissionType, revision|regulatorySubmissionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E54.recordReceipt|projectId, regulatorySubmissionId, revision, receiptNumber, receiptFileId, receivedAt|regulatorySubmissionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E54.recordReturn|projectId, regulatorySubmissionId, revision, reason|regulatorySubmissionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E54.resubmit|projectId, lockedResultId, reportIds, authority, submissionType, revision|regulatorySubmissionId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 55. 관리자 규제 제출 현황

조회: GET /api/v2/emission/company/regulatory-operations
입력: projectId, status, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 56. 배출 현황 대시보드

조회: GET /api/v2/emission/company/dashboard
입력: periodFrom, periodTo
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 57. 프로젝트 완료

조회: GET /api/v2/emission/projects/{projectId}/project-close
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E57.close|projectId, revision|projectId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E57.requestReopen|projectId, revision, reason|projectId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E57.copyToNextPeriod|projectId, nextPeriodStart, nextPeriodEnd, copyOptions, idempotencyKey|projectId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 58. 관리자 프로젝트 완료 관리

조회: GET /api/v2/emission/company/close-operations
입력: projectId, status, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E58.approveReopen|reopenRequestId, revision, reason|reopenRequestId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 59. 다운로드·공유 이력

조회: GET /api/v2/emission/company/access-history
입력: projectId, certificateId, from, to, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 60. 관리자 보고서 접근 이력

조회: GET /api/v2/emission/company/access-audit
입력: projectId, certificateId, actorId, from, to, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 61. 데이터 변경 이력

조회: GET /api/v2/emission/projects/{projectId}/data-history
입력: projectId, entityType, entityId, from, to, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 62. 감사 로그

조회: GET /api/v2/emission/company/audit
입력: projectId, actorId, from, to, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 63. LCI DB 조회

조회: GET /api/v2/emission/company/lci-catalog
입력: keyword, page, pageSize
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|

## 64. LCI 분류 관리

조회: GET /api/v2/emission/company/lci-classification
입력: 회사 범위의 기본 조회
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E64.saveDraft|draftPayload|classificationId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E64.publish|classificationId, revision, validatedRevision|classificationId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E64.retire|classificationId, revision|classificationId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 65. LCA 분석

조회: GET /api/v2/emission/projects/{projectId}/lca-analysis
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E65.run|projectId, lcaProjectId, productId, functionalUnit, systemBoundary, datasetVersion|lcaRunId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 66. 설문·제품 데이터 관리

조회: GET /api/v2/emission/projects/{projectId}/survey-project
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E66.saveDraft|projectId, draftPayload|surveyId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E66.submit|projectId, lcaProjectId, productId, processIds, surveyVersion, revision|surveyId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 67. 설문 업로드 데이터

조회: GET /api/v2/emission/projects/{projectId}/survey-dataset
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E67.preview|projectId, file|importToken, revision, status, nextActions, correlationId|도메인 조회/검사|
|E67.validate|projectId, lcaProjectId, surveyId, file, columnMapping, idempotencyKey|importToken, revision, status, nextActions, correlationId|도메인 조회/검사|
|E67.commit|projectId, importToken, mappingRevision, validatedHash, idempotencyKey|importToken, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 68. LCA 요약보고서 출력

조회: GET /api/v2/emission/projects/{projectId}/lca-report
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E68.preview|projectId, draftPayload|lcaReportId, revision, status, nextActions, correlationId|도메인 조회/검사|
|E68.issue|projectId, lcaProjectId, lcaRunId, templateVersionId, idempotencyKey|lcaReportId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|

## 69. 감축 시나리오

조회: GET /api/v2/emission/projects/{projectId}/reduction-scenario
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E69.saveDraft|projectId, draftPayload|scenarioId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E69.compare|projectId, lockedResultId, scenarioName, measures, assumptions, revision|scenarioId, revision, status, nextActions, correlationId|도메인 조회/검사|

## 70. 감축 전략 시뮬레이션

조회: GET /api/v2/emission/projects/{projectId}/reduction-simulation
입력: projectId
규칙: context authorized; filters optional; pagination defaults page=1,pageSize=20; exact target IDs required by page purpose

|명령|필수 입력|출력|쓰기/재요청|
|---|---|---|---|
|E70.run|projectId, scenarioId, scenarioRevision, idempotencyKey|simulationId, revision, status, nextActions, correlationId|원자 저장·idempotency·감사|
|E70.compare|projectId, scenarioId, scenarioRevision, idempotencyKey|simulationId, revision, status, nextActions, correlationId|도메인 조회/검사|
