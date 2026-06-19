#!/bin/bash
#===========================================
# Cron Backup Script
# Runs every hour via crontab
#===========================================

TRIGGER_SOURCE="cron" /opt/Resonance/ops/scripts/db-auto-backup.sh backup