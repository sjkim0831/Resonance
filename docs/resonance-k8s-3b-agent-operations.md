# Resonance Kubernetes 3B Agent Operations

## Goal

서버급 시스템을 전제로 Kubernetes 기능을 적극 활용하고, 3B급 Ollama 에이전트가 k8s 위에서 대부분의 운영/개발 보조 작업을 수행할 수 있도록 구조를 정리한다.

## Important rule

`3B agent가 모든 것을 직접 판단`하는 구조로 가면 안 된다.

대신 아래 구조가 필요하다.

- Kubernetes control plane
- deterministic workers
- package manifest
- adapter/catalog/compatibility registry
- bounded 3B agent

즉 3B는 `k8s에서 모든 작업을 보조`할 수는 있지만, `모든 작업을 자유 추론으로 직접 실행`하면 안 된다.

## What 3B can own in k8s

- intake / request classification
- project/package/workload selection
- manifest draft
- Helm values draft
- ConfigMap/Secret usage guide draft
- rollout plan summary
- verification summary
- bounded fix suggestion

## What 3B should not own alone

- destructive rollout without verification
- cluster-wide arbitrary changes
- raw kubectl apply without manifest validation
- DB destructive migration execution
- broad multi-project refactor

## Kubernetes feature usage

서버급 시스템이면 아래 기능을 적극 활용해도 된다.

- namespace 분리
- Deployment
- Service
- ConfigMap
- Secret
- Ingress
- Job / CronJob
- HPA
- PDB
- readiness/liveness probe
- blue/green or canary rollout

## Recommended model

### Shared ops namespace

- operations-console
- builder console
- package governance
- AI control APIs

### Per-project runtime workload

- carbonet-runtime
- future project runtimes

즉 운영은 shared control plane, 프로젝트는 independent workload가 맞다.

## 3B task model in k8s

### Tier 1. Deterministic

코드/스크립트/worker가 직접 한다.

- build
- package
- image build
- rollout apply
- backup
- rollback
- health check

### Tier 2. 3B-assisted

3B가 구조화 입력을 받고 초안/판정을 한다.

- package selection
- workload target selection
- route/capability resolution
- manifest diff summary
- deployment review summary

### Tier 3. Escalation

복잡하면 medium/strong model 또는 승인으로 넘긴다.

- cross-project adapter break
- common contract redesign
- destructive migration

## Required contracts

- `project-package-manifest`
- `common-jar-set-manifest`
- `k8s-release-manifest`
- `adapter-compatibility-report`
- `deployment-verification-report`

## Success criteria

- 3B agent가 k8s 위에서 대부분의 운영 보조를 수행할 수 있다.
- 실제 실행은 deterministic worker가 맡는다.
- k8s 기능을 적극 활용해도 project/package/common 경계가 유지된다.
