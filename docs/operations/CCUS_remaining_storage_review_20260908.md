# 잔여 용량과 개발 DB 실행 상태 점검

2026-09-08 약3분. 읽기 전용. 삭제0건, 재시작0회.

sudo du -x 기준 /opt/Resonance 약246GiB, runtime240GiB. 운영 PostgreSQL 경로64GiB, 별도 host-data/postgresql-dev65GiB, tools63GiB.

Gradle .tmp에서 7일 초과 파일을 발견하지 못함. daemon 로그도 최근9월 기록이므로 삭제하지 않았다. 기타 작은 캐시/임시 폴더는 이번에 보존.

개발 DB: pg_lsclusters의 PostgreSQL18/dev는 port35432 down. 설정 경로는 /opt/resonance-data/postgresql-dev/18/data이며 해당 경로 조회 실패. 현재 데이터 파일은 /opt/Resonance/runtime/host-data/postgresql-dev/18/data에 존재하며 PG_VERSION 확인. 해당 트리 깊이3 이내 postmaster.pid 미발견. postgresql@18-dev는 failed. 확인 포트5432/35432/35433 중127.0.0.1:35433만 postgres listener 존재.

이는 개발 클러스터가 현재 정상 실행되지 않는다는 증거이며, 개발 데이터가 불필요하거나 운영 DB와 동일하다는 증거는 아니다. 데이터 내용, 최신성, 복구 필요성, 운영 DB 대비 차이는 미검증이다. 실제 데이터 파일 삭제/복구/클러스터 시작은 하지 않았다.

원씽: 캐시 추가 삭제보다 큰 DB 보존 여부 결정이 용량에 큰 영향을 주지만, 정지 상태만으로 DB 삭제를 판단하지 않는다.
다음: 사용자에게 개발 DB65GiB 보존 필요 여부 확인 후, 삭제 선택 시 최종 사용/경로 검사를 수행한다.
화면 변경 없음. 신규 시각검수/E2E 미수행.
운영: http://172.16.1.232/home
