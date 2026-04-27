# Resonance Wave 3 Reactor Plan

## Goal

`Resonance` 워크스페이스에 미러 승격된 공통 후보 모듈을 기준으로, 아직 `carbonet` 빌드를 깨지 않으면서도 다음 웨이브에서 실제 공통 빌드 전환이 가능한 `transitional reactor`를 세운다.

## Remote inspection summary

원격 `Resonance` inspection 결과:

- 아래 모듈은 실제 `pom.xml`과 `src`를 가진다.
  - `modules/resonance-ops/platform-runtime-control`
  - `modules/resonance-ops/platform-version-control`
  - `modules/resonance-common/stable-execution-gate`
  - `modules/resonance-builder/screenbuilder-core`
  - `modules/resonance-builder/screenbuilder-runtime-common-adapter`
- `modules/resonance-common/common-auth`는 `pom.xml`은 있으나 `src`가 보이지 않고 `target` 중심 상태다.

또한 현재 미러된 모듈의 `pom.xml`은 공통적으로:

- parent
  - `groupId = egovframework`
  - `artifactId = carbonet`
  - `version = 1.0.0`
- `relativePath = ../../pom.xml`

를 유지하고 있다.

즉 현재 구조에서 child pom이 기대하는 parent 위치는:

- `/opt/Resonance/modules/pom.xml`

이다.

## Why a transitional reactor is needed

지금 바로 child pom을 모두 `resonance` 기준으로 rewrite하면:

- dependency rename
- parent rewrite
- relativePath rewrite
- carbonet artifact rename

가 한 번에 일어나고, 이건 아직 너무 이르다.

따라서 이번 웨이브는:

- child pom은 그대로 두고
- `Resonance/modules/pom.xml`에 transitional parent를 둔다
- `Resonance/pom.xml`은 상위 workspace aggregator로 둔다

는 방식이 가장 안전하다.

## Transitional reactor layout

### 1. Workspace root

- `/opt/Resonance/pom.xml`
- 역할:
  - workspace aggregator
  - `modules` subtree 연결
  - 향후 `adapters`, `deploy`, `package-sets` 쪽 build tooling 연결 준비

### 2. Modules parent

- `/opt/Resonance/modules/pom.xml`
- 역할:
  - current mirrored children의 parent 역할
  - Carbonet root에서 필요한 property/dependency baseline을 임시 유지
  - promoted modules만 대상으로 reactor를 구성

## Initial Wave 3 promoted build set

우선 실제 build set에는 아래만 넣는 것이 안전하다.

- `resonance-common/stable-execution-gate`
- `resonance-builder/screenbuilder-core`
- `resonance-builder/screenbuilder-runtime-common-adapter`
- `resonance-ops/platform-version-control`
- `resonance-ops/platform-runtime-control`

`common-auth`는 source gap이 확인되기 전까지 reactor 기본 빌드 세트에서 제외하거나 optional candidate로 둔다.

## Known blockers

### 1. carbonet artifact dependency remains

예:

- `carbonet-common-core`
- `carbonet-mapper-infra`
- `carbonet-web-support`

즉 실제 standalone build 전환 전에는 이 artifact들에 대한:

- mirror promotion
- canonical rename
- 또는 temporary dependency bridge

중 하나가 필요하다.

### 2. common-auth source gap

`common-auth`는 현재 원격 inspection 기준 `src`가 보이지 않는다.

다음 웨이브 전 확인 필요:

- 실제 source owner 위치
- generated source인지
- 과거 build artifact만 남은 것인지

### 3. shared resources path

`platform-runtime-control`은 resources를:

- `${project.basedir}/../../src/main/resources`

에서 읽는다.

즉 `Resonance/modules/src/main/resources` 또는 구조 대체 경로 설계가 필요하다.

## Recommended next switch order

1. `screenbuilder-core`
2. `screenbuilder-runtime-common-adapter`
3. `stable-execution-gate`
4. `platform-version-control`
5. `platform-runtime-control`
6. `common-auth` source 확인 후 반영

## Success criteria

- `Resonance/pom.xml`이 workspace root로 존재한다.
- `Resonance/modules/pom.xml`이 transitional parent로 존재한다.
- promoted modules가 `carbonet` 빌드와 분리된 별도 build wave를 가질 준비가 된다.
- 아직 `carbonet` 기존 reactor는 그대로 유지한다.

