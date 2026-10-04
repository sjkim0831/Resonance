# 운영 DB 이벤트 데이터 폐기 결과

2026-09-08 약3분. 사용자 요청에 따라 carbonet 운영DB의 public.trace_event, public.access_event, public.audit_event 데이터만 폐기.

대상 확인: port35433, data_directory=/opt/Resonance/runtime/postgresql16/data. DB명/경로/포트/일반테이블3개 검사. 외래키0건, 사용자 트리거0건. 트랜잭션 내 잠금 획득 후 트리거 재검사. lock_timeout2초, statement_timeout15초. CASCADE 없이 TRUNCATE CONTINUE IDENTITY RESTRICT 실행 및 COMMIT 성공. 테이블/인덱스 정의와 시퀀스 유지. 다른 업무 테이블 변경SQL 없음. 백업 미생성, 이번 삭제 데이터의 작업 자체 복원 수단 없음.

| 테이블 | 이전 bytes | 삭제 직후 bytes | 삭제 직후 행수 | 후속 조회 신규 행수 |
|---|---:|---:|---:|---:|
| access_event | 19,295,420,416 | 24,576 | 0 | 8 |
| audit_event | 22,689,005,568 | 24,576 | 0 | 6 |
| trace_event | 17,707,720,704 | 24,576 | 0 | 15 |

회수 약55.5926GiB. 운영DB 디렉터리64GiB→7.8GiB. /opt/Resonance 단독 sudo du 재집계133GiB. 여러 중첩 경로를 한 du 호출에 전달한 값은 중복 산정 방지로 전체가 작게 나오므로 단독 집계를 채택했다.

TRUNCATE5.489ms, COMMIT512.376ms. 서비스 재시작0회. 짧은 테이블 잠금 동안 해당 테이블 쓰기는 대기할 수 있으며 무중단 지연0을 보증하지 않음. 새 이벤트는 계속 수집되며 보존기간/자동정리 정책은 변경하지 않았다.

검증: 서비스5개 active. 홈 실제 브라우저HTTP200, 제목CCUS, pageerror0. 스크린샷 시각 확인. 로그인/PDF 전체 E2E 미수행. 개발DB 이번에 변경하지 않음.

![홈 검증](CCUS_production_event_cleanup_home_20260908.png)

원씽: 업무 데이터와 테이블 구조를 보존하고 지정 이벤트 이력만 폐기했다.
다음 필요 작업: 재증가 방지를 위한 이벤트 보존기간/집계 정책을 별도로 결정한다. 임의 자동삭제 정책은 적용하지 않았다.
운영: http://172.16.1.232/home
