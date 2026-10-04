# 메뉴 저장 404 수정 — 2026-10-01

## 원인 및 설계
개발 서버 5175의 vite.config.ts가 조회용 page-data와 menu-data는 프록시했지만, POST /admin/system/runtime-command/execute를 프록시하지 않았다. 인증된 메뉴 관리 화면에서 저장할 때 Vite가 404를 반환했다. 로그인 문제와 별개다.

## 변경
- 기존 명령 API를 백엔드 18000으로 전달하는 한·영문 프록시를 추가했다.
- 메뉴 전용 저장·노출·연결·순서 API도 명시적으로 프록시했다. 메뉴 페이지 자체는 프록시하지 않는다.
- 인증, CSRF, 기존 명령 권한 검사는 변경하지 않았다.
- 임시로 시도한 메뉴 페이지 API 교체는 원복했다. 최종 제품 코드 변경은 vite.config.ts뿐이다.
- H1030303 공정별 기여도의 URL을 /lca/process-contribution-analysis로 저장했다. 메뉴명·코드·권한은 유지했다.

## 검증
- 수정 전: 관리자 UI에서 메뉴 저장 시 Unexpected response format (404) 재현.
- 수정 후: 동일 UI 저장 후 별도 /api/home 조회에서 정확한 새 URL 확인.
- 비로그인 명령 요청: 302 로그인 이동. 인증 우회 없음.
- 빌드·DB 직접 수정·백엔드 재배포 없음. Vite 설정 자동 재시작으로 반영.
- LCA 전체 메뉴 통합과 미구현 분석·보고 화면 개발은 이번 저장 장애 수정의 완료 범위가 아니다.

## 복구
서버 /opt/Resonance/.codex-backup/menu-save-20261001/vite.config.ts를 원래 위치로 복원한다. H1030303 URL의 이전 값은 /emission/lca?menu=H1030303이며 관리자 메뉴 편집에서 복원할 수 있다.

## 재발 방지
메뉴 수정 완료 기준은 로그인 성공이 아니라 저장→새 요청 재조회→실제 링크 확인이다. menu-proxy-regression.test.mjs로 저장 API와 화면 경로의 분리를 검사한다.
