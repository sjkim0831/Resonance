# /opt 폴더 분리 설계 및 실행 결과

2026-09-08. 요청: CCUS/P006 웹앱 외 자원을 /opt 아래로 분리. reference와 프로젝트 소스는 변경하지 않음.

## 실제 이동

|기존 /opt/Resonance 상대 경로|새 실제 경로|
|---|---|
|runtime/postgresql16|/opt/databases/ccus-production|
|runtime/host-data/postgresql-dev|/opt/databases/ccus-development|
|runtime/host-data/developer-tools|/opt/developer-tools|
|var/test-evidence|/opt/test-evidence|
|runtime/tools/ai|/opt/ai|

기존 경로는 호환 심볼릭 링크로 유지. 설정을 모두 새 경로로 전환한 상태는 아님. 같은 파일시스템 rename으로 데이터 복사나 삭제 없이 이동했고 디렉터리 inode 일치를 확인함. AI 심볼릭 링크 43개 검사, 새로 끊긴 링크 0개.

## DB 절차와 검증

운영 DB 준비 상태 확인 → 정상 종료 → 경로 이동과 링크 생성 → DB 시작 → 35433 연결 수락 확인. 개발 DB는 postmaster.pid가 없는 정지 상태에서 이동함. DB 포함 첫 이동 스크립트 5.08초, AI 이동 검사 0.72초. 이 시간은 전체 작업 시간이나 실제 서비스 중단 시간과 다름.

DB 종료에 따라 CCUS 백엔드도 중지되어 별도로 재시작함. 최종 DB, CCUS 백엔드, 프론트, P006 웹, Omniverse 웹 서비스 5개 active.

홈 브라우저 HTTP 200, 제목 CCUS 탄소중립 플랫폼, 검사 스크립트 오류 0. 스크린샷에서 메뉴, 검색 아이콘, 도움말, QA 업무, 화면 설계, 업무 길잡이 표시 확인. 로그인·PDF 발급·DB 업무 저장·AI 추론·P006 전체 업무 E2E는 이번에 실행하지 않음.

## 용량과 남은 작업

/opt/Resonance 표시 용량 약 131GiB → 42GiB. 삭제에 의한 디스크 확보가 아니라 약 89GiB 경로 분리. /opt/ai 63GiB, databases 약16GiB, developer-tools 약11GiB, test-evidence 약1.3GiB (du 반올림).

아직 runtime/host-data/user-local 공용 라이브러리, 실행 환경, 워크트리, 각종 운영 설정이 Resonance 안에 남음. 따라서 웹앱 외 전체 분리 완료는 아님. 다음은 공유 라이브러리와 실행 환경의 소비 경로를 확인하고 분리하는 작업. 호환 링크 제거는 모든 소비 경로 전환 후 진행해야 함.

핵심: 경로 이동과 불필요 파일 삭제는 다르며, 실행 중인 소비 경로를 보존해야 서비스가 유지됨.
