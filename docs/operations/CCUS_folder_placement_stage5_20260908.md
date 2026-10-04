# 검증 산출물 통합 5차

2026-09-08, 약 2분. 4폴더 1,625파일 이동. 논리 합계220,599,844바이트(210.38MiB). 삭제/서비스 재시작0회.

기존 루트 /opt/Resonance/runtime/platform-data, 신규 루트 /opt/Resonance/var/test-evidence.

|기존 폴더|신규 폴더|
|---|---|
|dev-evidence|platform-dev-evidence|
|quality|platform-quality|
|evidence|platform-evidence|
|test-evidence|platform-test-evidence|

열린 파일, 경로 및 상대 심볼릭 링크 확인 후 같은 파일시스템 rename. 기존 위치는 호환 링크. 전체 1,625파일 inode/크기/모드 유지 검증. 최신 결과와 과거 결과 모두 보존. 링크를 사용하는 기존 생산자는 계속 신규 저장 위치에 기록할 수 있음.
현재 5서비스 active, 홈 HTTP200/페이지 오류0건 및 스크린샷 확인. 개별 검증 결과 URL과 전체 E2E는 미검증. 이동이 용량 절감을 의미하지 않음.
이동 후 전체 인벤토리/분류 CSV 재생성. 경로 기준 분류와 실제 미사용 판정은 다름. 전체 위치 정리가 완료된 상태는 아님.
다음: 호환 링크의 소비자 경로를 파악하고, 중복 검증 산출물 및 임시 생성물을 삭제 가능 여부별로 검토. 현재 소스/DB/모델 유지.
