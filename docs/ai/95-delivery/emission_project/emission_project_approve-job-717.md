# Deployment verification request: EMISSION_PROJECT / EMISSION_PROJECT_APPROVE

- Job: 717
- Source commit before delivery: f9187b789b9010c5966e58c59ac432d3b8ee078d
- Requirement: DB 정의, 프론트, Java 변경 범위를 판별하여 무빌드 또는 증분 빌드와 무중단 배포를 선택한다.

The deterministic worker requests the standard guarded deployment. The parent worker must verify that this commit is contained in the deployed revision, the Kubernetes deployment is fully ready, and  succeeds before it marks this job verified.
