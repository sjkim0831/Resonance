# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] backup-cubrid.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
# CUBRID 데이터베이스 백업 스크립트
# 매일 자정 실행

BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
DATA_DIR="/opt/Resonance/data/cubrid"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=30

echo "[$(date)] CUBRID 백업 시작"

# CUBRID 중지
kubectl exec cubrid-carbonet-0 -n carbonet-prod -- cubrid server stop carbonet 2>/dev/null

# 파일 백업
mkdir -p $BACKUP_DIR/$DATE
cp -r $DATA_DIR/databases.txt $BACKUP_DIR/$DATE/
cp -r $DATA_DIR/com $BACKUP_DIR/$DATE/
cp -r $DATA_DIR/resonance $BACKUP_DIR/$DATE/
cp -r $DATA_DIR/conf $BACKUP_DIR/$DATE/

# 압축
tar -czf $BACKUP_DIR/cubrid_${DATE}.tar.gz -C $DATA_DIR databases.txt com resonance conf
rm -rf $BACKUP_DIR/$DATE

# 30일 이상된 백업 삭제
find $BACKUP_DIR -name "cubrid_*.tar.gz" -mtime +$KEEP_DAYS -delete

# CUBRID 시작
kubectl exec cubrid-carbonet-0 -n carbonet-prod -- cubrid server start carbonet 2>/dev/null

echo "[$(date)] CUBRID 백업 완료: $BACKUP_DIR/cubrid_${DATE}.tar.gz"
