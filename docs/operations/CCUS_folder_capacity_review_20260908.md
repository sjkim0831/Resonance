# /opt/Resonance 용량 및 정리 후보 재집계

2026-09-08. 약 3분. sudo du -x 기준 실제 할당 블록 용량. 심볼릭 링크는 따라가지 않음. 하위 용량은 상위에 포함되므로 중복 합산 금지.

| 경로 | 용량 | 판단 |
|---|---:|---|
| /opt/Resonance | 248GiB | 관리자 권한 집계 |
| runtime | 242GiB | 전체 대부분 |
| runtime/host-data | 108GiB | DB·라이브러리·도구 포함, 일괄 삭제 금지 |
| runtime/postgresql16 | 64GiB | 현재 DB 보호 |
| runtime/tools | 63GiB | 사용 모델 및 운영 도구 보호 |
| runtime/platform-data | 7.7GiB | 활성 참조 포함 |
| var | 2.4GiB | 생성 이력별 검토 |
| projects | 1.8GiB | 프로젝트 코드·자산 보호 |
| .git | 1.4GiB | 저장소, 임의 삭제 금지 |
| apps | 735MiB | 코드 및 빌드 포함 |

## 묶음 검토 후보: 삭제 확정 아님
- runtime/host-data/user-local: 31GiB. Python 라이브러리 등 실제 의존성 확인 필요.
- runtime/platform-data/dev-worktrees: 5.1GiB. 현재 실행/수집 경로 참조가 있으므로 보호.
- runtime/host-data/home-organized-20260907/linked-projects: 4.7GiB. 연결 및 프로젝트 자산 여부 확인 필요.
- runtime/host-data/developer-tools: 3.2GiB. 개발 도구 캐시와 계정 데이터 구분 필요.
- runtime/host-data/build-repositories: 3.0GiB. Gradle/Maven/Playwright 의존성이므로 모두 미사용 아님.
- var/ai-runtime/system-design-generator/20260904T101023Z: 329MiB. 문서160MiB, development108MiB, snapshot52MiB 등을 포함. 설계 생성/복구 관련 스크립트에 system-design-generator 경로 참조가 발견되어 보존. 특정 실행 폴더 참조 여부는 추가 확인 필요.
- runtime/host-data/web-viewer-sample: 194MiB, node_modules183MiB. 서비스·프로젝트 참조 및 열린 파일 검사 후 삭제 판단 가능.

## 검증 및 한계
일반 계정 집계는 권한 부족으로 120GiB만 보였으므로 폐기하고 관리자 결과248GiB를 사용한다. 이번 삭제0건, 재시작0회. 화면 수정이 없어 신규 시각 검수는 수행하지 않았다. 서비스 전체 기능 정상 여부를 이번 용량 집계로 보증하지 않는다.

원씽: 대부분의 용량은 웹앱 코드가 아니라 DB·모델·라이브러리이며 사용 여부와 권한을 확인한 집계가 먼저다.
다음: web-viewer-sample 및 linked-projects의 실제 사용 관계부터 검토한다.
운영: http://172.16.1.232/home
