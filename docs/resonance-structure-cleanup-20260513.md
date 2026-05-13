# Resonance Structure Cleanup - 2026-05-13

## Purpose

Ubuntu native 이전 전 `/opt/Resonance`의 폴더 경계, 배포 진입점, AI 작업 기준, RAG/하네스 상태를 한 장으로 고정한다.

## Canonical Boundaries

- `apps/`: 실행 앱. `carbonet-app`, `operations-console`, `project-runtime`만 둔다.
- `modules/`: 공통 프레임워크. `resonance-common`, `resonance-builder`, `resonance-ops`, `resonance-observability`가 공통/빌더/운영/관측을 나눈다.
- `projects/`: 프로젝트 단위 코드. Carbonet은 `carbonet-adapter`, `carbonet-runtime`, `carbonet-frontend`가 한 세트다.
- `deploy/`: Kubernetes와 Docker 선언. 프로젝트가 늘면 `deploy/k8s/projects/<project>`를 추가한다.
- `ops/`: 빌드, 재배포, DB migration, rollback, RAG/Hermes, model gate 실행 진입점.
- `data/`: 커밋 가능한 작은 메타데이터, 패턴 카드, RAG DB, 프로젝트 경계 계약.
- `docs/` and `skills/`: AI가 작업 전에 읽는 문서와 실행 규칙.
- `var/` and `backups/`: local-only runtime/cache/backup. Git과 구조 판단에서 제외한다.

## Current Structure Findings

- Root Maven aggregator is `pom.xml -> modules, projects, apps`.
- Maven projects are `apps/*`, `modules/resonance-*/*`, `projects/carbonet-adapter`, and `projects/carbonet-runtime`.
- `projects/carbonet-frontend/source` is the React authoring root. `projects/carbonet-frontend/src/main/resources/static/react-app` and `apps/carbonet-app/src/main/resources/static/react-app` are mirrored build outputs.
- Controller/adapter split is present: 79 controllers, 27 adapters, 64 ports at audit time.
- Frontend folders are numerous because they are screen/feature oriented: 186 feature directories and 7 Playwright specs at audit time.
- Actual local `.env`, Kubernetes Secret manifests, and generated localhost certs remain on disk for local operation but are removed from Git tracking.

## Deployment Matrix

- Full local Kubernetes redeploy:

```bash
bash ops/scripts/restart-local-carbonet-k8s.sh
```

- Frontend-only Kubernetes refresh:

```bash
CARBONET_NODE_HEAP_MB=4096 bash ops/scripts/restart-local-carbonet-frontend-fast.sh
```

- Already-built runtime reattach:

```bash
SKIP_FRONTEND=true SKIP_IMAGE_BUILD=true bash ops/scripts/restart-local-carbonet-k8s.sh
```

- Local JAR runtime:

```bash
CARBONET_RUNTIME_ENV=local bash ops/scripts/restart-18000.sh
```

- Remote 221 blue-green:

```bash
CARBONET_RUNTIME_ENV=remote-221 bash ops/scripts/deploy-blue-green-221.sh
```

- DB migrations:

```bash
bash ops/scripts/apply-project-db-migration.sh <PROJECT_ID> [RELEASE_DIR]
```

## AI/Hermes/RAG Rules

- Start with `skills/resonance-workflow/SKILL.md`.
- Query the pattern DB before build, deploy, recovery, RAG, skill, or harness work:

```bash
python3 ops/scripts/query-pattern-card-db.py --keyword <intent>
```

- RAG index was rebuilt with:

```bash
python3 docs_ai.py index --root docs --root skills --root data/ai-runtime --root ops/scripts --root data/design-references/krds
```

- Useful verification:

```bash
python3 docs_ai.py search "harness skill docs" --limit 3
bash ops/scripts/run-hermes-rag-smoke.sh
```

## Cleanup Policy

- Do not commit `target/`, `node_modules/`, `.vite/`, Playwright reports, logs, PID files, `var/`, `backups/`, `.bak*`, local `.env`, localhost certs, or concrete Kubernetes Secret manifests.
- Keep `*.defaults.env`, `*.env.example`, and `*.secret.example.yaml` as reproducible deployment templates.
- Keep project source movement conservative. Prefer documentation and boundary contracts before moving large trees.

## Verification Snapshot

- Kubernetes client: available.
- Current context during audit: `docker-desktop`.
- `carbonet-prod` namespace: active.
- Kubernetes manifests dry-run: passed with `kubectl apply --dry-run=client --validate=false -f deploy/k8s/base -f deploy/k8s/projects/carbonet`.
- Script syntax gate: passed for the main build/deploy/RAG scripts.
- Hermes RAG smoke: opening book and pattern-card registry passed; final gate failed because the live `carbonet-runtime` image tag differed from recorded build version metadata.
