# 과거 검증 캐시 정리 및 잔여 경로 검토

- 일자: 2026-09-08. 약 3분. 서비스 재시작 0회.
- 위치: /opt/Resonance/runtime/platform-data/control-plane/source
- 삭제: .kube/cache, projects/carbonet-frontend/source/.cache, var/reports/full-screen-deploy-gate.
- 결과: 3개 폴더, 76파일, 9,890,499바이트(9.43MiB). 과거 복사본 176MiB에서 166MiB.
- 검증: 경로 정규화, 열린 파일, 외부 심볼릭 링크 유입, 하드링크 및 삭제 직전 파일 상태 확인. 현재 서비스 5개 active, 홈 HTTP200 및 페이지 오류 0건. 스크린샷 확인. 로그인/PDF E2E는 미실행.
- 보존: 현재 CCUS/P006 소스와 DB, 모델, 남은 과거 상이 소스 및 설계 자료.

## 중요한 잔여 설정

ops/host-config/systemd 아래 5개 서비스 설정이 과거 control-plane/source를 WorkingDirectory 또는 실행 경로로 참조한다.

1. resonance-design-asset-promotion-worker: inactive
2. resonance-design-asset-runtime-applier: inactive
3. resonance-design-asset-snapshot: failed
4. resonance-project-bootstrap-worker: inactive
5. resonance-design-release-worker: inactive

현재 실행 중은 아니지만 설정이 남아 있으므로 전체 과거 폴더를 무조건 미사용으로 판단하지 않는다. 앞선 중복 삭제로 과거 복사본은 완전 실행본이 아니다. 이 설정의 재사용 여부 및 현재 경로 대체 가능성을 확인하는 것이 다음 작업이다. 이번에는 설정이나 서비스 상태를 변경하지 않았다.

## 설계 영향

화면 및 업무 기능 변경 없음. 정리 원칙은 캐시와 과거 검증 산출물 삭제, 현재 데이터 및 소스 보존이다. 서비스 재사용 시 과거 경로가 다시 적용되지 않도록 경로 정합성 검토가 필요하다.
