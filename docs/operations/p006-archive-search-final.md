# P006 추가 압축본 검색 결과

2026-09-08. 다운로드 폴더의 나머지 zip/7z/tgz/tar.gz 33개를 목록 검사했다. 이전에 검사한 전체 Resonance 및 carbonet_production 압축본2개는 반복하지 않았다. 33개 모두 목록 명령 정상 종료. 결과 원장: remaining-archive-audit.json.

검색 항목은 PostgreSQL 물리 백업의 PG_VERSION/global/1262/pg_control/backup_manifest, woosu 덤프/SQL, dump/backup/sql.gz 및 중첩 tar 파일이다. 모든 중첩 압축을 무제한 재귀 해제한 것은 아니다.

새 덤프 후보는 member-process-recovery-20260904/20260904T102518Z.tar.gz 안의 database/member-design-contracts.dump였다. 그 파일만 검사 폴더로 추출하고 pg_restore -l로 조회했다. TABLE DATA8개는 framework_process_definition, framework_process_step 등 업무 설계 테이블이며 P006 dt_* 계정·업무 테이블은 목록에 없었다. DB 복원은 하지 않았다.

제품 선택 덤프와 회원 복구용 중첩 소스 tar도 확인했으나 P006 전용 덤프 또는 구 Patroni 물리 백업은 이번 검색에서 확인되지 않았다. 서버의 관련 저장 위치에서 발견된 압축파일은 도구 라이선스·크래시 덤프·설계/QA 패키지 등이었다. reference는 이번 서버 압축 검색에서 제외했다.

삭제 기록 CCUS_P006_remaining_backups_20260908.md의 p006-backups 삭제344064바이트는 8월 HTML/JS/라우팅 사본으로 기록돼 있으며, DB 덤프 삭제 증거로 해석할 수 없다. 구 Patroni 데이터 자체의 정확한 삭제 작업·시점은 이번에 확정하지 못했다.

결론: 현재 조사한 원본들로 기존 P006 계정·업무 데이터를 복구할 수 있다고 확인할 수 없다. DB가 원래 비어 있었다는 결론도 내릴 수 없다. 외부 전달본 또는 다른 장치의 전체 PostgreSQL 백업이 있으면 추가 확인해야 한다. 그것이 없으면 사용자 승인 아래 남은 설계·소스·USD로 새 DB를 재구축할 수 있지만 기존 데이터 복원과는 다르다.

이번 작업은 파일 목록·덤프 목차 조회이며 현재 DB/서비스/화면 변경 없음. 새 시각검수 없음. 추가33개 목록 검사 및 후보 추출·목차 확인은 약30초 수준의 도구 실행 시간으로 진행했다.
