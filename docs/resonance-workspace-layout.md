# Resonance Workspace Layout

## Goal

`/opt/Resonance`를 단순 문서 보관소가 아니라, 향후 공통 모듈과 배포 자산이 올라갈 실제 프레임워크 워크스페이스 구조로 정의한다.

## Recommended layout

```text
Resonance/
  docs/
  plans/
  notes/
  catalog/
  manifests/
  modules/
    resonance-common/
    resonance-builder/
    resonance-ops/
    resonance-observability/
  adapters/
    resonance-adapter-contracts/
    resonance-common-adapter/
  deploy/
    docker/
    k8s/
      base/
      projects/
        carbonet/
  package-sets/
    common/
    projects/
```

## Meaning

- `modules/`
  - Resonance로 승격될 공통 소스 위치
- `adapters/`
  - common boundary adapter contracts
- `deploy/k8s/base`
  - 공통 control plane / shared services
- `deploy/k8s/projects/carbonet`
  - Carbonet 프로젝트별 workload
- `package-sets/common`
  - 공통 JAR 세트 manifest
- `package-sets/projects`
  - 프로젝트별 package set manifest

## Stage 1 rule

처음에는 source를 대량 이동하지 않고, 이 구조와 manifest만 먼저 배치한다.

그 다음 웨이브에서 module-by-module로 코드를 승격한다.
