# Release Checklist

Before release, verify:

- docs in `docs/ai` were updated
- impacted routes still resolve
- role checks still work
- state transitions still match business rules
- DB scripts were reviewed
- logs and monitoring cover the changed path
- for page-management changes, `페이지 등록 -> PAGE_CODE_VIEW 자동 생성 -> 권한 수동 검토 -> 페이지 삭제 시 기본 VIEW 정리` 흐름이 한글/영문 모두 동작한다
- blocked page deletion shows remaining feature codes, feature-management links, and correct delete-impact counts
- for authority-chain changes, non-master 계정에서 권한 선택 목록이 본인 grantable 기능으로만 제한되는지 확인한다
- for authority-chain changes, 저장 시 현재 관리 대상 밖의 기능이 의도치 않게 제거되지 않는지 확인한다
- `auth_group`, `auth_change`, `dept_role_mapping`, `member_edit`, `admin_account` 복원 작업은 원본 템플릿 구조와 현재 확장 기능이 함께 유지되는지 확인한다
