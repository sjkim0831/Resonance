# Resonance Agent Startup Rule

When the user says `/opt/Resonance 켜줘`, `Resonance 켜줘`, or asks to start this server, use this canonical startup command first:

```bash
cd /opt/Resonance && bash ops/scripts/resonance-up.sh
```

Do not substitute old `18000` local scripts for this Kubernetes runtime. The expected external service port is `80`.

## Command Compression

For every other operational intent, open the command index first:

```bash
cd /opt/Resonance && bash ops/scripts/resonance-command-index.sh help
```

Primary aliases:

- `up`: start/recover `/opt/Resonance`
- `deploy`: build/redeploy Kubernetes runtime on port `80`
- `doctor`: Kubernetes runtime status
- `broker`: PostgreSQL/Patroni broker check (ensure `postgres-patroni-0` is leader) — via `patroni-health-check.sh`
- `logs`: runtime log DB registration
- `inventory`: grouped command map

## What `resonance-up.sh` Does

- enable/start `containerd` and `kubelet` when needed and when sudo is available
- wait for the Kubernetes API
- check namespace `carbonet-prod`
- ensure PostgreSQL/Patroni cluster has quorum (at least 2 of 3 nodes up)
- ensure web Deployment `carbonet-runtime` is ready with 2 replicas
- keep service `carbonet-runtime` exposed on port `80`
- verify `http://127.0.0.1/actuator/health`
- write startup/repair events to `/opt/Resonance/var/ai-runtime/resonance-up-events.jsonl`

## Failure Inspection

```bash
kubectl -n carbonet-prod get pod,svc,deploy,statefulset -o wide
kubectl -n carbonet-prod describe pod -l app=carbonet-runtime
kubectl -n carbonet-prod logs deploy/carbonet-runtime --tail=200
kubectl -n carbonet-prod logs statefulset/postgres-patroni --tail=200
cat /opt/Resonance/var/ai-runtime/resonance-up-events.jsonl | tail -20
```

## Documentation Compression

Open `docs/operations/resonance-doc-index.md` before reading scattered docs. Treat `docs/resonance-wave-*` files as historical migration records, not current runtime instructions.

## Codex / Hermes Safety Guard

Before server edits, run from `/opt/Resonance` and verify the Git root. Do not treat `projects/carbonet-frontend/source` as a separate repository root.

Use `ops/scripts/codex-safe-status.sh` before broad staging commands. The pre-commit hook blocks oversized files, local vector DB / SQLite runtime state, possible secrets, and accidental mixed source + frontend artifact commits.

For `/admin/emission/survey-report`, product and byproduct rows live under `OUTPUT_PRODUCTS`; distinguish them with `group` or `sectionLabel`, not `OUTPUT_BYPRODUCTS`.

Vite bundles are minified. Do not decide whether a bundle is correct by grepping local variable names such as `isUnallocated` or `productOnlyMass`; verify behavior logic, manifest, and the runtime `react-app-overlay` path.

## React Bundle Integrity Guard

`projects/carbonet-frontend/src/main/resources/static/react-app/index.html` is a Vite build artifact — **never edit it manually**. Every `/assets/react/assets/*.{js,css,mjs}` reference it contains must exist on disk in the same `react-app/assets/` directory.

- Run `bash ops/scripts/resonance-react-bundle-integrity.sh` to verify: it fails (non-zero exit) if any referenced bundle is missing. This check runs automatically in `.git/hooks/pre-commit` and `ops/scripts/resonance-frontend-auto-build.sh`.
- When changing the frontend, **always build from source** (`cd projects/carbonet-frontend/source && CARBONET_NODE_HEAP_MB=8192 npm run build`) and commit `index.html` **together** with all the new hashed asset files and `.vite/manifest.json` in the same commit. Never commit `index.html` alone.
- `ops/scripts/resonance-frontend-auto-build.sh` fails explicitly (does not silently skip) if `projects/carbonet-frontend/source/` is missing. Restore with `git checkout <good-commit> -- projects/carbonet-frontend/source/`.
- `projects/carbonet-frontend/source/` must contain a working `package.json` and all `src/` files. If TypeScript fails to compile, fix the source before committing overlay changes.
- Never copy an `index.html` from another branch or environment without also committing the exact bundle files it references.

Commit source changes first. Commit frontend build artifacts separately only when explicitly requested. Never commit `data/ai-runtime/*.sqlite3`, `*.db`, vector indexes, runtime caches, or credentials.

## AI Agent Source Preservation Lock

This rule is mandatory for all AI agents working on Resonance.

1. Source of truth
   - React/UI source: `projects/carbonet-frontend/source/src/**`
   - Frontend package/build config: `projects/carbonet-frontend/source/package*.json`, `vite.config.ts`, `tsconfig*.json`
   - Java/runtime source: `apps/**/src/main/**`, `modules/**/src/main/**`
   - Runtime metadata/SDUI source: `projects/carbonet-backend-metadata/**`, `projects/carbonet-assets/static/**`

