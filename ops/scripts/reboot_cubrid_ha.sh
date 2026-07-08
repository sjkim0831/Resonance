#!/bin/bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 환경: postgres-patroni-0/1/2 (Patroni HA)
echo "[DEPRECATED] reboot_cubrid_ha: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

# CUBRID HA Cluster Clean Reboot & Alignment Script (Production Grade)
set -e

NAMESPACE="carbonet-prod"
STS_NAME="cubrid-ha"
BROKER_PORT="${BROKER_PORT:-33001}"

echo "=== [0/6] Regenerating kubelet certificate with all node IPs ==="
# Generate kubelet certificate with all likely IPs and DNS for IP-change resilience
sudo bash -c '
cat > /tmp/kubelet.csr.conf << "EOF"
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = system:node:ccus
O = system:nodes

[v3_req]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ccus
DNS.2 = localhost
IP.1 = 127.0.0.1
IP.2 = 172.16.1.232
IP.3 = 100.125.44.95
EOF

openssl genrsa -out /tmp/kubelet.key 2048 2>/dev/null
openssl req -new -key /tmp/kubelet.key -out /tmp/kubelet.csr -config /tmp/kubelet.csr.conf
openssl x509 -req -in /tmp/kubelet.csr \
  -CA /etc/kubernetes/pki/ca.crt \
  -CAkey /etc/kubernetes/pki/ca.key \
  -CAcreateserial \
  -out /tmp/kubelet.crt \
  -days 365 \
  -extensions v3_req \
  -extfile /tmp/kubelet.csr.conf

cp /tmp/kubelet.crt /var/lib/kubelet/pki/kubelet.crt
cp /tmp/kubelet.key /var/lib/kubelet/pki/kubelet.key
chmod 600 /var/lib/kubelet/pki/kubelet.key
echo "Kubelet certificate regenerated with SAN: DNS:ccus,DNS:localhost,IP:127.0.0.1,IP:172.16.1.232,IP:100.125.44.95"
'
echo "=== [1/6] Pre-checks: Waiting for Kubernetes Cluster and CoreDNS readiness ==="

# 1. Wait for Kubernetes API to respond
echo "Checking Kubernetes API server..."
for attempt in $(seq 1 30); do
  if kubectl get nodes >/dev/null 2>&1; then
    echo "[OK] Kubernetes API Server is ready."
    break
  fi
  echo "Kubernetes API Server not ready yet. Retrying in 10s... (Attempt $attempt/30)"
  sleep 10
done

if ! kubectl get nodes >/dev/null 2>&1; then
  echo "[ERROR] Kubernetes API Server failed to respond after 5 minutes. Aborting."
  exit 1
fi

