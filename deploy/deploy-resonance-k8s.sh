#!/bin/bash
# Resonance Framework Kubernetes Deployment Script
# Usage: bash deploy-resonance-k8s.sh [deploy|build|restart|status|cleanup]
# Author: Resonance Team
# Date: 2026-05-11

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy/k8s"
NAMESPACE_RESonANCE_OPS="resonance-ops"
NAMESPACE_CARBONET="${NAMESPACE_CARBONET:-carbonet-prod}"
MIGRATION_SECRET_NAME="carbonet-migration-secret"
MIGRATION_PASSWORD_KEY="SPRING_FLYWAY_PASSWORD"
LOG_FILE="${ROOT_DIR}/var/deploy-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${BLUE}${message}${NC}"
    mkdir -p "${ROOT_DIR}/var"
    echo "$message" >> "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}" >&2
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    success "All prerequisites met"
}

# Build Docker image
build_image() {
    log "Building Docker image for operations-console..."
    
    cd "$ROOT_DIR"
    docker build -t registry.local/operations-console:latest -f Dockerfile .
    
    success "Docker image built: registry.local/operations-console:latest"
}

# Create namespaces
create_namespaces() {
    log "Creating namespaces..."
    
    kubectl apply -f "${DEPLOY_DIR}/base/namespaces.yaml"
    
    success "Namespaces created"
}

# Deploy base resources (ConfigMaps, Secrets)
deploy_base() {
    log "Deploying base resources..."
    
    kubectl apply -f "${DEPLOY_DIR}/base/operations-console.config.yaml"
    
    # Check if secret file exists before applying
    if [ -f "${DEPLOY_DIR}/base/operations-console.secret.yaml" ]; then
        kubectl apply -f "${DEPLOY_DIR}/base/operations-console.secret.yaml"
    else
        warning "Secret file not found, skipping..."
    fi
    
    success "Base resources deployed"
}

migration_secret_valid() {
    kubectl -n "$NAMESPACE_CARBONET" get secret "$MIGRATION_SECRET_NAME" -o json 2>/dev/null |
        MIGRATION_PASSWORD_KEY="$MIGRATION_PASSWORD_KEY" python3 -c '
import base64
import json
import os
import sys

try:
    encoded = json.load(sys.stdin).get("data", {}).get(os.environ["MIGRATION_PASSWORD_KEY"])
    decoded = base64.b64decode(encoded, validate=True) if isinstance(encoded, str) else b""
except (ValueError, TypeError, json.JSONDecodeError):
    decoded = b""
raise SystemExit(0 if decoded else 1)
' >/dev/null
}

ensure_migration_secret() {
    command -v python3 >/dev/null 2>&1 || {
        error "python3 is required to validate migration Secret data"
        return 1
    }
    if kubectl -n "$NAMESPACE_CARBONET" get secret "$MIGRATION_SECRET_NAME" >/dev/null 2>&1; then
        if migration_secret_valid && [[ "${ROTATE_MIGRATION_SECRET:-false}" != "true" ]]; then
            return 0
        fi
        if [[ "${ROTATE_MIGRATION_SECRET:-false}" != "true" ]]; then
            error "$MIGRATION_SECRET_NAME/$MIGRATION_PASSWORD_KEY is missing, invalid, or decoded-empty; refusing implicit overwrite"
            return 1
        fi
    fi

    if [[ "${CARBONET_MIGRATION_PASSWORD+x}" != "x" ]] \
        || [[ -z "$CARBONET_MIGRATION_PASSWORD" ]]; then
        error "Set nonempty CARBONET_MIGRATION_PASSWORD to provision $MIGRATION_SECRET_NAME"
        return 1
    fi
    if ! CARBONET_MIGRATION_PASSWORD="$CARBONET_MIGRATION_PASSWORD" python3 -c '
import os
import sys

value = os.environ["CARBONET_MIGRATION_PASSWORD"].encode()
if not value:
    raise SystemExit(1)
sys.stdout.buffer.write(value)
' |
        kubectl -n "$NAMESPACE_CARBONET" create secret generic "$MIGRATION_SECRET_NAME" \
            --from-file="$MIGRATION_PASSWORD_KEY=/dev/stdin" \
            --dry-run=client -o yaml |
        kubectl apply -f - >/dev/null; then
        error "$MIGRATION_SECRET_NAME could not be provisioned from stdin"
        return 1
    fi
    if ! migration_secret_valid; then
        error "$MIGRATION_SECRET_NAME/$MIGRATION_PASSWORD_KEY failed decoded-nonempty verification after provisioning"
        return 1
    fi
}

