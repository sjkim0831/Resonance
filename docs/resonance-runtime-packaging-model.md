# Resonance Runtime Packaging Model

## Goal

프레임워크는 폴더/워크스페이스로 관리하고, 프로젝트는 공통 JAR을 포함한 독립 패키지 세트로 관리해 프로젝트별 따로 실행과 이관 배포를 가능하게 한다.

## Core rule

- `Resonance` = framework workspace
- `Project` = versioned package set

즉 코드 저장 구조와 배포 구조를 분리해서 본다.

## Framework workspace

예:

- `/opt/Resonance`

포함:

- docs
- plans
- catalogs
- manifests
- future common module sources promoted from carbonet

## Project package model

예: `carbonet`

프로젝트는 아래 패키지 조합으로 배포한다.

- `project-runtime.jar`
- `project-adapter.jar`
- `common-jar-set/`
- `theme-bundle/`
- `migration-bundle/`
- `project-manifest.yaml`

이때 builder는 단순 생성기가 아니라, 위 패키지 구성을 계산하고 조립하는 package composer로 본다.

## Common JAR set

프로젝트는 공통 부분을 직접 소스 import로만 의존하지 않고, 배포 시 필요한 공통 JAR 세트를 같이 가진다.

예:

- `common-auth.jar`
- `platform-runtime-control.jar`
- `platform-version-control.jar`
- `screenbuilder-core.jar`

공통 업데이트 이후 프로젝트 패키지를 다시 만들 때는 이 JAR 세트 버전이 바뀌므로, builder도 구조 업데이트를 따라가야 한다.

## Independent execution

프로젝트별 독립 실행을 위해 각 프로젝트는 다음을 가진다.

- own runtime package
- own adapter package
- pinned common package set
- own runtime config
- own port/db/log/cache bindings

그러면 같은 운영서버에서도:

- carbonet만 시작
- carbonet만 중지
- carbonet만 재기동
- carbonet만 다른 버전 세트로 교체

가 가능하다.

## Docker and Kubernetes path

현재 저장소에는 이미 Docker 기반 자산이 있다.

- `ops/docker/docker-compose.project.yml`
- `ops/docker/Dockerfile.project-runtime`
- build/deploy/restart scripts

따라서 운영 경로는 아래 순서가 적절하다.

1. project package discipline 확정
2. Docker image discipline 확정
3. Kubernetes workload로 확장

즉 Docker를 버리고 k8s로 점프하는 것이 아니라, package set을 기준으로 둘을 자연스럽게 잇는다.

## Migration / deployment package

이관 시 전달 단위는 다음을 포함한다.

- project source or source snapshot
- project runtime package
- project adapter package
- required common package set
- theme bundle
- migration bundle
- project manifest
- install/deploy scripts

## Why source delivery can still work

운영은 패키지로 하고, 이관은 source+manifest 방식으로도 가능하다.

즉:

- 운영 서버 실행 = packaged runtime
- 타 환경 이관 = source snapshot + manifest + package descriptors

둘 다 지원하는 방향이 맞다.

## Success criteria

- framework는 폴더로 관리된다.
- project는 패키지 세트로 관리된다.
- 공통 JAR 포함 프로젝트별 독립 실행이 가능하다.
- 이관 시 필요한 공통 부분을 포함한 배포가 가능하다.
