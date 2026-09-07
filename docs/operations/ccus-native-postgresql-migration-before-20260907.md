# 독립 PostgreSQL 이전 — 진행 중

## 최종 전환 실행 시작 (2026-09-06 23:15)
사용자가 40~60분 유지보수 중단을 승인했다. ccus-native-db-cutover.service를 독립 systemd 작업으로 실행 중이다. 증거 경로 /opt/resonance-data/backups/native-final-20260906-231522. 웹앱 backend 중단, 활성 carbonet/resonance 타이머 목록 기록 및 정지, 원본 carbonet DB default_transaction_read_only=on 설정과 기존 세션 종료 후 최종 백업을 시작했다.

최종 백업→원본 테이블별 정확한 행 수 기록→시험 후보 DB만 재생성→최종 데이터 복원→전체 public 테이블 행 수 비교 및 인덱스 검증→환경파일 override 적용→Java 재시작→health 및 실제 TCP 35433 연결 확인 순서다. 실패 시 원본 DB readonly 설정을 복구하고 기존 backend/timer 시작을 시도한다. 성공 후 원본은 readonly로 보존하고, 자동 작업들은 구 DB 주소 사용 여부 점검 전까지 정지 상태로 남긴다. 로그인/PDF/진위확인 실제 사용자 E2E는 자동 health 성공과 별도다. Kubernetes 및 원본 볼륨 삭제는 하지 않는다.

작업 상태: sudo journalctl -u ccus-native-db-cutover.service. 성공 마커 CUTOVER_READINESS_PASS_SECONDS, 실패 시 ROLLBACK_BEGIN/ROLLBACK_DISPATCHED를 확인한다. 중간에 임의로 작업 프로세스를 kill하지 않는다. 현재 백업/복원 완료와 운영 전환 성공은 아직 확인되지 않았다.

## 최신 검증: 시험 복원 완료
2026-09-06 22:15:46 후보 전체 복원 완료. full-restore.log 오류 없음. 원본/후보의 public 객체 수가 모두 일치: 테이블 418, 인덱스 779, 시퀀스 127, 뷰 83. 양쪽 무효 인덱스 0. 후보 DB 크기 62GB. 현재 운영 Java의 계정·비밀번호를 출력하지 않고 후보 TCP 127.0.0.1:35433 연결을 시험하여 성공했다. 해당 앱 역할이 볼 수 있는 information_schema.tables 수 477. 실제 로그인/PDF 발급 E2E는 아니다.

백업 시작 21:39:56 → dump 생성 22:04:54 (약 25분), 후보 복원 완료 22:15:46 (백업 후 약 11분). 최종 일관 백업/복원을 재수행하는 방식은 검증 포함 약 40~60분 유지보수 시간을 예상한다. 이는 기존 짧은 재시작 범위와 달라 별도 확인 후 쓰기를 중단한다. 운영 연결과 원본 DB는 아직 변경하지 않았다. 현재 /opt 여유 약 93GB이므로 최종 복원은 검증용 후보를 정리해 공간을 재사용하는 계획이 필요하며 운영 원본을 삭제하지 않는다.

## 최신 진행: 전체 백업 완료, 시험 복원 시작
carbonet.dump 생성 완료: 6,222,084,984 bytes (약 6.22GB). TOC 생성 및 SHA256 검증 OK. 복원 대기 작업이 새 독립 DB carbonet을 생성하고 병렬 복원을 시작했다. pg_stat_progress_copy에서 access_event/audit_event COPY FROM 진행을 확인했으며 초기 확인 시 후보 DB 2,365MB. 아직 전체 복원 완료·운영 전환·실제 업무 검증이 완료된 상태는 아니다. 원본 DB에 백업 이후 쓰기가 있으므로 이 후보를 그대로 운영으로 연결하지 않는다.

## 2026-09-06 준비 결과
- 운영: Kubernetes carbonet-prod/postgres-haproxy, 10.99.213.163:5432, PostgreSQL 16.3.
- 주 DB carbonet: 73,246,896,611 bytes. 감사/접근/추적 이력은 제외하지 않음.
- 새 후보: /opt/ccus-postgresql16, PostgreSQL 16.15 공식 PGDG 패키지를 격리 다운로드·추출. OS PostgreSQL 18과 개발 DB 35432를 변경하지 않음.
- 후보 포트: 127.0.0.1:35433, socket=/opt/ccus-postgresql16/socket, data=/opt/ccus-postgresql16/data.
- 서비스: ccus-postgresql-native.service, 후보로만 실행하며 운영 연결은 바꾸지 않음.
- 역할 복원 및 ccus_schema_check 스키마 시험 복원: public 테이블 418개, plpgsql/pg_trgm 성공.

## 백업과 복원
백업 경로: /opt/resonance-data/backups/native-postgres-20260906-213956.
globals.sql에는 비밀번호 해시 등 민감정보가 있으므로 공개/일반 배포/Git 포함 금지.
carbo​net.dump.partial 생성 중에는 백업 완료로 판단하지 않는다. dump 완료 후 TOC 확인, SHA256 생성이 끝나야 한다.
restore-native-candidate.sh는 백업 완료를 기다린 뒤 여유 공간 95GB 이상과 체크섬을 확인하고 새 carbonet DB에 병렬 복원한다. 완료 시 /opt/ccus-postgresql16/log/candidate-result.txt에 결과를 남긴다. full-restore.log는 상세 복원 결과다. 자동으로 운영 DB 연결을 바꾸거나 원본을 삭제하지 않는다.

## 미완료 및 전환 조건
전체 데이터 복원·업무 데이터 검증·실제 로그인/PDF 발급/진위확인 검증은 아직 완료되지 않았다. 초기 백업 중 원본에 계속 쓰기가 발생하므로 이를 그대로 운영으로 연결하면 안 된다. 최종 전환에는 쓰기 중단과 최종 일관 백업 또는 검증된 변경분 동기화가 필요하다. P004/P005/P006, Redis, Keycloak, Backstage 등 다른 사용처를 아직 이전하지 않았으므로 Kubernetes 삭제 불가.

## 복구 정책
현 운영 DB와 연결 설정을 그대로 유지한다. 후보 장애는 운영 DB 전환 사유가 아니다. 후보 결과 검증 후에도 구 DB를 즉시 삭제하지 않는다. 동일 16 계열을 사용하지만 OS libc/locale 차이가 있으므로 논리 복원으로 인덱스를 재작성한다. 전체 복원 완료 시간은 현재 확정할 수 없다.

공식 패키지 안내: https://www.postgresql.org/download/linux/ubuntu/