# 2. Wait for CoreDNS to be ready (needed for pod host resolution)
echo "Checking CoreDNS deployment status..."
for attempt in $(seq 1 20); do
  COREDNS_READY=$(kubectl get deployment coredns -n kube-system -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
  if [ "${COREDNS_READY}" -ne 0 ] 2>/dev/null; then
    echo "[OK] CoreDNS is ready."
    break
  fi
  echo "CoreDNS is not ready yet. Waiting 10s... (Attempt $attempt/20)"
  sleep 10
done

# 3. Extra cooldown to let system-wide networking stabilize
echo "Allowing system networks to stabilize for 10s..."
sleep 10


echo "=== [2/6] Scaling down CUBRID HA cluster to 0 replicas (Clean Stop) ==="
kubectl scale statefulset ${STS_NAME} -n ${NAMESPACE} --replicas=0

echo "Waiting for pods to terminate..."
while kubectl get pods -n ${NAMESPACE} -l app=cubrid-carbonet 2>/dev/null | grep -q -E "Running|Terminating|Pending"; do
  sleep 2
done
echo "All pods terminated."


echo "=== [3/6] Scaling up CUBRID HA cluster to 3 replicas (Clean Start) ==="
kubectl scale statefulset ${STS_NAME} -n ${NAMESPACE} --replicas=3

echo "Waiting for all pods to reach Ready state..."
kubectl rollout status statefulset ${STS_NAME} -n ${NAMESPACE} --timeout=300s


echo "=== [4/6] Waiting 20 seconds for Heartbeat stabilization ==="
sleep 20


echo "=== [5/6] Checking Heartbeat Role Alignment ==="
ACTIVE_MASTER=""
for attempt in $(seq 1 3); do
  for i in 0 1 2; do
    STATUS_OUT=$(kubectl exec cubrid-ha-$i -n ${NAMESPACE} -c cubrid -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && export LD_LIBRARY_PATH=\$CUBRID/lib:\$LD_LIBRARY_PATH && cubrid heartbeat status" 2>/dev/null || true)
    if echo "${STATUS_OUT}" | grep -q "state master"; then
      ACTIVE_MASTER="cubrid-ha-$i"
      break 2
    fi
  done
  echo "No active master detected. Waiting 10s before retry (Attempt $attempt/3)..."
  sleep 10
done

echo "Current Active Master is: ${ACTIVE_MASTER}"

if [ "${ACTIVE_MASTER}" = "cubrid-ha-0" ]; then
  echo "[OK] cubrid-ha-0 is already the Active Master. Alignment perfect!"
elif [ -n "${ACTIVE_MASTER}" ]; then
  echo "[ALIGN] Active Master is ${ACTIVE_MASTER}. Forcing failback to cubrid-ha-0..."
  
  # Stop heartbeat on current master to force failover to cubrid-ha-0 (priority 1)
  kubectl exec ${ACTIVE_MASTER} -n ${NAMESPACE} -c cubrid -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && export LD_LIBRARY_PATH=\$CUBRID/lib:\$LD_LIBRARY_PATH && cubrid heartbeat stop"
  
  echo "Waiting 15 seconds for failover to cubrid-ha-0..."
  sleep 15
  
  # Start heartbeat back on the old master
  kubectl exec ${ACTIVE_MASTER} -n ${NAMESPACE} -c cubrid -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && export LD_LIBRARY_PATH=\$CUBRID/lib:\$LD_LIBRARY_PATH && cubrid heartbeat start"
  
  echo "Waiting 10 seconds for stabilization..."
  sleep 10
else
  echo "[ERROR] Failed to detect HA state. Please check cubrid heartbeat status manually."
fi


echo "=== [6/6] Final HA Heartbeat Status ==="
kubectl exec cubrid-ha-0 -n ${NAMESPACE} -c cubrid -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && export LD_LIBRARY_PATH=\$CUBRID/lib:\$LD_LIBRARY_PATH && cubrid heartbeat status"

echo "=== [6.5/7] Recreating NodePort Services ==="
# Master service (broker2 on port 33001)
kubectl delete svc cubrid-carbonet-master -n ${NAMESPACE} 2>/dev/null || true
cat <<'SVC_EOF' | kubectl create -f -
apiVersion: v1
kind: Service
metadata:
  name: cubrid-carbonet-master
  namespace: carbonet-prod
spec:
  type: NodePort
  ports:
  - port: 33001
    targetPort: 33001
    nodePort: 33001
  selector:
    app: cubrid-carbonet
    statefulset.kubernetes.io/pod-name: cubrid-ha-0
SVC_EOF
echo "Master NodePort service recreated."

# Slave1 service (broker1 on port 30000)
kubectl delete svc cubrid-carbonet-slave1 -n ${NAMESPACE} 2>/dev/null || true
cat <<'SVC_EOF' | kubectl create -f -
apiVersion: v1
kind: Service
metadata:
  name: cubrid-carbonet-slave1
  namespace: carbonet-prod
spec:
  type: NodePort
  ports:
  - port: 30000
    targetPort: 30000
    nodePort: 33002
  selector:
    app: cubrid-carbonet
    statefulset.kubernetes.io/pod-name: cubrid-ha-1
SVC_EOF
echo "Slave1 NodePort service recreated."

# Slave2 service (broker1 on port 30000)
kubectl delete svc cubrid-carbonet-slave2 -n ${NAMESPACE} 2>/dev/null || true
cat <<'SVC_EOF' | kubectl create -f -
apiVersion: v1
kind: Service
metadata:
  name: cubrid-carbonet-slave2
  namespace: carbonet-prod
spec:
  type: NodePort
  ports:
  - port: 30000
    targetPort: 30000
    nodePort: 33003
  selector:
    app: cubrid-carbonet
    statefulset.kubernetes.io/pod-name: cubrid-ha-2
SVC_EOF
echo "Slave2 NodePort service recreated."

echo "=== [6.7/7] Cleaning up stale broker connections ==="
# Reset query_editor (port 33000) connections
kubectl exec cubrid-ha-0 -n ${NAMESPACE} -c cubrid -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && cubrid broker reset query_editor" 2>/dev/null || true
# Reset broker2 (port 33001) connections
kubectl exec cubrid-ha-0 -n ${NAMESPACE} -c cubrid -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && cubrid broker reset broker2" 2>/dev/null || true
echo "Broker connections cleaned."

echo "=== [7/7] Ensuring BROKER2 on port ${BROKER_PORT} ==="
# Check if BROKER2 config exists, add if missing
kubectl exec cubrid-ha-0 -n ${NAMESPACE} -c cubrid -- bash -c "
  if ! grep -q '^\[%BROKER2\]' /home/cubrid/CUBRID/conf/cubrid_broker.conf 2>/dev/null; then
    echo 'Adding BROKER2 configuration...'
    cat >> /home/cubrid/CUBRID/conf/cubrid_broker.conf << 'BROKER2_EOF'

[%BROKER2]
SERVICE                 =ON
SSL                     =OFF
BROKER_PORT             =33001
MIN_NUM_APPL_SERVER     =4
MAX_NUM_APPL_SERVER     =10
APPL_SERVER_SHM_ID      =33001
LOG_DIR                 =/var/lib/cubrid/CUBRID/log/broker/sql_log_broker2
ERROR_LOG_DIR           =/var/lib/cubrid/CUBRID/log/broker/error_log_broker2
SQL_LOG                 =OFF
TIME_TO_KILL            =60
SESSION_TIMEOUT         =600
KEEP_CONNECTION         =ON
CCI_DEFAULT_AUTOCOMMIT  =ON
BROKER2_EOF
    echo 'BROKER2 configuration added.'
  else
    echo 'BROKER2 configuration already exists.'
  fi
" 2>/dev/null || true

kubectl exec cubrid-ha-0 -n ${NAMESPACE} -c cubrid -- bash -c "export CUBRID=/home/cubrid/CUBRID && export PATH=\$CUBRID/bin:\$PATH && export LD_LIBRARY_PATH=\$CUBRID/lib:\$LD_LIBRARY_PATH && cubrid broker restart"
echo "BROKER2 on port ${BROKER_PORT} restarted."
