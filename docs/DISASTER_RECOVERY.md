# CUBRID Disaster Recovery Manual

**Last Updated:** 2026-06-21
**Version:** 1.0

## Table of Contents
1. [Overview](#overview)
2. [Backup Strategy](#backup-strategy)
3. [Recovery Procedures](#recovery-procedures)
4. [Disaster Scenarios](#disaster-scenarios)
5. [Verification](#verification)
6. [Emergency Contacts](#emergency-contacts)

---

## Overview

### System Components
- **Database:** CUBRID 11.4.5
- **Namespace:** carbonet-prod
- **Storage:** Kubernetes StatefulSet with PVC
- **Backup Location:** `/opt/Resonance/data/cubrid/backups/`

### Database Statistics
| Item | Count |
|------|-------|
| Total Tables | 182 |
| ecoinvent_master | 26,533 rows |
| emission_material_translation | 26,533 rows |

---

## Backup Strategy

### Backup Types

#### 1. Full Backup (Recommended: Keep 3)
```bash
# Create full database backup
bash ops/scripts/cubrid-k8s-backup.sh full

# Or manual backup
kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "source /home/cubrid/.cubrid.sh && cubrid server stop carbonet"
# Copy database files
kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "source /home/cubrid/.cubrid.sh && cubrid server start carbonet"
```

#### 2. Unload Backup (Recommended: Keep 2)
```bash
# Creates portable SQL dump
bash ops/scripts/cubrid-k8s-backup.sh unload
```

#### 3. Quick Backup (Recommended: Keep 7)
```bash
# Live backup without downtime
bash ops/scripts/cubrid-k8s-backup.sh quick
```

### Automated Backup Schedule

| Time | Task | Script |
|------|------|--------|
| 02:00 AM | Daily Backup | backup-guardian.sh |
| 03:00 AM (Sunday) | Rotation | backup-rotation.sh |
| 04:00 AM | Verification | backup-verify.sh |

To install cron:
```bash
bash ops/scripts/backup-cron.sh install
```

---

## Recovery Procedures

### Pre-Recovery Checklist
1. [ ] Assess the disaster
2. [ ] Notify stakeholders
3. [ ] Stop application services
4. [ ] Create snapshot (if possible)
5. [ ] Verify backup integrity

### Recovery from Full Backup

```bash
# 1. Stop current services
kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "source /home/cubrid/.cubrid.sh && cubrid server stop carbonet"

# 2. Extract backup
tar -xzf /opt/Resonance/data/cubrid/backups/carbonet-fullbackup-YYYYMMDD_HHMMSS.tar.gz -C /tmp/

# 3. Restore files
kubectl cp /tmp/carbonet/* carbonet-prod/cubrid-carbonet-0:/var/lib/cubrid/databases/

# 4. Fix databases.txt
kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "cat > /var/lib/cubrid/databases/databases.txt << 'EOF'
#db-name	vol-path		db-host	log-path		lob-base-path
carbonet	/var/lib/cubrid/databases	localhost	/var/lib/cubrid/databases	file:/var/lib/cubrid/databases/lob
EOF"

# 5. Start database
kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "source /home/cubrid/.cubrid.sh && cubrid server start carbonet"

# 6. Verify
bash ops/scripts/cubrid-k8s-recovery.sh full-check
```

### Recovery from Unload Backup

```bash
# Using the recovery script
bash ops/scripts/cubrid-k8s-recovery.sh restore

# Or step-by-step
bash ops/scripts/cubrid-k8s-recovery.sh phase1  # Create DB + schema
bash ops/scripts/cubrid-k8s-recovery.sh phase2  # Load indexes
bash ops/scripts/cubrid-k8s-recovery.sh phase3  # Load data
```

### Recovery Verification

```bash
# Run full system check
bash ops/scripts/cubrid-k8s-recovery.sh full-check

# Verify Korean characters
kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "
source /home/cubrid/.cubrid.sh
csql -C -u dba -p '' -c \"SELECT COUNT(*) FROM emission_material_translation WHERE mapping_status = 'PRODUCT_NAME_EXACT';\" carbonet@localhost
"

# Expected: 26533 rows with Korean names
```

---

## Disaster Scenarios

### Scenario 1: Database Corruption

**Symptoms:**
- CUBRID server fails to start
- "Unable to mount disk volume" errors
- Lock file issues

**Recovery Steps:**
```bash
# 1. Remove lock files
kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "
    rm -f /var/lib/cubrid/databases/carbonet_lgat__lock
    rm -f /var/lib/cubrid/databases/*.lock
"

# 2. Try starting
kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "source /home/cubrid/.cubrid.sh && cubrid server start carbonet"

# 3. If fails, restore from backup
bash ops/scripts/cubrid-k8s-recovery.sh restore
```

### Scenario 2: Accidental Data Deletion

**Symptoms:**
- Missing tables or data
- Application errors

**Recovery Steps:**
```bash
# 1. Create snapshot
kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "
    mkdir -p /var/lib/cubrid/databases/snapshots/emergency-$(date +%Y%m%d)
    cp -r /var/lib/cubrid/databases/carbonet* /var/lib/cubrid/databases/snapshots/emergency-$(date +%Y%m%d)/
"

# 2. Restore from unload
bash ops/scripts/cubrid-k8s-recovery.sh restore
```

### Scenario 3: Kubernetes Pod Failure

**Symptoms:**
- Pod not running
- PVC issues

**Recovery Steps:**
```bash
# 1. Delete problematic pod
kubectl delete pod cubrid-carbonet-0 -n carbonet-prod

# 2. Wait for recreation
kubectl wait --for=condition=Ready pod/cubrid-carbonet-0 -n carbonet-prod --timeout=120s

# 3. Verify
bash ops/scripts/cubrid-k8s-recovery.sh full-check
```

### Scenario 4: Complete Cluster Failure

**Symptoms:**
- Kubernetes down
- Hardware failure

**Recovery Steps:**
```bash
# 1. Restore Kubernetes cluster
bash ops/scripts/resonance-up.sh

# 2. Restore database from backup
kubectl cp /opt/Resonance/data/cubrid/backups/carbonet-fullbackup-*.tar.gz \
    carbonet-prod/cubrid-carbonet-0:/tmp/backup.tar.gz

kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "
    cd /var/lib/cubrid/databases
    tar -xzf /tmp/backup.tar.gz
    cubrid server start carbonet
"
```

---

## Verification

### Daily Verification
```bash
# Check backup status
bash ops/scripts/cubrid-k8s-recovery.sh check-backup

# Verify backup integrity
bash ops/scripts/backup-verify.sh all
```

### Post-Recovery Verification
```bash
# Full system check
bash ops/scripts/cubrid-k8s-recovery.sh full-check

# Check critical data
kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "
source /home/cubrid/.cubrid.sh
csql -C -u dba -p '' -c '
    SELECT COUNT(*) as total_tables FROM db_class;
    SELECT COUNT(*) as ecoinvent_count FROM ecoinvent_master;
    SELECT COUNT(*) as translation_count FROM emission_material_translation;
    SELECT COUNT(*) as korean_count FROM emission_material_translation 
        WHERE mapping_status = '\''PRODUCT_NAME_EXACT'\'' AND korean_name IS NOT NULL;
' carbonet@localhost
"
```

### Expected Results
| Check | Expected |
|-------|----------|
| total_tables | 182 |
| ecoinvent_count | 26,533 |
| translation_count | 26,533 |
| korean_count | 26,533 |

---

## Verification Checklist

After any recovery, verify:
- [ ] Server status: Running
- [ ] Broker status: Running
- [ ] Connection test: Success
- [ ] Table count: 182
- [ ] Korean names visible
- [ ] Application health: UP

```bash
# Quick verification
curl -s http://127.0.0.1/actuator/health
```

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| DB Admin | System team |
| K8s Admin | Platform team |
| Backup Location | `/opt/Resonance/data/cubrid/backups/` |

---

## Appendix: Quick Reference

### Key Commands
```bash
# Check status
bash ops/scripts/cubrid-k8s-recovery.sh full-check

# Create backup
bash ops/scripts/cubrid-k8s-backup.sh full

# Restore
bash ops/scripts/cubrid-k8s-recovery.sh restore

# Verify backup
bash ops/scripts/backup-verify.sh all

# Check backup status
bash ops/scripts/cubrid-k8s-recovery.sh check-backup
```

### File Locations
- **Backups:** `/opt/Resonance/data/cubrid/backups/`
- **Database:** `/var/lib/cubrid/databases/`
- **Scripts:** `/opt/Resonance/ops/scripts/`

### Environment Variables
```bash
NAMESPACE=carbonet-prod
POD_NAME=cubrid-carbonet-0
DB_NAME=carbonet
BACKUP_DIR=/opt/Resonance/data/cubrid/backups
```