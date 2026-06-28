#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
cmd="${1:-}"

if [ -z "$cmd" ]; then
    exec "$ROOT_DIR/ops/scripts/resonance-command-index.sh" menu
fi

show_menu() {
    echo ""
    echo "=============================================="
    echo "  Resonance 명령어 메뉴"
    echo "=============================================="
    echo ""
    echo "  [실행/개발]"
    echo "    1  | up         - resonance-up.sh"
    echo "    2  | deploy     - resonance-k8s-build-deploy-80.sh"
    echo "    3  | deploy-safe - git-backup + deploy"
    echo "    4  | hot-reload - resonance-k8s-build-deploy-80.sh --hot-reload"
    echo "    8  | deploy-v2  - resonance-k8s-build-deploy-80-v2.sh"
    echo ""
    echo "  [v3 초고속 배포 (~30초~3분)]"
    echo "   12  | v3-prebuild - Jar + Frontend 사전 빌드"
    echo "   13  | v3-deploy  - 변경 감지 후 선별 배포"
    echo "   14  | auto-deploy - 감시后台 자동 배포 on/off"
    echo ""
    echo "  [Git 버전관리]"
    echo "    g  | git-status - git status + log"
    echo "    gc | git-commit - git-auto-commit.sh"
    echo "    gp | git-push   - git push"
    echo "    gr | git-rollback - git-rollback.sh"
    echo "    gw | git-watch  - git-watch-push.sh"
    echo ""
    echo "  [점검/복구]"
    echo "    5  | doctor     - resonance-k8s-doctor.sh"
    echo "    6  | broker     - resonance-cubrid-broker-doctor.sh"
    echo "    7  | logs       - resonance-log-db-register.sh"
    echo "    9  | db-recover - reboot_cubrid_ha.sh"
    echo "   15  | health     - resonance-health-check.sh"
    echo ""
    echo "  [자동화]"
    echo "   15  | watch      - 파일 감시 자동 배포 (start/stop/status)"
    echo "   16  | ci         - PR 검증 (validate/build/test/all)"
    echo ""
    echo "  [기타]"
    echo "    h  | help       - 이 메뉴 표시"
    echo "    q  | quit       - 종료"
    echo ""
    echo "=============================================="
    echo "  선택: "
}

case "$cmd" in
  menu|interactive)
    show_menu
    read -p "선택: " sel
    exec "$0" "$sel"
    ;;
  up|start|켜줘|1)
    exec "$ROOT_DIR/ops/scripts/resonance-up.sh" "${@:2}"
    ;;
  deploy|redeploy|배포|2)
    exec "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80.sh" "${@:2}"
    ;;
  deploy-safe|배포안전|3)
    echo "=== Pre-Deploy Git Backup ===" && \
    bash "$ROOT_DIR/ops/scripts/git-pre-deploy-backup.sh" && \
    echo "" && \
    echo "=== Starting Deployment ===" && \
    bash "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80.sh"
    ;;
  hot-reload|hl|빠른재배포|4)
    exec "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80.sh" --hot-reload
    ;;
  deploy-v2|8)
    exec "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80-v2.sh" "${@:2}"
    ;;
  deploy-fe|10)
    SKIP_IMAGE_BUILD=true exec "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
    ;;
  fe-hot|frontend-hot|11)
    exec "$ROOT_DIR/ops/scripts/frontend-hot-reload.sh"
    ;;
  v3-prebuild|12)
    exec "$ROOT_DIR/ops/scripts/resonance-v3-build.sh" "${@:2}"
    ;;
  v3-deploy|13)
    exec "$ROOT_DIR/ops/scripts/resonance-v3-deploy.sh"
    ;;
  auto-deploy|14)
    exec "$ROOT_DIR/ops/scripts/resonance-auto-deploy.sh" "${@:2}"
    ;;
  doctor|status|점검|5)
    exec "$ROOT_DIR/ops/scripts/resonance-k8s-doctor.sh" "${@:2}"
    ;;
  ops-doctor)
    exec "$ROOT_DIR/ops/scripts/resonance-k8s-ops-doctor.sh" "${@:2}"
    ;;
  broker|broker-doctor|6)
    exec "$ROOT_DIR/ops/scripts/resonance-cubrid-broker-doctor.sh" "${@:2}"
    ;;
  db-recover|cubrid-recover|9)
    exec "$ROOT_DIR/ops/scripts/reboot_cubrid_ha.sh" "${@:2}"
    ;;
  health|15)
    exec "$ROOT_DIR/ops/scripts/resonance-health-check.sh" "${@:2}"
    ;;
  logs|log-db|7)
    exec "$ROOT_DIR/ops/scripts/resonance-log-db-register.sh" "${@:2}"
    ;;
  watch|file-watch|15)
    exec "$ROOT_DIR/ops/scripts/resonance-file-watch.sh" "${@:2}"
    ;;
  ci|pr-ci|16)
    shift
    bash "$ROOT_DIR/ops/scripts/resonance-pr-ci.sh" "${@:2}"
    ;;
  review|검토)
    exec "$ROOT_DIR/ops/scripts/resonance-log-db-register.sh" "${@:2}"
    ;;
  review|검토)
    exec "$ROOT_DIR/ops/scripts/resonance-review.sh" "${@:2}"
    ;;
  review-deploy|검토배포)
    exec "$ROOT_DIR/ops/scripts/resonance-review.sh" deploy "${@:2}"
    ;;
  housekeep|cleanup)
    exec "$ROOT_DIR/ops/scripts/resonance-k8s-housekeeper.sh" "${@:2}"
    ;;
  inventory|list)
    sed -n '1,220p' "$ROOT_DIR/docs/operations/resonance-command-inventory.md"
    ;;
  g|git-status)
    cd "$ROOT_DIR" && git status && git log --oneline -5
    ;;
  gc|git-commit)
    shift
    bash "$ROOT_DIR/ops/scripts/git-auto-commit.sh" "$*"
    ;;
  gp|git-push)
    cd "$ROOT_DIR" && git push
    ;;
  gr|git-rollback)
    bash "$ROOT_DIR/ops/scripts/git-rollback.sh" "${@:2}"
    ;;
  gw|git-watch)
    bash "$ROOT_DIR/ops/scripts/git-watch-push.sh" "${@:2}"
    ;;
  h|help|-h|--help)
    show_menu
    ;;
  q|quit|exit)
    echo "Exit"
    ;;
  *)
    echo "Unknown: $cmd"
    echo ""
    exec "$0" help
    ;;
esac
