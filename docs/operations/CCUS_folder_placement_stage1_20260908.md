# 전체 경로 분류 및 위치 정리 1차

2026-09-08, 약 4분. 전체 파일·폴더 인벤토리에 역할별 분류 근거 추가.

## 실제 이동

- 기존 /opt/Resonance/runtime/host-data/user-local/share/kilo
- 신규 /opt/Resonance/runtime/host-data/developer-tools/kilo-user-data
- 약 5.9GiB. 같은 파일시스템에서 rename. 파일 내용 복사/삭제 없음.
- 기존 위치는 신규 위치를 가리키는 심볼릭 링크. 기존 도구의 기본 저장 경로 호환 유지.
- 열린 파일 없음 확인 후 이동. 최상위 파일 9개의 inode/크기 유지 검증. 비밀키/계정 내용 미열람.

## 분류 범위와 한계

이동 후 폴더 104,344개, 일반 파일 778,194개, 링크 4,127개 목록 수집. 링크 미추적, 열거 오류 0건.
classified-files.csv 및 classified-directories.csv에 category, classification_basis, placement_status를 제공.
경로 기준 역할 분류이며 모든 파일의 실행 필요성을 증명하는 것은 아님. 혼합 설치 환경과 추가 확인 항목은 개별 의존성 검토 전 이동/삭제하지 않음.

## 위치 원칙

CCUS/P006 소스는 현재 빌드 경로 유지. 공통 modules/ops/config/gradle은 공용 기반. 실행본/DB/AI/Omniverse는 runtime 하위 유지. 개발 도구 데이터는 developer-tools로 모음. 로그는 var에서 생산자별로 분류. 과거 이름이라도 현재 참조가 있으면 바로 삭제하지 않음.
새 폴더를 무조건 추가하거나 전체 경로를 강제 변경하지 않는다. 호환 링크는 임시 부채로 목록화하고 소비자 설정을 변경한 뒤 제거한다.

## 검증 및 다음

현재 서비스 5개 active. 홈 브라우저 회귀 검사 및 스크린샷 확인. 신규 빌드/로그인/PDF/P006 전체 E2E 미수행.
삭제 0건, 물리 이동 1개 폴더, 호환 링크 1개 추가, 서비스 재시작 0회. 용량 절감이 아닌 위치 정돈.
다음은 혼합 user-local 설치 환경과 developer-tools 실행 참조를 분리해 추가 이동/폐기 가능 항목을 선정. 전체 위치 정리 완료로 보지 않음.
