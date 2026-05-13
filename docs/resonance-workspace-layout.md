# Resonance Workspace Layout

## Goal

`/opt/Resonance`를 실행 가능한 프레임워크 워크스페이스로 정의한다. AI 작업자, 운영 스크립트, Kubernetes 배포, 프로젝트별 런타임은 모두 이 경계표를 먼저 따른다.

## Canonical layout

```text
Resonance/
  apps/
    carbonet-app/
    operations-console/
    project-runtime/
  modules/
    resonance-common/
    resonance-builder/
    resonance-ops/
    resonance-observability/
  projects/
    carbonet-adapter/
    carbonet-frontend/
    carbonet-runtime/
    project-template/
    project-template-adapter/
  adapters/
  docs/
  plans/
  notes/
  catalog/
  manifests/
  data/
  deploy/
    docker/
    k8s/
      base/
      projects/
        carbonet/
  ops/
    config/
    db/
    docker/
    scripts/
  package-sets/
    common/
    projects/
  skills/
  templates/
  third_party/
  var/                # local runtime only; not committed
  backups/            # local backup only; not committed
```

## Meaning

- `apps/`
  - 실제 실행 단위. `carbonet-app`은 통합 앱, `operations-console`은 운영 콘솔, `project-runtime`은 프로젝트별 얇은 런타임 패키징을 맡는다.
- `modules/`
  - 재사용 가능한 프레임워크 공통 모듈. `resonance-common`, `resonance-builder`, `resonance-ops`, `resonance-observability`로 나누어 공통/빌더/운영/관측 책임을 분리한다.
- `projects/`
  - 프로젝트별 코드와 어댑터. Carbonet은 `carbonet-adapter`, `carbonet-runtime`, `carbonet-frontend`가 한 세트이며, 새 프로젝트는 `project-template*`에서 시작한다.
- `adapters/`
  - 루트 어댑터 계약의 자리. 새 코드는 가능하면 `modules/*` 또는 `projects/*-adapter` 내부의 명시적 port/adapter 쌍으로 둔다.
- `data/`
  - AI 패턴 카드, 화면/권한/운영 메타데이터, 프로젝트 경계 계약 등 커밋 가능한 작은 데이터.
- `docs/ai/`
  - AI가 작업 전에 읽는 지도. 화면/API/DB/권한/운영/스킬/RAG 문서를 이 아래에서 맞춘다.
- `ops/`
  - 빌드, 재배포, DB migration, Kubernetes, local/remote runtime 제어 스크립트의 표준 진입점.
- `deploy/k8s/base`
  - 공통 control plane / shared services 매니페스트.
- `deploy/k8s/projects/carbonet`
  - Carbonet 프로젝트별 workload. 프로젝트가 여러 개가 되면 `deploy/k8s/projects/<project-id>`를 추가한다.
- `package-sets/common`
  - 공통 JAR 세트 manifest.
- `package-sets/projects`
  - 프로젝트별 package set manifest.
- `var/`, `backups/`
  - 로그, 릴리스 조립물, 임시 diff, 실행 PID, 로컬 백업. Git에는 들어가지 않고 언제든 재생성 가능한 영역으로 취급한다.

## Boundary rule

- 공통 기능은 `modules/resonance-common` 또는 `modules/resonance-ops`에 둔다.
- 빌더 핵심은 `modules/resonance-builder/screenbuilder-core`, Carbonet 연결은 `modules/resonance-builder/screenbuilder-carbonet-adapter`에 둔다.
- 프로젝트별 변경은 `projects/<project>` 아래에 둔다.
- 운영 자동화는 `ops/scripts`에서 시작하고, Kubernetes 선언은 `deploy/k8s`에 둔다.
- 새 로컬 산출물, 로그, 백업, 비밀값은 같은 턴에서 `.gitignore` 또는 local-only 저장소로 분리한다.

## Deployment rule

전체 로컬 Kubernetes 재배포의 표준 수는:

```bash
bash ops/scripts/restart-local-carbonet-k8s.sh
```

프론트엔드만 바꿨을 때의 빠른 수는:

```bash
CARBONET_NODE_HEAP_MB=4096 bash ops/scripts/restart-local-carbonet-frontend-fast.sh
```

프로젝트가 여러 개일 때는 `projects/<project>-adapter`, `projects/<project>-runtime`, `deploy/k8s/projects/<project>`를 한 세트로 추가하고, 공통 모듈은 source 수정 없이 JAR set 교체로 승격한다.
