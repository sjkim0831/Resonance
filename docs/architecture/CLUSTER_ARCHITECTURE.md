# Resonance Kubernetes Cluster Architecture

> **Document Version:** 1.0
> **Generated:** 2026-06-16
> **Cluster:** Single-node k3s on `ccus` (172.16.1.232)
> **k3s Version:** v1.35.6 | **Container Runtime:** containerd 2.2.2

---

## 1. Cluster Overview

### 1.1 Node Specifications

| Property | Value |
|----------|-------|
| Hostname | `ccus` |
| Role | control-plane |
| Internal IP | `172.16.1.232` |
| External IP | `172.16.1.232` |
| OS | Ubuntu 26.04 LTS |
| Kernel | 7.0.0-22-generic |
| Architecture | linux/amd64 |
| CPU | 3778m (11% used) |
| Memory | 27.5 Gi (44% used) |
| Root Disk | 295 GB (57% used) |
| Data Disk | 1.5 TB `/opt` partition (50% used, NVMe) |
| CNI | Flannel (vxlan, `10.244.0.0/24`) |

### 1.2 Network Interfaces

| Interface | Subnet | Purpose |
|-----------|--------|---------|
| `enp209s0f0np0` | `172.16.1.0/24` | Primary network |
| `enp209s0f1np1` | - | Secondary network (unused) |
| `tailscale0` | `100.125.44.95` | VPN overlay |
| `docker0` | `172.17.0.0/16` | Docker bridge |
| `cni0` | `10.244.0.0/24` | Kubernetes pod network |
| `flannel.1` | `10.244.0.0/32` | Flannel overlay |

### 1.3 DNS Configuration

| Component | IP | Port |
|-----------|-----|------|
| kube-dns (ClusterIP) | `10.96.0.10` | 53/UDP, 53/TCP, 9153/TCP |
| systemd-resolved | `127.0.0.53` | (stub resolver) |
| Upstream DNS | `164.124.101.2` | (ISP) |
| Tailscale DNS | `100.100.100.100` | (Tailnet) |

> ⚠️ **DNS Issue Active:** CoreDNS is in CrashLoop due to a forward loop between CoreDNS and systemd-resolved stub resolver (`127.0.0.53`). CoreDNS `forward . /etc/resolv.conf` resolves to stub resolver, which queries CoreDNS → loop detected.

---

## 2. Namespaces

```
kube-system              # Critical system pods
├── monitoring           # Prometheus + Grafana + InfluxDB
├── loki                 # Log aggregation
├── promtail             # Log collection daemonset
├── argocd               # GitOps/CD
├── velero               # Backup & restore
├── carbonet-prod        # Main application (primary namespace)
├── default              # Legacy carbonet workloads
├── ai-runtime           # AI model inference
├── qdrant               # Vector database
├── vault                # Secrets management
├── kubernetes-dashboard # Web UI
├── keda                 # Event-driven autoscaling
├── falco                # Security monitoring
├── resonance-ops        # Operations console
└── cubrid-11            # Legacy CUBRID
```

---

## 3. Infrastructure Components

### 3.1 Networking Layer

| Component | Type | Status | Notes |
|-----------|------|--------|-------|
| Flannel (CNI) | DaemonSet | ✅ Running | vxlan backend, `10.244.0.0/24` pod network |
| kube-proxy | DaemonSet | ✅ Running | iptables mode |
| NVIDIA device plugin | DaemonSet | ✅ Running | GPU node resources |

### 3.2 Ingress & Traffic

| Service | Type | Port | Exposure |
|---------|------|------|----------|
| carbonet-runtime | NodePort | 80 | Direct NodePort |
| carbonet-runtime-review | NodePort | 20080 | Direct NodePort |
| grafana | NodePort | 30300 | Direct NodePort |
| prometheus | NodePort | 30900 | Direct NodePort |
| qdrant | NodePort | 30333, 30334 | Direct NodePort |
| codex-qwen36 | NodePort | 32436 | Direct NodePort |

> **No Ingress Controller installed.** Services are exposed directly via NodePort. NGINX Ingress Controller is recommended for production.

---

## 4. Observability Stack

### 4.1 Monitoring (`monitoring` namespace)

