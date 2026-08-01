# Verified existing database adoption: PLATFORM_OPERATION / PLATFORM_DESIGN

- Job: 18884
- Job type: DATABASE
- Source commit: 6504fc3c883bdce333d5a192a244e80720cc6b47
- Requirement: 메뉴·화면·권한·배포·감사를 안정적으로 운영한다. 목표를 위해 메뉴·화면·권한 설계 단계에서 DESIGN_CHANGE 명령의 선행 상태, 담당 액터, 필수 입력, 권한, 증적을 확인한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PLATFORM_OPERATION","stepCode":"PLATFORM_DESIGN","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-18884/projects/carbonet-backend-metadata/process-runtime/generated/PLATFORM_OPERATION/PLATFORM_OPERATION__PLATFORM_DESIGN.json","evidence":"/opt/Resonance/var/ai-worktrees/job-18884/var/test-evidence/process-package-tests/PLATFORM_OPERATION__PLATFORM_DESIGN.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.
