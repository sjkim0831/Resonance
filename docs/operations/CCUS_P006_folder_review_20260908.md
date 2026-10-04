# P006 연결 폴더 정리 후보 검증

2026-09-08. 약 2분. 삭제 0건, 재시작 0회.

| 대상 | 용량 | 확인 및 결정 |
|---|---:|---|
| runtime/host-data/web-viewer-sample | 194MiB | P006 proxy와 Omniverse web Node 프로세스 2개가 cwd로 사용. 보존 |
| runtime/host-data/home-organized-20260907/linked-projects/OmniverseProjects | 2.6GiB | /home/sjkim/OmniverseProjects 링크 대상. 실제 proxy가 조립 상태·Python 작업·보고서·레이어 관련 파일을 참조하며 web server는 recordings를 참조. 보존 |
| runtime/host-data/home-organized-20260907/linked-projects/kit-app-template | 2.2GiB | /home/sjkim/kit-app-template 링크 대상. p006-rtx-warmup 서비스가 _build/linux-x86_64/release를 작업 디렉터리로 설정. 통째 삭제 금지 |

linked-projects 전체 약 4.7GiB. 반올림 때문에 하위 합계와 차이 날 수 있다.

## 판단
sample, linked-projects, _build라는 이름은 미사용 근거가 아니다. P006 및 Omniverse 기능 보존 조건에 따라 이 2개 후보 폴더를 일괄 삭제 목록에서 제외한다. 모든 하위 파일이 필요하다고 판정한 것은 아니다.

## 검증 한계
CCUS, P006 web, Omniverse web 서비스 active 확인. lsof와 systemd 및 코드 참조 확인. 신규 브라우저 시각 검수·인증된 P006 기능 E2E는 미수행이며 파일 변경도 없다.

다음 정리: 후보 선정 전에 서비스 WorkingDirectory/ExecStart 및 심볼릭 링크를 먼저 대조하고, 실행 폴더 밖의 캐시·임시 산출물만 대상으로 좁힌다.
원씽: 실제 참조로 확인한 실행 자산은 폴더명과 무관하게 보호한다.
운영 확인: http://172.16.1.232/home
