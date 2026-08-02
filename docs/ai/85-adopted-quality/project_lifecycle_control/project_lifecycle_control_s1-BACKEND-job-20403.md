# Verified existing server adoption: PROJECT_LIFECYCLE_CONTROL / PROJECT_LIFECYCLE_CONTROL_S1

- Job: 20403
- Job type: BACKEND
- Source commit: c820bc658137957b9379ac4f65f12079ff908be8
- Requirement: 전환 요청·미결업무 확인 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PROJECT_LIFECYCLE_CONTROL","stepCode":"PROJECT_LIFECYCLE_CONTROL_S1","dimension":"BACKEND","package":"/opt/Resonance/var/ai-worktrees/job-20403/projects/carbonet-backend-metadata/process-runtime/generated/PROJECT_LIFECYCLE_CONTROL/PROJECT_LIFECYCLE_CONTROL__PROJECT_LIFECYCLE_CONTROL_S1.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20403/var/test-evidence/process-package-tests/PROJECT_LIFECYCLE_CONTROL__PROJECT_LIFECYCLE_CONTROL_S1.json","status":"PASSED"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.
