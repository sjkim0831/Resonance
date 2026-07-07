# Patroni 클러스터 복구 및 자동 복구 구현 계획

## 현황

| 구분 | 상태 | 비고 |
|------|------|------|
| postgres-ha-0 | ✅ Running, 182MB 데이터 | 실제 데이터 보유 |
| postgres-patroni-0,1,2 | ❌ 빈 클러스터 (stopped) | 3-node streaming replication 미구성 |
| haproxy → postgres-patroni | ❌ 연결 실패 | patroni health check 실패 |
| 앱 | ❌ DB 연결 불가 | HikariCP pool 고갈 |

**근본 원인**: Patroni 클러스터가 빈 상태로 운영중. Streaming replication 없이 각 노드가 독립적.

---

## Phase 1: 복구 (Recovery)

### 1-1. 데이터 백업
```bash
# postgres-ha-0에서 백업 수행
kubectl exec -it postgres-ha-0 -- pg_basebackup -h localhost -U replicator -D /tmp/backup -Fp -Xs -P -R
```

### 1-2. Patroni leader 초기화 (patroni-0)
```bash
# etcd에서 기존 클러스터 상태 정리
kubectl exec -it etcd-patroni-0 -- etcdctl del /patroni/postgres-patroni --prefix

# patroni-0에서 bootstrap
kubectl exec -it postgres-patroni-0 -- patronictl init --force

# 또는 patronictl bootstrap 사용
```

### 1-3. Streaming Replication 설정 (patroni-1, patroni-2)
Patroni는 automatic으로 replica를 설정합니다. leader가 되면 나머지 2개가 automatic으로 follow합니다.

### 1-4. 검증
```bash
# Patroni 클러스터 상태 확인
kubectl exec -it postgres-patroni-0 -- patronictl list

# Streaming replication 확인
kubectl exec -it postgres-patroni-0 -- psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# haproxy health check
curl http://postgres-haproxy:7000; curl http://postgres-haproxy:8008/primary
```

### 1-5. 앱 연결 검증
```bash
curl http://127.0.0.1:32947/actuator/health
```

---

## Phase 2: 재발 방지 - 모니터링

### 2-1. Patroni 클러스터 상태 모니터링 스크립트
**위치**: `/opt/Resonance/ops/scripts/patroni-monitor.sh`

**체크 항목**:
- leader 존재 여부
- 모든 멤버 상태 (running/stopped)
- replication lag
- etcd connectivity

**실행 주기**: 1분마다 cron

### 2-2. 알림 설정
-领袖 없을 때: Slack/Teams webhook
-멤버 down: Slack/Teams webhook
- replication lag > 10MB: Warning

---

## Phase 3: 자동 복구

### 3-1. Patroni Auto-Restart 스크립트
**위치**: `/opt/Resonance/ops/scripts/patroni-auto-heal.sh`

**트리거 조건**:
- 멤버가 stopped 상태 > 2분
- leader 없음 > 30초

**복구 절차**:
```bash
# 1. 멤버 재시작 시도
patronictl restart postgres-patroni <member>

# 2. 실패 시 reinit
patronictl reinit postgres-patroni <member>

# 3. leader 선출 대기
patronictl list
```

### 3-2. etcd 복구
- 3-node etcd에서 2개 이상 살아있으면 자동 복구
- majority loss 시 수동 개입 필요

### 3-3. Failover 자동화
Patroni는 automatic failover가 기본 활성화되어 있습니다.

---

## Phase 4: 검증

### 4-1. 복구 후 검증
```bash
# 1. Patroni 클러스터
kubectl exec -it postgres-patroni-0 -- patronictl list

# 2. Streaming replication
kubectl exec -it postgres-patroni-0 -- psql -U postgres -c "SELECT client_addr, state, sent_lsn FROM pg_stat_replication;"

# 3. haproxy 백엔드
kubectl exec -it postgres-haproxy-xxx -- nc -zv localhost 5432

# 4. 앱 health
curl http://127.0.0.1:32947/actuator/health

# 5. 모니터링 스크립트
bash /opt/Resonance/ops/scripts/patroni-monitor.sh
```

### 4-2. Failover 테스트 (선택)
```bash
# leader 강제 전환
kubectl exec -it postgres-patroni-0 -- patronictl failover --candidate postgres-patroni-1
```

---

## 파일 구조

```
/opt/Resonance/ops/scripts/
├── patroni-monitor.sh      # 상태 모니터링 (cron 1분)
├── patroni-auto-heal.sh     # 자동 복구 (cron 1분)
└── patroni-health-check.sh  # readiness/liveness probe용

/opt/Resonance/ops/cron/
└── patroni-cronjobs        # crontab 설정
```

---

## 예상 소요 시간

| Phase | 내용 | 예상 시간 |
|-------|------|----------|
| 1-1 ~ 1-3 | 데이터 백업 및 Patroni 초기화 | 10-15분 |
| 1-4 ~ 1-5 | 검증 | 5분 |
| 2 | 모니터링 스크립트 구현 | 30분 |
| 3 | 자동 복구 스크립트 구현 | 30분 |
| 4 | 전체 검증 | 10분 |
| **Total** | | **약 90분** |

---

## 열린 질문

- [x] Patroni 설정 (pg_hba, replication slots) - **유지**
- [x] 알림 채널 - **Slack webhook**
- [x] failover 테스트 - **지금 수행**

---

## 구현 결정사항

### 알림 설정
**Slack Webhook URL**: `ops/scripts/patroni-slack-webhook.cfg` (파일로 관리)
-领袖 없음/발생: `@channel` mention
-멤버 down: 일반 알림
-복구 완료: 성공 메시지

### Failover 테스트 절차
복구 완료 후 다음 명령어로 leader 전환 테스트:
```bash
kubectl exec -it postgres-patroni-0 -- patronictl failover --candidate postgres-patroni-1
```

### 모니터링/자동복구 cron 주기
-모니터링 (patroni-monitor.sh): 1분마다
-자동복구 (patroni-auto-heal.sh): 1분마다, 2회 연속 실패 후 실행