| Component | Type | Replicas | Port | Status |
|-----------|------|----------|------|--------|
| Prometheus | Deployment | 1 | 9090 (NodePort 30900) | ✅ Running |
| Grafana | Deployment | 1 | 3000 (NodePort 30300) | ✅ Running |
| InfluxDB | Deployment | 1 | 8086, 8088 | ✅ Running |
| kube-state-metrics | - | - | - | Not installed |
| node-exporter | - | - | - | Not installed |

### 4.2 Logging (`loki`, `promtail` namespaces)

| Component | Type | Replicas | Port | Status |
|-----------|------|----------|------|--------|
| Loki | Deployment | 1 | 3100 | ✅ Running |
| Promtail | DaemonSet | 1 | 3100 | ✅ Running (12h) |

### 4.3 Tracing

> **OpenTelemetry:** Not installed.

---

## 5. Application Platform

### 5.1 carbonet-prod (Primary Application)

| Component | Type | Replicas | Status | Storage |
|-----------|------|----------|--------|---------|
| carbonet-runtime | Deployment | 2 (HPA 2-6) | ⚠️ CrashLoopBackOff | - |
| carbonet-runtime-review | Deployment | 1 | ⚠️ CrashLoopBackOff | - |
| cubrid-carbonet | StatefulSet | 1 | ✅ Running | 10Gi PVC (local-storage) |

| Resource | Details |
|----------|---------|
| PVC | `cubrid-pvc` → PV `cubrid-pv` (10Gi, local-storage) |
| HPA | `carbonet-runtime-hpa` — target memory 90%, min 2, max 6 |
| PDB | `carbonet-runtime-pdb` — min 2 available |
| ConfigMaps | `carbonet-runtime-config`, `carbonet-runtime-manifest` |
| Network Policy | `default-deny`, `allow-dns`, `allow-cubrid-broker` |
| Broker | `cubrid-broker-config`, separate broker config |

**Services:**
- `carbonet-runtime`: NodePort 80, ClusterIP for internal routing
- `carbonet-runtime-review`: NodePort 20080
- `cubrid-carbonet`: ClusterIP 33000, bound to StatefulSet
- `local-registry`: ClusterIP 5000 (for CUBRID image)
- `ollama-gpu`: ClusterIP 11434 (GPU model server)

### 5.2 default (Legacy Workloads)

| Component | Type | Status |
|-----------|------|--------|
| carbonet-runtime-ccus | Pod | ⚠️ CrashLoopBackOff |
| cubrid-carbonet-ccus | Pod | ✅ Running |

### 5.3 ai-runtime

| Component | Type | Port | Status |
|-----------|------|------|--------|
| codex-qwen36 | Deployment | 32436 (NodePort) | ⚠️ 0/0 ready (GPU resource issue) |

---

## 6. Data Services

### 6.1 Qdrant (Vector Database)

| Property | Value |
|----------|-------|
| Namespace | `qdrant` |
| Image | `qdrant/qdrant:v1.7.4` |
| ClusterIP | `10.99.36.132:6333,6334` |
| NodePort | `30333,30334` |
| Status | ✅ Running |

### 6.2 Vault (Secrets Management)

| Property | Value |
|----------|-------|
| Namespace | `vault` |
| Type | StatefulSet (1 replica) |
| ClusterIP | `10.109.235.1:8200,8201` |
| Internal | `None` (headless) |
| UI | `10.99.19.133:8200` |
| Status | ✅ Running |

### 6.3 CUBRID Database

| Namespace | Type | Storage | Status |
|-----------|------|---------|--------|
| carbonet-prod | StatefulSet | 10Gi PVC (local-storage) | ✅ Running |
| default | Pod (legacy) | - | ✅ Running |
| cubrid-11 | - | - | ⚠️ Active but isolated |

---

## 7. GitOps & CI/CD

### 7.1 Argo CD

| Component | Type | Replicas | Status | Port |
|-----------|------|----------|--------|------|
| argocd-server | Deployment | 1 | ✅ Running (RESTARTS: 209) | 80, 443 |
| argocd-repo-server | Deployment | 1 | ✅ Running | 8081, 8084 |
| argocd-dex-server | Deployment | 1 | ✅ Running | 5556-5558 |
| argocd-redis | Deployment | 1 | ✅ Running | 6379 |
| argocd-application-controller | StatefulSet | 1 | ✅ Running | - |
| argocd-notifications-controller | Deployment | 1 | ✅ Running | 9001 |
| argocd-applicationset-controller | Deployment | 1 | ⚠️ CrashLoopBackOff | 7000, 8080 |

