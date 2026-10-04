# CCUS 빌드 잔여 파일 차이 검토

2026-09-08. 대상: /opt/Resonance/apps/carbonet-api/build/resources/main. 약 3분. 파일 변경·삭제·서비스 재시작 없음.

## 확인 결과
1. application.yml: 원본에 있는 data.jpa.repositories.bootstrap-mode 블록 및 sdk-sha256 항목이 출력 복사본에는 없다. 민감한 값은 기록하지 않았다.
2. V20260723051000__close_step_schema_set_blockers.sql: 25행 requirement_text가 원본에서는 한글 회원가입 완료 안내, 출력 복사본에서는 과거 영문 안내다. 나머지 행은 동일하다.
3. application.yml.bak: 12,643 bytes. 원본 및 출력 application.yml 모두와 내용이 다르므로 중복 파일로 단정하지 않았다.
4. build/resources/main 전체는 약 3.7MiB다. 확인한 스크립트 참조 1건은 검증 스크립트의 문자열 검사이며, 이것만으로 모든 사용 가능성을 배제할 수 없다.

## 판단 및 재발 방지 설계
원본과 출력의 차이는 과거 산출물 재사용 위험을 보여주지만, 현재 실행 화면이 이 SQL에서 생성됐다는 증거는 아니다. 이번 조사에서 DB SQL을 실행하거나 마이그레이션 이력을 수정하지 않았다.

패키징 시 기존 build/resources를 그대로 재사용하지 말고 원본을 기준으로 새 출력 디렉터리를 구성하며, 파일 목록과 해시의 일치를 검사한 뒤 패키징해야 한다. 설정 백업의 고유 변경 내용을 확인하기 전에는 자동 삭제하지 않는다. 이 방안은 제안이며 아직 구현하지 않았다.

## 검증 및 한계
주요 서비스 5개 active 확인: CCUS backend/frontend, PostgreSQL, P006, Omniverse. 화면 변경이 없는 파일 비교 작업으로 신규 브라우저 시각 검사 및 로그인/PDF E2E는 수행하지 않았다.

원씽: 오래된 출력 파일이 원본 대신 재사용되지 않게 하는 것이 작은 잔여 파일 삭제보다 우선이다.
다음 작업: application.yml.bak의 고유 설정 키 차이와 패키징 경로를 확인해 보존 또는 삭제를 결정한다.

운영 확인: http://172.16.1.232/home
