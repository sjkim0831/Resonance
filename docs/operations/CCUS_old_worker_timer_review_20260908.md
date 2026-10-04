# 구 설계 워커 자동 시작 정리

- 2026-09-08, 약 3분. 재부팅 및 웹앱 재시작 0회.
- 대상: resonance-design-asset-snapshot, resonance-design-asset-promotion-worker, resonance-design-asset-runtime-applier, resonance-design-release-worker, resonance-project-bootstrap-worker의 timer 5개.
- 발견: 모두 inactive이나 enabled. 서비스는 과거 control-plane/source를 참조. 현재 /opt/Resonance/ops/scripts에는 대응 스크립트가 없고 과거 복사본에는 존재함.
- 스크립트 확인: 프로젝트 생성과 설계 승격은 kubectl로 Secret 및 Patroni DB 접근. 스냅샷도 kubectl exec로 DB 접근. 실행 경로만 치환해서 현재 로컬 DB 환경으로 전환할 수 없음.
- 조치: systemctl disable로 타이머 자동 시작 해제. 이미 중지 상태여서 실행 중 작업 중단 없음. 스크립트, 서비스 정의 및 데이터 삭제 없음. 과거 소스 폴더 166MiB 보존.
- 검증: 변경 후 timer 5개 inactive 및 비활성화 상태 확인. 현재 CCUS/P006/DB 등 서비스 5개 active. 홈 HTTP 200, 페이지 오류 0건 및 화면 확인. 로그인/PDF 전체 E2E 미실행.
- 설계 영향: 이 구 자동화는 현재 실행 중이지 않았으며 이번 조치로 현재 설계 자동화가 완성 또는 복구된 것은 아님. 재사용하려면 로컬 DB 연결, 대기열, 생성 및 적용 경로를 별도 검증해야 함.
- 다음: 남은 과거 자료와 구 자동화의 필요 기능을 구분. 경로만 바꾸거나 스크립트를 실행해 운영 데이터를 변경하지 않음.
