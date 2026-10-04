# CCUS 네이티브 오류 수집기 연결 복구

2026-09-08 약 6분. 백엔드·프록시 재시작 0회, 외부 알림 발송 0건, 과거 데이터 삭제 0건.

## 구현

- /opt/Resonance/ops/scripts/ccus-runtime-alert-collector.py 신규 등록.
- carbonet-runtime-alert-collector.service를 현재 스크립트로 변경. User=sjkim, 기존 설치 psycopg2 사용. root Python에는 해당 모듈이 없어 서비스 사용자와 실제 실행 환경을 맞췄다.
- DB는 carbonet-production-direct.service의 MainPID 환경에서 읽는다. 18000 socat 프로세스나 Kubernetes를 사용하지 않는다. 자격증명은 출력하지 않는다.
- 기존 프록시 생산자는 runtime/platform-data/dev-worktrees/certificate-verification/var/dev-design-sync/runtime-alert-events.jsonl에 기록한다. 생산자와 일치하는 이 경로를 그대로 감시한다. 모든 경로를 단일화한 작업은 아니다.
- 체크포인트는 /opt/Resonance/var/dev-design-sync/native-alert-collector에 저장한다. 초기 약 1.7GB 파일의 끝에서 시작하여 과거 이벤트를 재처리하지 않는다. 원본은 그대로 보존한다.
- 허용한 오류 source 4종만 저장하며 원래 occurredAt을 유지한다. 15분 이전 이벤트는 신규 장애로 올리지 않는다. query 문자열은 저장 payload에서 제외한다.
- 신규 실패 및 DETECTED/ASSIGNED 전이 2건을 같은 트랜잭션에 저장한다. DB 실패 시 체크포인트는 전진하지 않는다. 재시도는 source별 미확인 실패 유일 제약으로 중복 방지한다.
- 외부 발송·자동 해결·에스컬레이션은 수행하지 않는다. 녹화 성공 상태를 생성하지 않는다.

## 검증

실제 서비스의 DB 사용자로 격리 스키마에서 7개 검증 통과:

1. 새 실패 저장.
2. 같은 이벤트 재처리 중복 방지.
3. 전이 이력 2건.
4. 원래 시각 보존 및 쿼리 문자열 제외.
5. 오래된 이벤트를 현재 장애로 저장하지 않음.
6. 알 수 없는 source 제외.
7. 발송 원장 0건.

테스트 데이터는 롤백하고 새로 생성한 빈 테스트 스키마만 제거했다. 운영 원장 INSERT/SELECT 및 시퀀스 USAGE 권한도 확인했다.

운영 실행: oneshot Result=success, ExecMainStatus=0. 작업 후 inactive는 대기형 oneshot의 정상 상태다. path 감시는 active/success.
초기 실행 결과는 baseline saved, 다음 실행은 no complete new events였다. 새 자연 발생 오류가 없어 운영 장애 1건 저장까지 검증된 것은 아니다. 이를 검증하려고 운영에 고의 장애를 발생시키지 않았다.

홈 HTTP 200, pageerror 0. 캡처에서 헤더·검색 아이콘·업무 길잡이·QA·화면 설계 표시 확인. 관리자 인증 알림센터 E2E는 미수행이다.

![홈 확인](CCUS_native_collector_home_20260908.png)

## 한계와 다음 작업

- 이번 수집기는 오류 이벤트 파일용이다. 9월 6일의 오래된 녹화 상태 파일을 새 녹화 결과로 재등록하지 않았다.
- 최초 체크포인트 이전의 오류는 원본에만 남는다. 과거 감사 원장 복구가 아니다.
- 1회 최대 1MiB 읽기이며 줄바꿈이 완료된 이벤트만 처리한다. 과도한 backlog 및 1MiB 초과 단일 줄에 대한 별도 운영 경고·배치 반복은 후속 보강 대상이다.
- invalid/historical 이벤트는 원본에 보존하며 통계로 구분하지만 자동 재처리하지 않는다.
- 잠금으로 동시 실행을 막는다. 파일 교체·축소는 inode/크기로 판별한다.
- 이 작업은 도움말·업무 프로세스 변경이 아닌 공통 오류 수집 설계이며 임의 업무 문구를 추가하지 않았다.

원씽: 수집기 성공과 실제 업무·녹화 성공을 구분한다.
다음은 관리자 인증 상태에서 감사 API와 알림센터를 확인하고, 새 오류가 들어왔을 때 실제 원장 저장까지 검증하는 것이다.

운영: http://172.16.1.232/home
