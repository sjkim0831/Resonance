# /opt 분리 3차 설계 및 검증

2026-09-08. 운영 설정과 P006 환경을 분리하는 작업.

## 확정 이동 6개

기존 `/opt/Resonance/runtime/host-data/` 아래 acme, pki, tls, config, user-config, test-credentials를 `/opt/ccus-runtime/host-config/` 아래 같은 이름으로 이동. 기존 위치에는 호환 심볼릭 링크 유지. 비밀 파일 내용은 열거나 출력하지 않음. 파일 삭제·서비스 재시작 없음.

## P006 이동 보류

kit-app-template 및 OmniverseProjects를 /opt/p006-runtime 아래로 이동했으나, 이후 P006 HTTP 요청이 타임아웃되어 두 폴더의 물리 위치를 원래 위치로 되돌림. 원래 위치는 `/opt/Resonance/runtime/host-data/home-organized-20260907/linked-projects/` 아래다. 빈 /opt/p006-runtime 디렉터리만 제거함.

이동 후 새로 끊긴 링크는 없었음(운영 설정13개, P006237개 검사). 원래 위치 복원 후에도 5173 루트 요청이 5초 타임아웃. 따라서 단순 이동 경로만 원인이라고 단정할 수 없고, 이동 전 P006 HTTP 비교 결과가 없으므로 기존 장애라고 단정할 수도 없음.

## 검증 및 제한

주요 서비스5개 active. CCUS 홈 새 브라우저 검사 HTTP200, 제목 CCUS 탄소중립 플랫폼, 검사 오류0. 스크린샷에서 헤더·메뉴·아이콘·도움말·QA·화면 설계·업무 길잡이 확인. P006은 active 상태와 다르게 HTTP 응답 검증 실패. P006 시각검수와 로그인/업무 E2E는 완료하지 못함.

초기8폴더 이동/링크 검사0.04초. P006 요청은 5~8초 제한에서 반복 타임아웃. 전체 완료로 보고하지 않으며 추가 이동 중단. 다음 우선 작업은 P006의 실제 웹 응답 장애 진단. 정상 응답을 확보한 뒤 P006 환경 분리 재시도.

핵심: 서비스 active는 웹 기능 정상과 다르므로 HTTP/화면 검증 실패 시 위치 변경을 확정하지 않는다.
