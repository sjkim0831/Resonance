# Postgres-HA → Patroni 마이그레이션 및 리뷰/개발 동시 운영 계획

## 상황 요약

- **현재**: 앱 → `postgres-haproxy` → `postgres-ha-0` (단일 인스턴스, SPoF)
- **문제**: `postgres-ha-0` 종료 시 앱 전체 중단 → "개발 중에 디비 내려감"
- **자원**: `postgres-patroni` (3-node HA) 이미 존재하고 healthy하지만 미사용
- **백업**: Kyverno 보안 정책 위반으로 실패 중

## 목표

1. 단일 장애점 제거 (postgres-ha-0 → postgres-patroni 3-node HA)
2. 백업 실패 문제 해결
3. 하나의 Patroni 클러스터로 리뷰(24/7) + 개발(개발 시 접근) 동시 운영

---

## Task 1: Kyverno 백업 정책 위반 해결

**문제**: CronJob container securityContext에 runAsUser/runAsGroup 누락

**수정**: `postgres-carbonet-hourly-backup` CronJob container level securityContext 추가

```yaml
# 적용 전 (container securityContext)
securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]

# 적용 후
securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
  runAsUser: 1000
  runAsGroup: 1000
```

**검증**:
```bash
kubectl -n carbonet-prod get job -l app=postgres-backup --watch
# BackoffLimitExceeded不再出现 확인
```

---

## Task 2: HAProxy 설정 변경 (postgres-ha-0 → postgres-patroni)

**현재 HAProxy 설정** (postgres-ha-0 단일 참조):
```
server postgresha0 10.244.0.54:5432
```

**수정 후** (patroni 클러스터 참조):
```
server postgres-patroni-0 10.244.0.199:5432 check inter 3s fall 3 rise 2
server postgres-patroni-1 10.244.0.200:5432 check inter 3s fall 3 rise 2
server postgres-patroni-2 10.244.0.201:5432 check inter 3s fall 3 rise 2
```

**참고**: Patroni는 primary/replica 역할을 자동으로 관리하므로, HAProxy는 모든 노드에 연결한다.

**검증**:
```bash
# 연결 테스트
kubectl exec -it deploy/carbonet-runtime -- sh -c 'nc -zv postgres-haproxy 5432'

# Patroni 클러스터 상태 확인
kubectl exec -it postgres-patroni-0 -- patronictl list
```

---

## Task 3: Patroni 클러스터로 데이터 이전

**방법 A** (推奨 - Patroni basebackup 사용):
```bash
# Patroni leader에서 basebackup 수행
kubectl exec -it postgres-patroni-0 -- patronictl reinit postgres-patroni postgres-patroni-0
```

**방법 B** (pg_dump로 데이터 검증 후 복원):
```bash
# 현재 postgres-ha에서 덤프
kubectl exec -it postgres-ha-0 -- pg_dump -U postgres carbonet > backup.sql

# Patroni leader로 복원
kubectl exec -it postgres-patroni-0 -- psql -U postgres -c "CREATE DATABASE carbonet;"
kubectl exec -it postgres-patroni-0 -- psql -U postgres carbonet < backup.sql
```

**검증**:
```sql
-- 테이블 count 비교
kubectl exec -it postgres-ha-0 -- psql -U postgres -c "SELECT count(*) FROM ui_page_manifest;"
kubectl exec -it postgres-patroni-0 -- psql -U postgres -c "SELECT count(*) FROM ui_page_manifest;"
```

---

## Task 4: 리뷰/개발 동시 운영 설정

Patroni 클러스터 3-node HA로 다음 구성 가능:

```
┌─────────────────────────────────────────────────────┐
│         postgres-patroni (3-node HA)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Node-0   │  │ Node-1   │  │ Node-2   │        │
│  │ Primary  │  │ Replica  │  │ Replica  │        │
│  └────┬─────┘  └──────────┘  └──────────┘        │
└───────┼────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────────────────┐
│  리뷰용 앱      │     │   개발용 앱                 │
│  postgres-haproxy:5432 (Primary)                   │
│  (24시간 접근)  │     │   (개발 시에만 접근)        │
└─────────────────┘     └─────────────────────────────┘
```

**연결 분리** (필요시):
- 리뷰용: `postgres-haproxy:5432` (Primary)
- 개발용: `postgres-patroni-external:31433` (Replica 직접 접근) 또는 앱 단 connection pool 분리

---

## Task 5: 백업 Job 대상 변경

**현재**: `postgres-ha.postgres-ha.svc.cluster.local` (단일 인스턴스)

**수정 후**: `postgres-patroni.postgres-patroni.svc.cluster.local` (클러스터)

```bash
# CronJob 수정
kubectl patch cronjob postgres-carbonet-hourly-backup -n carbonet-prod \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/jobTemplate/spec/template/spec/containers/0/args/0", "value": "set -eu\nBACKUP_HOST=\"postgres-patroni.postgres-patroni.svc.cluster.local\"\n..."}]'
```

**검증**:
```bash
# 다음 백업Job 실행 확인
kubectl get job -l app=postgres-backup --watch
```

---

## Task 6: Stability 확인 (1-2주)

- Patroni 클러스터 24시간 안정 운영 확인
- 백업 Job 연속 성공 확인
- Failover 테스트 (한 노드 종료 후 자동 복구)

---

## 완료 조건

| 항목 | 검증 기준 |
|------|----------|
| Kyverno 정책 | 백업 Job에서 PolicyViolation 경고 사라짐 |
| 앱 연결 | carbonet-runtime → postgres-haproxy → postgres-patroni 정상 연결 |
| 백업 | hourly/daily/basebackup Job 연속 성공 |
| 리뷰용 접근 | 24시간 연속 접근 가능 확인 |
| Failover | 1개 노드 종료 후 30초 내 자동 복구 |

---

## 리스크

1. **데이터 불일치**: 마이그레이션 중 데이터 변경 →ブルーグリーン迁移 또는 maintenance window 필요
2. **앱 호환성**: Patroni (Spilo) vs 원본 Postgres 설정 차이 → 사전 테스트 필요
3. **리뷰/개발 충돌**: 같은 클러스터 사용 시 개발 작업이 리뷰에 영향 → 연결 분리 필요시.connection pool 분리

---

## 다음 단계 (마이그레이션 완료 후)

1. `postgres-ha-0` StatefulSet 제거 검토 (리소스 절약)
2. 리뷰/개발 workload 분리 방식 확정 (앱 레벨 또는 포트 레벨)
3. 1-2주 안정화 확인 후, 필요시 리뷰용 별도 클러스터 추가 고려