# P006 진입 경로·빈 화면 개선

2026-09-08. 폴더 이동 후 웹 응답 진단. 폴더 이동은 보류하고 2개 소스만 수정했다.

## 확인 원인

1. 공통 프록시는 /projects/P006을 5174로 보내지만 5174는 정확한 진입 경로를 처리하지 않고 80으로 다시 전달했다. 반복 프록시를 막기 위해 GET/HEAD /projects/P006 및 /r/P006 진입을 /projects/P006/digital-twin으로 302 처리했다.
2. P006 로그인 상태 API는 과거 Kubernetes 주소 10.102.179.101:80을 여전히 사용한다. 현재 요청 결과502. 5174 웹 프록시 실행만으로 인증 백엔드가 정상이라는 뜻은 아니다.
3. UI는 로그인 상태 조회가 끝날 때까지 초기 화면을 표시하지 않았다. 즉시 기본 화면과 조회 중 상태를 렌더링하고, 8초 제한 또는 오류 시 연결 실패 안내와 재시도 버튼을 표시하도록 수정했다. 인증 우회 없음.
4. 5173 Omniverse 루트는 resetStream 완료를 기다린다. /api/status 결과 STARTING, signalingReady:false, stageReady:false. 루트 조회 코드에 스트림 재시작 부작용이 있음을 확인했으며 3D 정상으로 보고하지 않는다.

## 변경 파일

- /opt/Resonance/runtime/host-data/web-viewer-sample/p006-access-proxy.mjs
- /opt/Resonance/projects/P006/frontend/p006.js

node --check 통과. P006 웹 프록시만 재시작. 별도 빌드 없음. GET 진입 후 HTTP200 약2.06초. 실제 브라우저에서 최종 주소, 메뉴, 서버 연결 실패 안내, 다시 시도 버튼 확인. 검사3.408초, pageerror0. 인증 API502는 남아 있으므로 로그인·업무 기능 복구 완료가 아니다.

## 다음 작업

P006 인증 백엔드 구현 및 로컬 DB 연결 상태를 찾아 구동하고, 과거 Kubernetes 목적지를 검증된 로컬 포트로 전환해야 한다. P006/runtime 범위에서 확인한 파일은 scenario_store.py이며 해당 범위에서 실행 JAR는 찾지 못했다. 시스템 전체에 백엔드 소스가 없다는 의미는 아니다. 이후 인증·저장·3D 렌더링을 별도로 검증하고 폴더 이동을 재개한다.
