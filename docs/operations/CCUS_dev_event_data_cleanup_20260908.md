# 개발 DB 이벤트 3개 테이블 데이터 폐기 결과

2026-09-08 약4분. 사용자 승인 범위: 개발 DB 자체는 보존하고 trace_event/access_event/audit_event 데이터만 폐기.

## 대상 및 실행 설계
PostgreSQL18 carbonet_dev, data_directory=/opt/Resonance/runtime/host-data/postgresql-dev/18/data. 기존 서비스는 중지 상태이고 설정의 과거 경로가 유효하지 않아, 영구 설정 변경 없이 임시 pg_ctl 인자로 실제 데이터 경로 지정. listen_addresses는 빈 값, postgres 전용700 Unix socket /tmp/ccus-dev-event-maintenance, port35432. 외부 접속 없이 실행하고 종료 후 원래 중지 상태 복귀. 운영35433 서비스는 재시작하거나 데이터 변경하지 않음.

## 데이터 변경
public.trace_event, public.access_event, public.audit_event만 TRUNCATE CONTINUE IDENTITY RESTRICT. CASCADE/RESTART IDENTITY/DROP 사용 안 함. 대상3개 ordinary table 확인 및 외래키/사용자트리거0건 확인. 트랜잭션에서 실행하고 COMMIT 완료. 테이블·인덱스 구조와 시퀀스 값 유지. 백업 생성하지 않았으므로 이번 작업 자체로 삭제 이력 복원 불가.

| 테이블 | 이전 total relation bytes | 이후 bytes | 이후 정확한 행 수 |
|---|---:|---:|---:|
| access_event | 19,712,843,776 | 24,576 | 0 |
| audit_event | 23,795,097,600 | 24,576 | 0 |
| trace_event | 18,120,761,344 | 24,576 | 0 |

확보 relation 공간61,628,628,992bytes=57.396GiB. 개발 DB 디렉터리65GiB→7.4GiB, /opt/Resonance 전체약189GiB. du 표시는 반올림.

다른 public 일반 테이블438개의 OID/relfilenode가 그대로임을 트랜잭션 내 검사했다. 이 검사는 모든 행의 해시 비교는 아니며 다른 테이블에 대한 변경 SQL은 실행하지 않았다.

## 검증
임시 개발 DB 정상 종료.35432 listener 없음. 운영35433 listener 유지. CCUS backend/frontend, native PostgreSQL, P006 web, Omniverse web 5개 active. 홈 실제 브라우저HTTP200, 제목CCUS, pageerror0. 스크린샷에서 헤더·검색·업무 길잡이·QA·화면 설계 버튼 표시 확인. 로그인/PDF 전체 E2E는 미수행.

![홈 검증](CCUS_dev_event_cleanup_home_20260908.png)

## 보존 및 다음 단계
개발 DB 전체, 다른 업무 테이블, 사용자/권한, 원본/모델/P006 보호. 운영 DB 데이터 삭제 없음. 개발 DB 상시 실행 경로 복구는 이번 범위가 아니므로 미수행. 다음 필요 작업은 개발 DB 설정 경로를 검토하여 정상 개발 구동을 복구하는 것으로, 이벤트 데이터 폐기와 별개다.

원씽: 개발 DB를 폐기하지 않고 지정한 이벤트 데이터만 비워 용량을 회수했다.
운영: http://172.16.1.232/home
