# Verified existing server adoption: MEASUREMENT_DATA_QUALITY / MEASUREMENT_DATA_QUALITY_S2

- Job: 20034
- Job type: BACKEND
- Source commit: b28a0c73c0af200040eae70814975c63ba7db909
- Requirement: 교정·가동상태 검증 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"MEASUREMENT_DATA_QUALITY","stepCode":"MEASUREMENT_DATA_QUALITY_S2","dimension":"BACKEND","package":"/opt/Resonance/var/ai-worktrees/job-20034/projects/carbonet-backend-metadata/process-runtime/generated/MEASUREMENT_DATA_QUALITY/MEASUREMENT_DATA_QUALITY__MEASUREMENT_DATA_QUALITY_S2.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20034/var/test-evidence/process-package-tests/MEASUREMENT_DATA_QUALITY__MEASUREMENT_DATA_QUALITY_S2.json","status":"PASSED"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.
