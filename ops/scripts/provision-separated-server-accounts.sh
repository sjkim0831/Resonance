#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root" >&2
  exit 1
fi

RESONANCE_ROOT="/opt/Resonance"
WORKSPACE_ROOT="/srv/resonance-workspaces"
export KUBECONFIG="${KUBECONFIG:-/home/sjkim/.kube/config}"

if [[ "$(readlink -f "$RESONANCE_ROOT")" != "/opt/Resonance" ]]; then
  echo "ERROR: unexpected Resonance root" >&2
  exit 1
fi
if [[ ! -r "$KUBECONFIG" ]]; then
  echo "ERROR: Kubernetes admin config is not readable: $KUBECONFIG" >&2
  exit 1
fi

declare -A ROLE_GROUPS=(
  [carbonet-ops]="resonance-ops"
  [carbonet-dev]="resonance-dev"
  [jwchoo-dev]="resonance-personal"
  [center-director]="resonance-director"
)

for group in "${ROLE_GROUPS[@]}"; do
  getent group "$group" >/dev/null || groupadd "$group"
done

for account in "${!ROLE_GROUPS[@]}"; do
  role_group="${ROLE_GROUPS[$account]}"
  if ! id "$account" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash --groups "$role_group" "$account"
  else
    usermod --append --groups "$role_group" "$account"
  fi
  passwd --lock "$account" >/dev/null 2>&1 || true
  install -d -m 0700 -o "$account" -g "$account" "/home/$account/.ssh"
  install -d -m 0700 -o "$account" -g "$account" "/home/$account/.kube"
done

# Operations can inspect host logs but receives no sudo or docker membership.
usermod --append --groups adm carbonet-ops

install -d -m 0755 -o root -g root "$WORKSPACE_ROOT"
install -d -m 2770 -o carbonet-ops -g resonance-ops "$WORKSPACE_ROOT/operations"
install -d -m 2770 -o carbonet-dev -g resonance-dev "$WORKSPACE_ROOT/development"
install -d -m 2770 -o jwchoo-dev -g resonance-personal "$WORKSPACE_ROOT/personal"
install -d -m 2750 -o center-director -g resonance-director "$WORKSPACE_ROOT/director"

# Explicit source visibility. Development accounts remain unable to write the live tree.
setfacl -m g:resonance-ops:rx,g:resonance-dev:rx,g:resonance-personal:rx,g:resonance-director:rx "$RESONANCE_ROOT"
if [[ -d "$RESONANCE_ROOT/var/ai-runtime" ]]; then
  setfacl -R -m g:resonance-ops:rwX,g:resonance-dev:rX,g:resonance-personal:rX,g:resonance-director:rX "$RESONANCE_ROOT/var/ai-runtime"
  setfacl -m d:g:resonance-ops:rwx,d:g:resonance-dev:r-x,d:g:resonance-personal:r-x,d:g:resonance-director:r-x "$RESONANCE_ROOT/var/ai-runtime"
fi

# Repair the existing malformed Namespace finalizer mutation. The old value was
# a mapping object where Kubernetes requires a scalar finalizer string.
if kubectl get clusterpolicy auto-finalizer >/dev/null 2>&1; then
  kubectl patch clusterpolicy auto-finalizer --type=json \
    -p='[{"op":"replace","path":"/spec/rules/0/mutate/patchStrategicMerge/metadata/finalizers/0","value":"security.resonance.ai/protected"}]' >/dev/null
fi

kubectl create namespace carbonet-dev --dry-run=client -o yaml |
  kubectl apply -f -
kubectl label namespace carbonet-dev environment=development owner=carbonet-dev --overwrite