**Network Policies:** 7 policies protecting each Argo CD component.

**Initial Admin Secret:** `argocd-initial-admin-secret` (Opaque, 1 data item)

### 7.2 Velero (Backup)

| Property | Value |
|----------|-------|
| Namespace | `velero` |
| Version | v1.15.0 |
| Status | ⚠️ Error (RESTARTS: 151) |
| Issue | MissingClusterDNS — unable to resolve cluster DNS |

---

## 8. Autoscaling & Scaling

### 8.1 KEDA (Event-Driven Autoscaling)

| Component | Type | Status |
|-----------|------|--------|
| keda-operator | Deployment | ✅ Running |
| keda-admission-webhooks | Deployment | ✅ Running |
| keda-operator-metrics-apiserver | Deployment | ✅ Running |

### 8.2 HPA

| HPA | Target | Min | Max | Current |
|-----|--------|-----|-----|---------|
| carbonet-runtime-hpa | Deployment/carbonet-runtime | 2 | 6 | memory: `<unknown>/90%` |

### 8.3 PDB (Pod Disruption Budget)

| PDB | Min Available | Max Unavailable | Allowed Disruptions |
|-----|---------------|-----------------|---------------------|
| carbonet-runtime-pdb | 2 | N/A | 0 |
| cubrid-broker-pdb | N/A | 0 | 0 |
| cubrid-carbonet-pdb | 1 | N/A | 0 |

---

## 9. Security

### 9.1 Network Policies

| Namespace | Policy | Pod Selector | Action |
|-----------|--------|--------------|--------|
| carbonet-prod | default-deny | - | Deny all |
| carbonet-prod | allow-dns | - | Allow DNS |
| carbonet-prod | allow-cubrid-broker | app=cubrid-carbonet | Allow broker |
| argocd | argocd-server-network-policy | app.kubernetes.io/name=argocd-server | Restrict |
| argocd | argocd-repo-server-network-policy | app.kubernetes.io/name=argocd-repo-server | Restrict |
| argocd | (5 more) | Various Argo CD components | Restrict |

### 9.2 RBAC

| Namespace | Role | Type |
|-----------|------|------|
| argocd | argocd-application-controller | Role |
| argocd | argocd-applicationset-controller | Role |
| argocd | argocd-dex-server | Role |
| argocd | argocd-notifications-controller | Role |
| argocd | argocd-redis | Role |
| argocd | argocd-server | Role |
| carbonet-prod | pod-exec | Role |
| kubernetes-dashboard | kubernetes-dashboard | Role |
| keda | keda-operator-certs | Role |
| cubrid-11 | cubrid-11 | Role |

### 9.3 Security Tools

| Tool | Status | Namespace |
|------|--------|-----------|
| Falco | ✅ Running | `falco` |
| Vault | ✅ Running | `vault` |

---

## 10. Storage

### 10.1 Storage Classes

| Name | Provisioner | Binding Mode | Reclaim Policy |
|------|-------------|--------------|----------------|
| local-storage | kubernetes.io/no-provisioner | WaitForFirstConsumer | Delete |

### 10.2 Persistent Volumes

| Name | Capacity | Access Modes | Storage Class | Status | Claim |
|------|----------|--------------|---------------|--------|-------|
| cubrid-pv | 10Gi | RWO | local-storage | Bound | carbonet-prod/cubrid-pvc |

### 10.3 Disk Layout

```
nvme0n1 (1.8TB)
├── p1: 200MB   → /boot/efi
├── p3: 1.5TB   → /opt         (kubelet pods, CUBRID PV)
└── p4: 300GB   → /           (root, 57% used)
```

---

## 11. Batch & Scheduled Jobs

| Name | Namespace | Schedule | Purpose |
|------|-----------|----------|---------|
| cleanup-failed-pods | default | `0 * * * *` (hourly) | Remove failed pods older than 1 hour |

---

## 12. Web UIs & Management

| Service | Namespace | Port | Access |
|---------|-----------|------|--------|
| kubernetes-dashboard | kubernetes-dashboard | 443 | ClusterIP + web UI |
| dashboard-metrics-scraper | kubernetes-dashboard | 8000 | ClusterIP |
| vault-ui | vault | 8200 | ClusterIP |
| Argo CD UI | argocd | 80, 443 | ClusterIP |
| Grafana | monitoring | 3000 | NodePort 30300 |
| Prometheus | monitoring | 9090 | NodePort 30900 |
| operations-console | resonance-ops | - | (config exists) |

