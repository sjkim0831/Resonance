# Local Kubernetes Development Environment

本地开发环境与生产环境隔离，支持快速迭代。

## 推荐的本地 K8s 选项

| 方案 | 资源需求 | 复杂度 | 推荐场景 |
|------|----------|--------|----------|
| **kind** | 低 (4GB+) | 简单 | 快速测试、Docker 容器 |
| **minikube** | 中 (8GB+) | 中等 | 完整 K8s 功能测试 |
| **k3d** | 低 (4GB+) | 简单 | 轻量级、Docker 镜像 |
| **Docker Desktop K8s** | 高 (16GB+) | 简单 | macOS/Windows |

## kind 快速开始

### 1. 安装 kind

```bash
# Linux
curl -Lo kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x kind && sudo mv kind /usr/local/bin/

# macOS
brew install kind
```

### 2. 创建本地集群

```bash
# 单节点集群
kind create cluster --name carbonet-dev

# 多节点集群 (更接近生产环境)
kind create cluster --name carbonet-dev --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 30080
    hostPort: 80
    protocol: TCP
  - containerPort: 30443
    hostPort: 443
    protocol: TCP
- role: worker
- role: worker
EOF

# 设置默认集群
kubectl cluster-info --context kind-carbonet-dev
```

### 3. 部署到本地集群

```bash
# 导出 KUBECONTEXT
export KUBECONTEXT=kind-carbonet-dev

# 使用 deploy script (修改 NAMESPACE)
NAMESPACE=carbonet-dev bash ops/scripts/resonance-k8s-build-deploy-80-v2.sh
```

## minikube 快速开始

### 1. 安装 minikube

```bash
# Linux
curl -Lo minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
chmod +x minikube && sudo mv minikube /usr/local/bin/

# macOS
brew install minikube
```

### 2. 启动集群

```bash
# 使用 Docker 驱动
minikube start --driver=docker --cpus=4 --memory=8g --disk-size=50g

# 或者使用 Podman
minikube start --driver=podman --cpus=4 --memory=8g

# 启用 ingress addon
minikube addons enable ingress
minikube addons enable storage-provisioner
```

### 3. 部署应用

```bash
# 暴露服务
minikube service carbonet-runtime --url -n carbonet-prod

# 或者通过 tunnel (需要 sudo)
sudo minikube tunnel
# 然后访问 http://127.0.0.1
```

## 本地 CUBRID 开发

生产环境使用 3 节点 HA，本地可以使用单机版。

### Docker 快速启动

```bash
# 单节点 CUBRID
docker run -d \
  --name cubrid-dev \
  -p 33000:33000 \
  -p 33001:33001 \
  -e CUBRID_DATABASE=demodb \
  cubrid/cubrid:11.4

# 连接字符串
jdbc:cubrid:localhost:33001:demodb:::?charSet=UTF-8
```

### 本地 HA 模拟

```bash
# 使用 docker-compose 模拟 3 节点
cat > docker-compose.cubrid-ha.yml <<EOF
version: '3.8'
services:
  cubrid-master:
    image: cubrid/cubrid:11.4
    container_name: cubrid-master
    ports:
      - "33001:33001"
    environment:
      - CUBRID_MODE=master
    networks:
      - cubrid-net

  cubrid-slave1:
    image: cubrid/cubrid:11.4
    container_name: cubrid-slave1
    ports:
      - "33002:33001"
    environment:
      - CUBRID_MODE=slave
      - CUBRID_MASTER_HOST=cubrid-master
    networks:
      - cubrid-net

  cubrid-slave2:
    image: cubrid/cubrid:11.4
    container_name: cubrid-slave2
    ports:
      - "33003:33001"
    environment:
      - CUBRID_MODE=slave
      - CUBRID_MASTER_HOST=cubrid-master
    networks:
      - cubrid-net

networks:
  cubrid-net:
    driver: bridge
EOF

docker-compose -f docker-compose.cubrid-ha.yml up -d
```

## 开发工作流

### 1. 文件修改自动部署

```bash
# 启动文件监控
bash ops/scripts/resonance-file-watch.sh start

# 修改代码后自动检测并部署
# Ctrl+C 停止
bash ops/scripts/resonance-file-watch.sh stop
```

### 2. PR 前验证

```bash
# 本地 CI (在修改分支上运行)
bash ops/scripts/resonance-pr-ci.sh all feature/my-feature

# 推送到远程前必须通过
```

### 3. 生产部署

```bash
# 本地测试通过后，合并到 main
git checkout main
git merge feature/my-feature
git push origin main

# 自动触发生产部署 (如果配置了 CI/CD webhook)
```

## 环境变量

```bash
# 本地开发环境变量
export KUBECONTEXT=kind-carbonet-dev
export NAMESPACE=carbonet-dev
export DB_HOST=localhost
export DB_PORT=33001
export RESONANCE_ENV=local
```

## 常见问题

### Q: kind 中 Ingress 不工作

```bash
# 确保 extraPortMappings 已配置 (见上文创建集群)
# 或者使用 NodePort 代替
```

### Q: Docker 镜像无法加载

```bash
# kind 加载本地镜像
kind load docker-image my-image:tag --name carbonet-dev
```

### Q: 资源不足

```bash
# 检查集群状态
kubectl describe nodes

# 清理不需要的 pods
kubectl delete pods --all -n default
```

## 切换环境

```bash
# 列出所有 context
kubectl config get-contexts

# 切换到生产
kubectl config use-context kind-carbonet-dev

# 切换到真实集群
kubectl config use-context do-nyc1-carbonet-prod
```

## 清理

```bash
# 删除 kind 集群
kind delete cluster --name carbonet-dev

# 删除 minikube
minikube delete

# 停止本地 CUBRID
docker stop cubrid-dev && docker rm cubrid-dev
```