#!/bin/bash
# PostgreSQL Migration Verification Script
# Usage: bash verify-postgres-migration.sh

NAMESPACE="${NAMESPACE:-carbonet-prod}"
PG_POD="${PG_POD:-postgres-ha-0}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-carbonet}"

echo "=== PostgreSQL Migration Verification ==="
echo "Namespace: $NAMESPACE"
echo "Pod: $PG_POD"
echo "Database: $PG_DB"
echo ""

echo "=== 1. Table Count ==="
kubectl exec -n "$NAMESPACE" "$PG_POD" -- psql -U "$PG_USER" -d "$PG_DB" -c \
  "SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"

echo ""
echo "=== 2. Key Tables Row Counts ==="
kubectl exec -n "$NAMESPACE" "$PG_POD" -- psql -U "$PG_USER" -d "$PG_DB" -c "
SELECT 'comtngnrlmber' as tbl, COUNT(*) as cnt FROM comtngnrlmber
UNION ALL SELECT 'comtnentrprsmber', COUNT(*) FROM comtnentrprsmber
UNION ALL SELECT 'comtnemplyrinfo', COUNT(*) FROM comtnemplyrinfo
UNION ALL SELECT 'comtnauthtokenstore', COUNT(*) FROM comtnauthtokenstore
UNION ALL SELECT 'comtnauthorinfo', COUNT(*) FROM comtnauthorinfo
UNION ALL SELECT 'comtnmenuinfo', COUNT(*) FROM comtnmenuinfo
UNION ALL SELECT 'comtccmmncode', COUNT(*) FROM comtccmmncode
ORDER BY tbl;"

echo ""
echo "=== 3. Column Type Verification ==="
kubectl exec -n "$NAMESPACE" "$PG_POD" -- psql -U "$PG_USER" -d "$PG_DB" -c "
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='comtngnrlmber' AND column_name IN ('esntl_id', 'mber_id', 'sbscrb_de');"

echo ""
echo "=== Verification Complete ==="