kubectl apply -f - <<'YAML'
apiVersion: v1
kind: ServiceAccount
metadata:
  name: carbonet-ops
  namespace: carbonet-prod
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: carbonet-dev
  namespace: carbonet-dev
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jwchoo-dev
  namespace: carbonet-dev
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: center-director
  namespace: carbonet-prod
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: resonance-prod-operator
  namespace: carbonet-prod
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "pods/exec", "pods/portforward", "services", "endpoints", "configmaps", "events"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/exec", "pods/portforward"]
    verbs: ["create"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["delete"]
  - apiGroups: ["apps"]
    resources: ["deployments", "deployments/scale", "statefulsets", "statefulsets/scale", "replicasets"]
    verbs: ["get", "list", "watch", "patch", "update"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch", "create", "patch", "update", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: carbonet-ops
  namespace: carbonet-prod
subjects:
  - kind: ServiceAccount
    name: carbonet-ops
    namespace: carbonet-prod
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: resonance-prod-operator
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: carbonet-dev-admin
  namespace: carbonet-dev
subjects:
  - kind: ServiceAccount
    name: carbonet-dev
    namespace: carbonet-dev
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: admin
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: resonance-personal-developer
  namespace: carbonet-dev
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "services", "endpoints", "configmaps", "events", "persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["apps"]
    resources: ["deployments", "deployments/scale", "statefulsets", "statefulsets/scale", "replicasets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: jwchoo-personal-developer
  namespace: carbonet-dev
subjects:
  - kind: ServiceAccount
    name: jwchoo-dev
    namespace: carbonet-dev
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: resonance-personal-developer
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: center-director-view
  namespace: carbonet-prod
subjects:
  - kind: ServiceAccount
    name: center-director
    namespace: carbonet-prod
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: carbonet-ops-monitoring-view
  namespace: monitoring
subjects:
  - kind: ServiceAccount
    name: carbonet-ops
    namespace: carbonet-prod
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: center-director-monitoring-view
  namespace: monitoring
subjects:
  - kind: ServiceAccount
    name: center-director
    namespace: carbonet-prod
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: carbonet-ops-resonance-ops-view
  namespace: resonance-ops
subjects:
  - kind: ServiceAccount
    name: carbonet-ops
    namespace: carbonet-prod
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
YAML

create_token_secret() {
  local namespace="$1"
  local service_account="$2"
  local secret_name="$3"
  kubectl apply -f - <<YAML
apiVersion: v1
kind: Secret
metadata:
  name: ${secret_name}
  namespace: ${namespace}
  annotations:
    kubernetes.io/service-account.name: ${service_account}
type: kubernetes.io/service-account-token
YAML
}

create_token_secret carbonet-prod carbonet-ops carbonet-ops-kube-token
create_token_secret carbonet-dev carbonet-dev carbonet-dev-kube-token
create_token_secret carbonet-dev jwchoo-dev jwchoo-dev-kube-token
create_token_secret carbonet-prod center-director center-director-kube-token

SERVER="$(kubectl config view --raw -o jsonpath='{.clusters[0].cluster.server}')"
CA_FILE="$(mktemp)"
trap 'rm -f "$CA_FILE"' EXIT
kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' |
  base64 --decode >"$CA_FILE"
chmod 0600 "$CA_FILE"

write_kubeconfig() {
  local account="$1"
  local namespace="$2"
  local secret_name="$3"
  local cfg="/home/${account}/.kube/config"
  local token=""
  for _ in $(seq 1 30); do
    token="$(kubectl -n "$namespace" get secret "$secret_name" -o jsonpath='{.data.token}' 2>/dev/null | base64 -d || true)"
    [[ -n "$token" ]] && break
    sleep 1
  done
  if [[ -z "$token" ]]; then
    echo "ERROR: token not populated for $account" >&2
    exit 1
  fi
  rm -f "$cfg"
  kubectl config --kubeconfig="$cfg" set-cluster resonance-local --server="$SERVER" --certificate-authority="$CA_FILE" --embed-certs=true >/dev/null
  kubectl config --kubeconfig="$cfg" set-credentials "$account" --token="$token" >/dev/null
  kubectl config --kubeconfig="$cfg" set-context "$account" --cluster=resonance-local --user="$account" --namespace="$namespace" >/dev/null
  kubectl config --kubeconfig="$cfg" use-context "$account" >/dev/null
  chown "$account:$account" "$cfg"
  chmod 0600 "$cfg"
}

write_kubeconfig carbonet-ops carbonet-prod carbonet-ops-kube-token
write_kubeconfig carbonet-dev carbonet-dev carbonet-dev-kube-token
write_kubeconfig jwchoo-dev carbonet-dev jwchoo-dev-kube-token
write_kubeconfig center-director carbonet-prod center-director-kube-token

echo "PROVISIONING_COMPLETE"