---

## 13. Current Issues (Requires Attention)

| Priority | Issue | Namespace | Impact |
|----------|-------|-----------|--------|
| 🔴 Critical | CoreDNS CrashLoop (DNS loop) | kube-system | Cluster-wide DNS failure; all ClusterFirst pods affected |
| 🔴 Critical | MissingClusterDNS warnings | multiple | Pods falling back to Default policy (host DNS) |
| 🟠 High | ArgoCD applicationset-controller CrashLoop | argocd | ApplicationSet sync disabled |
| 🟠 High | velero Error state | velero | No backups available |
| 🟡 Medium | carbonet-runtime CrashLoop | carbonet-prod | Application unavailable |
| 🟡 Medium | carbonet-runtime-review CrashLoop | carbonet-prod | Review environment unavailable |
| 🟡 Medium | carbonet-runtime-ccus CrashLoop | default | Legacy service unavailable |
| 🟡 Medium | codex-qwen36 not ready | ai-runtime | AI inference unavailable |

---

## 14. Installed Components Summary

| Category | Component | Status | Namespace |
|----------|-----------|--------|-----------|
| **Container Runtime** | containerd 2.2.2 | ✅ | - |
| **CNI** | Flannel v0.28.4 | ✅ | kube-flannel |
| **DNS** | CoreDNS v1.13.1 | ⚠️ CrashLoop | kube-system |
| **Metrics** | metrics-server v0.8.1 | ✅ Running | kube-system |
| **GPU Support** | nvidia-device-plugin v0.17.1 | ✅ Running | kube-system |
| **GitOps** | Argo CD v3.4.3 | ⚠️ Partial | argocd |
| **Monitoring** | Prometheus latest | ✅ Running | monitoring |
| **Visualization** | Grafana latest | ✅ Running | monitoring |
| **Time-series DB** | InfluxDB 2.7 | ✅ Running | monitoring |
| **Log Aggregation** | Loki 3.2.1 | ✅ Running | loki |
| **Log Collection** | Promtail 3.2.1 | ✅ Running | promtail |
| **Backup** | Velero v1.15.0 | ⚠️ Error | velero |
| **Autoscaling** | KEDA 2.20.1 | ✅ Running | keda |
| **Secrets** | Vault | ✅ Running | vault |
| **Vector DB** | Qdrant v1.7.4 | ✅ Running | qdrant |
| **Dashboard** | Kubernetes Dashboard v2.7.0 | ✅ Running | kubernetes-dashboard |
| **Security** | Falco | ✅ Running | falco |

---

## 15. Recommended Next Steps

Based on 1-person DevOps best practices:

1. **Phase 1 - Critical Fix** (Current)
   - Fix CoreDNS loop issue (change `forward . /etc/resolv.conf` → direct upstream DNS)
   - This will automatically resolve most CrashLoopBackOff issues

2. **Phase 2 - Stabilize**
   - Fix ArgoCD applicationset-controller
   - Fix Velero backup configuration
   - Verify carbonet-runtime connectivity

3. **Phase 3 - Enhance** (Optional)
   - Install NGINX Ingress Controller (replace NodePort exposure)
   - Install cert-manager (TLS automation)
   - Install Longhorn (cloud-native storage, replacement for local-storage)
   - Setup proper external secrets management

4. **Phase 4 - Scale** (Future)
   - Consider Istio for service mesh (only if complexity justified)
   - Consider Crossplane for infrastructure management

---

## 16. Not Installed (Reference Only)

The following commonly-used tools are **not installed** in this cluster:

| Category | Tool | Recommended Phase |
|----------|------|------------------|
| Ingress | NGINX Ingress Controller | Phase 3 |
| TLS | cert-manager | Phase 3 |
| Storage | Longhorn | Phase 3 |
| Tracing | Jaeger / OpenTelemetry | Phase 4 |
| Service Mesh | Istio | Phase 4 |
| Infra Provisioning | Crossplane | Phase 4 |
| Image Registry | Harbor | Phase 3 |
| Configuration | Kustomize | Already recommended |
| CI Pipeline | Tekton | Phase 4 |