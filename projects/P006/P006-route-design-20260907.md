# P006 접속 경로 설계 및 검증

2026-09-07. 대상: http://172.16.1.232/projects/P006/digital-twin/factory-studio

## 경로

- 프로젝트: /opt/Resonance/projects/P006
- 프런트엔드: /opt/Resonance/projects/P006/frontend
- USD 진입 경로: /home/sjkim/OmniverseProjects (심볼릭 링크)
- 웹 프록시 실행 파일: /opt/Resonance/runtime/host-data/web-viewer-sample/p006-access-proxy.mjs
- 공통 진입 프록시: /opt/Resonance/ops/runtime/ccus-dev-proxy.mjs

## 라우팅 계약

1. /projects/P006 및 하위 경로: 127.0.0.1:5174
2. /r/P006 및 하위 경로: 127.0.0.1:5174
3. 위 경로의 WebSocket Upgrade도 동일 대상 사용.
4. 다른 경로는 기존 CCUS 처리 유지.
5. 단순 문자열 prefix 대신 경계 검사로 P006-other 등의 오인 매핑 방지.

## 검증 결과

- 수정 전 factory-studio: CCUS 탄소중립 플랫폼 HTML.
- 수정 후 factory-studio: HTTP 200, Woosu Factory Studio, 8694 bytes.
- p006.js: HTTP 200, text/javascript, 9029 bytes.
- 루트 /: HTTP 200, CCUS 탄소중립 플랫폼.
- node --check: 통과.
- 서비스 restart 후 active. 복사 및 재시작 명령 묶음 1.54초, 빌드 없음.
- auth/session: 15초 timeout. 성공으로 판정하지 않음.
- P006 runtime 로그: PostgreSQL 인증 연결 중 EOFException 확인.
- 실제 P006 로그인/업무 화면 시각 검수 완료 아님.

## 남은 작업

P006 백엔드의 DB 연결 오류를 복구한 후 로그인, 캔버스, 미리보기의 프로세스 검증과 스크린샷을 확보한다. 라우트 복구와 업무 사용 가능 여부는 별도로 판정한다.

## 복구

백업: /opt/Resonance/ops/runtime/ccus-dev-proxy.mjs.bak-p006-20260907
원본 백업 복구 후 carbonet-dev-proxy.service 재시작.
