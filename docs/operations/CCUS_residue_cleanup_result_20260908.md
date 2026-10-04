# CCUS 잔여 파일 정리 결과

2026-09-08. 약 1분 점검·작업, 최종 검사와 삭제 명령 1.24초. 서비스 재시작 0회.

## 삭제 4개

| 경로 | bytes |
|---|---:|
| /opt/Resonance/.auto-deploy.pid | 5 |
| /opt/Resonance/.file-watch.pid | 8 |
| /opt/Resonance/NUL | 12,715 |
| /opt/Resonance/apps/carbonet-api/target/project-runtime.jar.original | 1,788,027 |

합계 1,800,755 bytes, 약 1.72MiB. 디스크 실제 확보 블록 수를 별도로 측정한 값은 아니다.

## 안전 검사

절대경로가 /opt/Resonance 안에 있는지, 일반 파일인지, 하드링크 1개인지, 해당 루트 내 심볼릭 링크가 연결되지 않았는지 확인했다. lsof로 열린 파일 없음, 두 PID 파일의 프로세스 없음 확인. 삭제 직전 inode 재확인 후 4개 파일만 unlink했다. 루트 외부의 모든 참조를 완전 탐색한 것은 아니다.

Dockerfile/.dockerignore, target/build 폴더, 소스, .git, .githooks, DB, 모델, reference는 유지했다. .file-watch.pid는 감시 스크립트 재실행 시 다시 생성될 수 있는 상태 파일이다.

## 적용 후 검증

CCUS 백엔드·프런트엔드·PostgreSQL·P006·Omniverse 서비스 5개 active. 백엔드 health UP. 홈 HTTP 200, 브라우저 pageerror 0. 스크린샷에서 헤더·검색 아이콘·업무 길잡이·QA·화면 설계 버튼을 확인했다. 관리자 로그인/PDF/P006 내부 기능 전체 E2E를 수행했다는 의미는 아니다.

![삭제 후 홈](CCUS_residue_cleanup_home_20260908.png)

원씽: 검증한 잔여 파일만 제거하고 폴더 전체 삭제로 확대하지 않는다.
다음: target/build를 참조하는 과거 배포 스크립트와 현재 사용 경로를 구분한다.

운영: http://172.16.1.232/home
