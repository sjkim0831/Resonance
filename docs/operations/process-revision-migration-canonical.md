# Revision Audit Migration 정본 결정

- 정본: `apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260918130000__create_process_revision_audit_contract.sql`
- 제외 후보: `runtime/platform-data/dev-worktrees/certificate-verification/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260918120000__add_process_step_revision_audit.sql`
- 제외 사유: 두 파일이 동일 테이블 `framework_process_step_revision_audit`를 생성하며, dev-worktree 파일은 주 저장소 Flyway classpath 밖의 별도 worktree에 있다. 두 파일을 함께 병합하면 동일 목적 DDL이 중복 유입된다.
- dev-worktree 상태: 별도 worktree이며 수정 파일이 다수 존재한다. 원본은 삭제·수정하지 않는다.
- SHA-256: 정본 후보 `150bf79bacb5f3e21ae007c5547ae8ab9e35bca3799e293e8dcffcbaadf8ac9e`; 제외 후보 `c6cbeb1638066db8e51087692fcf06c861c82b0771468e6c061d5e380ff7e063`.
- 병합 규칙: 주 저장소 Flyway 경로에는 정본만 허용하며, CI 정적 테스트가 동일 테이블 생성 파일 수가 1이 아니면 실패한다.