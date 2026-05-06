# Resonance Project Runtime Deployment Model

## Goal

프로젝트별 빌드 패키지를 따로 기동할 수 있고, 공통은 어댑터와 common JAR set으로 잘 나누어 공통만 업데이트해도 프로젝트를 최대한 안 건드리는 방향을 정의한다.

## Core deployment rule

- 공통 업데이트는 `Resonance common`에서 처리
- adapter compatibility 검증 후 common JAR set 새 버전 생성
- 프로젝트는 가능하면 source 수정 없이 새 common JAR set만 교체

## Project runtime unit

프로젝트별 실행 단위:

- `project-runtime.jar`
- `project-adapter.jar`
- `common-jar-set`
- `theme-bundle`
- `project-manifest`
- `k8s-release-manifest`

## Carbonet Runtime Deployment Lines

Carbonet은 기본 배포판을 Kubernetes로 둔다. 로컬 PC나 저사양 원격 서버처럼 Kubernetes를 올리기 부담스러운 판에서는 같은 JAR를 `:18000` 런타임으로 기동한다.

- `k8s`: `deploy/k8s/projects/carbonet/*` 매니페스트와 `carbonet-runtime-config`/Secret을 사용한다.
- `local`: `CARBONET_RUNTIME_ENV=local`로 `/opt/Resonance` 로컬 PC 경로, localhost HTTPS 인증서, React filesystem override를 사용한다.
- `remote-221`: `CARBONET_RUNTIME_ENV=remote-221`로 221 웹서버 JAR + nginx + 외부 DB 서버 라인을 사용한다.

JAR 런타임 env 파일은 다음 순서로 병합된다. 뒤 파일이 앞 파일을 덮어쓴다.

1. `ops/config/carbonet-${PORT}.defaults.env`
2. `ops/config/carbonet-${PORT}.${CARBONET_RUNTIME_ENV}.defaults.env`
3. `ops/config/carbonet-${PORT}.env`
4. `ops/config/carbonet-${PORT}.${CARBONET_RUNTIME_ENV}.env`

로컬 실행 예:

```bash
CARBONET_RUNTIME_ENV=local bash ops/scripts/restart-18000.sh
```

221 원격 JAR 실행 예:

```bash
CARBONET_RUNTIME_ENV=remote-221 bash ops/scripts/restart-18000.sh
```

221 blue-green 배포 예:

```bash
CARBONET_RUNTIME_ENV=remote-221 bash ops/scripts/deploy-blue-green-221.sh
```

비밀값은 Git에 커밋하지 않는다. DB 비밀번호, 토큰, ecoinvent OAuth 값은 `ops/config/carbonet-18000.env`, `ops/config/carbonet-18000.remote-221.env`, Kubernetes Secret, 또는 실행 환경변수로 주입한다.

## What changes on common update

- `common-jar-set` version
- `adapter contract` version
- possibly `builder structure version`

## What should not change if possible

- project page composition files
- project-specific route binding
- project wording/config

## Builder implication

빌더는 업데이트 이후에도 최신 구조를 따라가야 한다.

즉:

- framework structure version 확인
- common JAR set version 확인
- adapter contract version 확인
- 그 기준으로 scaffolding / package compose

## Success criteria

- 공통 업데이트 시 project source를 대량 수정하지 않는다.
- project runtime package만 다시 조립하면 되는 경우가 많다.
- adapter compatibility가 깨질 때만 project code를 만진다.
- Kubernetes release 단위까지 project별로 독립 관리 가능하다.