# Deploy project resources (Carbonet)
deploy_project() {
    log "Deploying Carbonet project resources..."
    
    kubectl apply -f "${DEPLOY_DIR}/projects/carbonet/cubrid-carbonet.statefulset.yaml"
    
    if [ -f "${DEPLOY_DIR}/projects/carbonet/carbonet-runtime.config.yaml" ]; then
        kubectl apply -f "${DEPLOY_DIR}/projects/carbonet/carbonet-runtime.config.yaml"
    fi
    
    # Check if secret file exists before applying
    if [ -f "${DEPLOY_DIR}/projects/carbonet/carbonet-runtime.secret.yaml" ]; then
        kubectl apply -f "${DEPLOY_DIR}/projects/carbonet/carbonet-runtime.secret.yaml"
    else
        warning "Carbonet secret file not found, skipping..."
    fi

    ensure_migration_secret
    
    # Deploy the main application
    kubectl apply -f "${DEPLOY_DIR}/projects/carbonet/carbonet-runtime.deployment.yaml"
    
    success "Carbonet project deployed"
}

# Deploy operations console
deploy_operations_console() {
    log "Deploying operations console..."
    
    kubectl apply -f "${DEPLOY_DIR}/base/operations-console.deployment.yaml"
    
    success "Operations console deployed"
}

# Full deployment
deploy_all() {
    log "Starting full Resonance deployment..."
    log "=================================="
    
    check_prerequisites
    create_namespaces
    deploy_base
    deploy_project
    deploy_operations_console
    
    log "=================================="
    log "Deployment completed! 🎉"
    log ""
    log "To check status:"
    log "  kubectl get pods -n resonance-ops"
    log "  kubectl get pods -n carbonet-prod"
    log ""
    log "To access the console:"
    log "  kubectl port-forward -n resonance-ops svc/operations-console 18000:80"
    log ""
    log "To access Carbonet runtime:"
    log "  kubectl port-forward -n carbonet-prod svc/carbonet-runtime 8080:80"
}

# Check deployment status
check_status() {
    log "Checking deployment status..."
    
    echo ""
    echo "=== Resonance-ops namespace ==="
    kubectl get pods -n "$NAMESPACE_RESonANCE_OPS" 2>/dev/null || echo "Namespace not found"
    kubectl get services -n "$NAMESPACE_RESonANCE_OPS" 2>/dev/null || echo "No services"
    
    echo ""
    echo "=== Carbonet-prod namespace ==="
    kubectl get pods -n "$NAMESPACE_CARBONET" 2>/dev/null || echo "Namespace not found"
    kubectl get services -n "$NAMESPACE_CARBONET" 2>/dev/null || echo "No services"
    kubectl get statefulsets -n "$NAMESPACE_CARBONET" 2>/dev/null || echo "No statefulsets"
    
    echo ""
    log "Status check completed!"
}

# Restart deployment
restart_deployment() {
    log "Restarting deployments..."
    
    kubectl rollout restart deployment/operations-console -n "$NAMESPACE_RESonANCE_OPS" 2>/dev/null || warning "Operations console not found"
    kubectl rollout restart deployment/carbonet-runtime -n "$NAMESPACE_CARBONET" 2>/dev/null || warning "Carbonet runtime not found"
    
    success "Restart initiated"
}

# Cleanup deployment
cleanup_deployment() {
    log "WARNING: This will remove all Resonance resources!"
    
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        kubectl delete namespace "$NAMESPACE_RESonANCE_OPS" 2>/dev/null || true
        kubectl delete namespace "$NAMESPACE_CARBONET" 2>/dev/null || true
        success "Cleanup completed"
    else
        log "Cleanup cancelled"
    fi
}

# Main execution
main() {
    local command="${1:-deploy}"
    
    case "$command" in
        deploy|deploy-all)
            deploy_all
            ;;
        build)
            build_image
            ;;
        base)
            create_namespaces
            deploy_base
            ;;
        project)
            deploy_project
            ;;
        console)
            deploy_operations_console
            ;;
        status)
            check_status
            ;;
        restart)
            restart_deployment
            ;;
        cleanup)
            cleanup_deployment
            ;;
        help)
            echo "Usage: $0 [deploy|build|base|project|console|status|restart|cleanup|help]"
            echo ""
            echo "Commands:"
            echo "  deploy     - Full deployment (default)"
            echo "  build      - Build Docker image only"
            echo "  base       - Deploy base resources (namespaces, configs, secrets)"
            echo "  project    - Deploy Carbonet project resources"
            echo "  console    - Deploy operations console only"
            echo "  status     - Check deployment status"
            echo "  restart    - Restart all deployments"
            echo "  cleanup    - Remove all Resonance resources"
            echo "  help       - Show this help message"
            ;;
        *)
            error "Unknown command: $command"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Secret-only mode is used by deployment preflights and isolated contract tests.
if [[ "${RESONANCE_MIGRATION_SECRET_ENSURE_ONLY:-false}" == "true" ]]; then
    ensure_migration_secret
    success "Migration Secret is decoded-nonempty"
    exit 0
fi

# Run main function
main "$@"
