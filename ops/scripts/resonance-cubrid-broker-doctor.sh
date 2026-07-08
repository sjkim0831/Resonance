#!/usr/bin/env bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 진단: kubectl exec postgres-patroni-0 -n carbonet-prod -- patronictl list
echo "[DEPRECATED] CUBRID brokerdoctor: CUBRID는 제거됨. postgres-patroni 사용."
exit 1

set -euo pipefail
NAMESPACE=${NAMESPACE:-carbonet-prod}
POD=${POD:-cubrid-carbonet-0}
echo "[broker-doctor] pod status"
kubectl -n "$NAMESPACE" get pod "$POD" -o wide
echo
echo "[broker-doctor] broker status"
kubectl -n "$NAMESPACE" exec "$POD" -- sh -lc "su cubrid -c 'CUBRID=/home/cubrid/CUBRID; PATH=/home/cubrid/CUBRID/bin:\$PATH; LD_LIBRARY_PATH=/home/cubrid/CUBRID/lib:\${LD_LIBRARY_PATH:-}; export CUBRID PATH LD_LIBRARY_PATH; cubrid broker status'"
echo
echo "[broker-doctor] broker ports"
kubectl -n "$NAMESPACE" exec "$POD" -- sh -lc "ss -ltnp | grep -E ':33000|:33001' || true"
echo
echo "[broker-doctor] runtime DB health"
curl -fsS --max-time 8 http://127.0.0.1/actuator/health || true
echo
