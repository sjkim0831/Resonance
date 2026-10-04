# P006 개발 DB 확인 결과

2026-09-08. 사용자의 기존 P006 데이터 확인 요청에 따라 /opt/databases/ccus-development/18/data PostgreSQL18을 검사했다.

## 방법

종료 상태와 postmaster.pid 부재를 확인한 후 TCP listen_addresses를 비우고 전용 로컬 소켓 /tmp/p006-dev-db-audit, 포트35432, default_transaction_read_only=on으로 임시 실행했다. 비템플릿 접속 가능 DB 및 dt_ 접두어/P006/woosu 이름의 테이블 메타데이터만 조회하고 finally에서 정상 종료했다. 사용자 데이터 생성·수정·삭제는 하지 않았다. PostgreSQL 시작/종료에 따른 내부 상태·로그 기록은 발생한다.

## 결과

|DB|P006 후보 테이블|
|---|---|
|carbonet_dev|0개|
|postgres|0개|

woosu_digital_twin DB 없음. 실행·조회·종료 스크립트0.24초. 검사 종료 후 postmaster.pid 없음. 개발 DB는 원래의 정지 상태로 복귀했다. 해당 클러스터에서 이름 기준으로 찾지 못한 결과이며, 모든 디스크·외부 서버·덤프에 P006 데이터가 없다는 의미는 아니다.

## 다음 판단

운영 클러스터에서도 앞선 검사에서 P006 DB/테이블을 찾지 못했다. 기존 데이터 복구를 위해 남은 DB 저장소 및 덤프의 파일 목록을 확인해야 한다. 원본을 찾기 전 빈 DB나 초기 관리자 계정을 만들지 않는다. 이번 작업은 DB 메타데이터 확인이므로 화면 코드 변경·새 시각검수는 수행하지 않았다.
