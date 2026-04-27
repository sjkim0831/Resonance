# Resonance Kubernetes Adoption Plan

## Goal

현재 Docker 기반 운영 자산 위에서, 프로젝트별 독립 실행과 공통 JAR 세트 패키징을 유지한 채 Kubernetes 배포로 확장한다.

## Current repository finding

원격 확인 결과 이미 아래 자산이 있다.

- `ops/docker/docker-compose.project.yml`
- `ops/docker/Dockerfile.project-runtime`
- `ops/scripts/build-project-docker.sh`
- `ops/scripts/run-local-docker.sh`
- `ops/scripts/deploy-project-release.sh`
- `ops/scripts/deploy-project-bg.sh`
- `ops/scripts/start-project-runtime.sh`

즉 Docker 기반 흐름은 이미 시작되어 있다.

반면 현재는:

- Helm chart
- Kubernetes manifest set
- namespace/release policy

는 아직 본격화되지 않은 것으로 본다.

## Migration path

### Stage 1. Docker-first package discipline

먼저 project package와 common JAR set을 확정한다.

- project runtime package
- project adapter package
- common JAR set
- theme bundle
- migration bundle
- project manifest

### Stage 2. Container contract

그 다음 각 프로젝트를 컨테이너 이미지로 감싼다.

이미지 입력:

- runtime jar
- adapter jar
- pinned common jar set
- config/env
- start script

### Stage 3. Kubernetes runtime

그 다음 아래 단위로 옮긴다.

- project별 Deployment
- project별 Service
- environment별 ConfigMap / Secret
- shared ops namespace 또는 control plane namespace

## Recommended k8s model

### Shared control plane

- `operations-console`
- shared governance APIs
- builder console
- runtime/package metadata

### Per-project runtime workload

- `carbonet-runtime`
- future project runtimes

즉 운영은 shared control plane, 프로젝트는 independent workload가 맞다.

## 3B agent usage in k8s

3B는 Kubernetes에서도 다음 전제 하에서만 적극 활용한다.

- package manifest가 있다
- release manifest가 있다
- workload target이 확정돼 있다
- deterministic worker가 실제 kubectl/rollout을 수행한다

즉 3B는:

- classify
- choose
- summarize
- draft

를 담당하고,

- apply
- rollback
- restart
- verify

는 worker가 담당한다.

## Packaging rule for k8s

Kubernetes에서도 여전히 핵심은 패키지 세트다.

컨테이너 이미지 안에는 최소한 아래가 포함되어야 한다.

- `project-runtime.jar`
- `project-adapter.jar`
- `common-jar-set`
- runtime config

## Answer about Docker Desktop / cmd

Docker Desktop의 Kubernetes를 켜지 않아도 `cmd` 또는 쉘에서 Kubernetes 작업은 가능하다.

단 조건이 있다.

- 실제 접근 가능한 Kubernetes cluster가 있어야 한다.
- `kubectl` context가 그 cluster를 가리켜야 한다.

즉:

- Docker Desktop k8s 없이도 가능
- 하지만 cluster 없이 `cmd`만으로 되는 것은 아니다

가능한 예:

- remote k8s cluster
- k3s
- kind
- minikube
- managed Kubernetes

## Success criteria

- 현재 Docker 흐름을 버리지 않고 k8s로 확장 가능하다.
- project별 독립 workload 배포가 가능하다.
- common JAR set과 project package discipline이 k8s에서도 유지된다.