2. Generated or disposable paths
   - `projects/carbonet-frontend/src/main/resources/static/react-app/**`
   - `apps/**/src/main/resources/static/react-app/**`
   - `target/**`, `build/**`, `.gradle/**`, `node_modules/**`, container filesystems, pod filesystems

3. Never rely on generated files as the only copy of work.
   If a page only exists as a hashed bundle under `static/react-app/assets/*.js`, it is already at risk. Restore or create the matching source under `projects/carbonet-frontend/source/src/**` before build/deploy.

4. Before build/redeploy, verify preservation:
   ```bash
   git status --short
   git diff --check
   bash ops/scripts/resonance-frontend-overlay-guard.sh verify-source
   ```

5. After build/redeploy, verify runtime:
   ```bash
   bash ops/scripts/resonance-frontend-overlay-guard.sh verify-all
   curl -fsS http://127.0.0.1/actuator/health
   ```

6. Before final answer, commit or explicitly report uncommitted source changes.
   Container delete, pod recreation, image rebuild, and static asset cleanup must not be the only place where the work exists.

## No-Build / No-Deploy Page Development Rule

All AI agents must classify page work before editing.

No-build/no-deploy page work is allowed only when the requested change can be represented as runtime metadata, SDUI configuration, menu mapping, or static assets. In that case, edit these source-of-truth paths:

- `projects/carbonet-backend-metadata/**`
- `projects/carbonet-assets/static/**`
- `ops/runtime-metadata/**`
- `var/k8s/carbonet-runtime-manifest.json` only for runtime manifest changes

React source page work is not no-build/no-deploy. If the work creates or changes React components, routes, loaders, hooks, or TypeScript, edit:

- `projects/carbonet-frontend/source/src/**`

Then run the frontend build and overlay guard. Do not manually edit hashed bundles under `projects/carbonet-frontend/src/main/resources/static/react-app/assets/*.js` as source code.

Java/runtime work is build/redeploy-required. If the work changes Java classes, REST APIs, transaction behavior, DB schema, auth/security, shared contracts, Gradle/Maven config, or runtime container behavior, edit `apps/**` or `modules/**`, then build and redeploy.

The operating rule is:

1. Prefer `/admin/system/build-studio` and metadata for simple screen/content changes.
2. Store metadata-driven screen structure under `projects/carbonet-backend-metadata/**`.
3. Store page-owned static assets under `projects/carbonet-assets/static/**`.
4. Store React source under `projects/carbonet-frontend/source/src/**`.
5. Treat `projects/carbonet-frontend/src/main/resources/static/react-app/**` as generated overlay output, not source.
6. Never run `npm run build`, Maven/Gradle package, Docker build, image push, or Kubernetes rollout for metadata-only work.
7. Only classify work as build/redeploy-required when it changes React source, runtime engine behavior, security/auth, DB schema, shared Java contracts, transaction logic, or new REST APIs.
8. If unsure, preserve source first and ask before relying on overlay artifacts.

Before finishing any page task, verify the served overlay path, for example:

```bash
curl -sI http://127.0.0.1:32947/assets/react/api/build-studio-asset-inventory.json
curl -sI http://127.0.0.1:32947/assets/react/assets/BuilderStudioPage-BBdbfW4J.js
```

## No-Build Backend Script Development

Resonance v2.0부터 백엔드의 일부 로직도 무빌드/무배포로 수정할 수 있습니다.

### 지원 범위

| 구분 | 무빌드 가능 | 방식 |
|------|:----------:|------|
| Frontend/UI | ✅ | HostPath Overlay |
| Static Assets | ✅ | HostPath Overlay |
| Metadata | ✅ | HostPath Overlay |
| Menu/Query/Validation | ✅ | Groovy Script Engine |
| 핵심 Java 로직 | ❌ | 빌드 필요 |

### Groovy 스크립트 경로
```
projects/carbonet-backend-metadata/scripts/
├── menu-renderer.groovy    # 메뉴 렌더링, 권한
├── query-builder.groovy    # 동적 SQL 생성
└── validation-rules.groovy # 폼 검증
```

### 스크립트 수정 시
- **WatchService**가 파일 변경 자동 감지
- 즉시 reload (재빌드 불필요)
- 수동 reload: `curl -X POST http://127.0.0.1:32947/api/script/reload-all`

### 스크립트 관리 API
```bash
GET  /api/script/list           # 로드된 스크립트 목록
POST /api/script/reload/{name}  # 특정 스크립트 재로드
POST /api/script/reload-all     # 전체 재로드
POST /api/script/test/{name}/{method}  # 테스트 실행
```

### 여전히 빌드必需的 경우
- Java 클래스 신규 추가/수정
- DB 스키마 변경
- 보안/인증 로직 변경
- 새로운 REST API 엔드포인트
- Transaction 로직 변경
