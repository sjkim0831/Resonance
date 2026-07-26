# CUBRID 잔재 제거 및 PostgreSQL 환경 반영 계획

## 사용자 결정 (이번 세션에서 확정)

1. **현재 환경 조회만 수행**, 정상 운영 중인 시스템에 mutating 작업 금지.
2. **CUBRID 흔적만 제거**, PostgreSQL 환경은 현재 정상 동작 중인 상태 그대로 반영.
3. **PostgreSQL 환경은 이미 Patroni 3-node HA로 구축**, 데이터 디렉터리(`var/postgres-patroni/`하위 `postgres-patroni-0/1/2`)가 PV로 운영 중. 사용자가 확인한 데이터 폴더 4종은 postgres-patroni 3개 + 그 외 데이터(아래 표).
4. **이전 마이그레이션은 이미 한 차례 진행되었음** (plan `1783163030015-cubrid-to-postgresql-migration.md` 기록 존재). 본 plan은 그 잔재를 모두 일관되게 정리하는 후속 작업.

## 환경 진실 (read-only 조회 결과)

### Patroni / postgres
- **`postgres-patroni-0/1/2`**: k8s 운영 pod. 데이터 디렉터리 `var/postgres-patroni/postgres-patroni-{0,1,2}`
- **etcd**: `etcd-patroni-0/1/2` 존재 (운영 진단 스크립트가 `patroni-health-check.sh`에서 직접 참조).
- **HAProxy 부트스트랩 manifest**: `var/k8s/postgresql-ha/haproxy.yaml` (postgres-ha-0 단일 참조, **stale-pod** — 실제 라우팅은 `postgres-haproxy` Service로 별도 운영됨).
- **DB / 인증**: 사용자 `postgres` / `carbonet_app`, 비밀번호 `postgres123` (또는 `postgres_password`). DB 명 `carbonet`.
- **JDBC**: `jdbc:postgresql://postgres-haproxy:5432/carbonet` (단일 진입점, 운영 검증된 기존 값).
- **관련 서비스·스테이트풀셋 manifest 일부 stale**: `var/k8s/postgresql-ha/postgres-statefulset.yaml`은 `replicas:1`, image `postgres:16` raw — 실제 Patroni 운영 상태와 불일치. 이번 plan은 manifest 자체 재작성을 요구하지 않고, **값만 일관화**.

### Flyway / Liquibase 상태
- Spring Boot 의존성 / `spring.flyway.*` / `spring.liquibase.*` 모두 부재.
- `db/migrations/flyway/V1__baseline_schema.sql`, `db/changelog/liquibase/db.changelog-master.xml`은 **자동 생성된 더미 산출물** ("There are no results." 컬럼). 이 plan에서 이 파일들은 **삭제하지 않고 보관**하되 적용 경로에서 제외.
- `var/k8s/flyway/` 의 flyway-configmap / migrate-job은 정의만 있고 실제 실행되지 않음 — 이번 plan에서 손대지 않음.

### CUBRID 직접 참조 위치
- `ops/scripts/resonance-quickstart.sh` (CUBRID StatefulSet 라이프사이클)
- `ops/scripts/cubrid-*.sh` (recover / protection 등 다수)
- `ops/scripts/deploy-carbonet-kubeadm-k8s.sh` (CUBRID_HOST 환경변수 잔재)
- `ops/scripts/start-project-runtime.sh`, `start-18000.sh` (DB_URL/HOST 기본값)
- `ops/scripts/resonance-k8s-build-deploy-{80,20080,80-v2,80-enhanced}.sh` (CUBRID_HOST 기본값, deploy 시 JDBC URL 생성)
- `ops/scripts/resonance-sync-qwen40-improvements-to-cubrid.sh` (csql 호출)
- `ops/tools/flyway/conf/flyway.conf` (`flyway.driver=cubrid.jdbc.driver.CUBRIDDriver`)
- 백업 스크립트 `resonance-k8s-build-deploy-80.sh.bak-*` 다수
- `modules/resonance-builder/carbonet-builder-observability/.../DataAssetScanProvider.java` (// CUBRID specific query 주석 + sourcePath `"CUBRID/"`)
- `modules/resonance-common/carbonet-common-core/.../AdminEmissionGwpValueService.java` (i18n 메시지)
- `modules/resonance-common/carbonet-common-core/.../AdminSystemManagementController.java` (status/tables/query endpoint, port 33000 하드코딩)
- `AGENTS.md` (CUBRID broker / StatefulSet 안내, `resonance-up.sh` 흐름 설명)
- `.kilo/plans/` 안 historical plan 다수 (기록 유지)

### 매핑 규칙 (CUBRID 자리 → PostgreSQL 자리)

이 plan은 **새 시스템을 만드는 게 아니라** CUBRID 자리에 현재 PostgreSQL 운영 값을 그대로 채워 넣는 일입니다.

| 사용 빈 자리 값 (legacy CUBRID) | 현재 PostgreSQL 값 |
|---|---|
| `cubrid-carbonet-0.carbonet-prod.svc.cluster.local:33000` | `postgres-haproxy.carbonet-prod.svc.cluster.local:5432` (또는 `postgres-patroni` 직접) |
| `cubrid.jdbc.driver.CUBRIDDriver` | `org.postgresql.Driver` |
| `jdbc:cubrid:...` | `jdbc:postgresql://postgres-haproxy.carbonet-prod.svc.cluster.local:5432/carbonet?currentSchema=public` |
| `org.hibernate.community.dialect.CUBRIDDialect` | `org.hibernate.dialect.PostgreSQLDialect` |
| `CUBRID_USER=dba`, 패스워드 없음 | `POSTGRES_USER=carbonet_app`, 패스워드 `postgres123` (secret) |
| `CUBRID_DB=carbonet` | `POSTGRES_DB=carbonet` |
| 포트 `33000` 참조 (CUBRID 의미) | 포트 `5432` 참조 (PostgreSQL 의미) |

## 작업 범위 (수정 대상만, 신규 작성 X)

수정은 **legacy 잔재가 코드/스크립트/매니페스트/문서에 흩어져 있어 그 자리에 PostgreSQL 값을 채우고, 살아있을 필요가 없는 CUBRID 전용 라인만 삭제**하는 작업입니다. 본 plan은 다음 6개 그룹으로 한정됩니다.

### 1) 빌드·배포 스크립트 (`ops/scripts/`)
- `resonance-quickstart.sh`: `CUBRID_POD`, `kubect wait ... ${CUBRID_POD}` 등 CUBRID step을 **No-Op + 안내 로그 출력으로 변환**. CUBRID StatefulSet이 실제로 더는 없을 때 deploy 흐름이 깨지지 않도록 함. `fuser -k 33000/tcp` 라인 제거.
- `cubrid-recover-v2.sh`, `cubrid-protection.sh` 등 `cubrid-*` 스크립트: **삭제하지 않고** 헤더에 `DEPRECATED: CUBRID 제거됨 — 사용 금지` 표시 후 본문 첫 줄에서 `exit 1` 조기 종료. (회귀 시 재활성화를 막기 위함.)
- `resonance-k8s-build-deploy-{80,20080,80-v2,80-enhanced}.sh`: 기본값을 `CUBRID_HOST=cubrid-...`에서 `POSTGRES_HOST=postgres-haproxy.carbonet-prod.svc.cluster.local`로 변경, `CUBRID_*` 변수명은 더는 사용하지 않음. 환경변수는 backward-compat 1스텝 — `${CUBRID_HOST:-postgres-haproxy...}` 같이 env가 들어오면 그대로 흘리되 기본값만 PG.
- `deploy-carbonet-kubeadm-k8s.sh`, `start-project-runtime.sh`, `start-18000.sh`: 같은 규칙.
- `resonance-sync-qwen40-improvements-to-cubrid.sh`: **이름 변경** + 내부 `csql` 호출을 `psql`로 치환. 호출 pod `cubrid-carbonet-0` → `postgres-patroni-0`(또는 haproxy).
- `resonance-k8s-build-deploy-80.sh.bak-*`: 백업은 그대로 둠.
- `ops/tools/flyway/conf/flyway.conf`의 `flyway.driver=cubrid.jdbc.driver.CUBRIDDriver`: `flyway.driver=org.postgresql.Driver` 로 한 줄 수정. (단, 이 파일은 어떤 자동화에도 부트 시점에 로드되지 않음 — 문서적 의미만.)

### 2) k8s 매니페스트 (`var/k8s/`)
- `carbonet-runtime-manifest.json`: 컨테이너 env의 `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_DRIVER_CLASS_NAME`, `SPRING_JPA_DATABASE_PLATFORM`을 PostgreSQL 값으로 변경.
- `carbonet-runtime-kubeadm.yaml`: 동일한 env 항목 변경.
- `carbonet-cubrid-hostpath.yaml`: **스테이트풀셋 자체를 제거하지 않음** (manifest 수준 legacy). 단, 본 plan 편집 시점에는 운영중인 CUBRID StatefulSet이 이미 없을 가능성 — manifest 자체는 deprecated 마커만 헤더에 추가.
- `var/k8s/postgresql-ha/postgres-statefulset.yaml` (manifest가 stale — replicas 1, pgstatefulset `postgres-ha`, postgres-ha-0 PV): 본 plan은 건드리지 않음. 운영 코드(앱)는 `postgres-haproxy` 주소를 쓰는 것이 이미 정상이라 manifest 불일치는 운영에 영향 없음.

### 3) Spring Boot 소스 코드의 코멘트 / 메시지
- `modules/resonance-builder/carbonet-builder-observability/.../DataAssetScanProvider.java`: `// CUBRID specific query` 주석, `setSourcePath("CUBRID/" + ownerName)`을 `setSourcePath("POSTGRESQL/" + ownerName)`으로 일관화. 의미 변경 없음.
- `modules/resonance-common/carbonet-common-core/.../AdminEmissionGwpValueService.java`: 사용자 노출 i18n 문자열에서 `CUBRID` 단어를 `PostgreSQL`로 변경.
- `modules/resonance-common/carbonet-common-core/.../AdminSystemManagementController.java`: `/admin/system/.../db-status`, `db-tables`, `db-query` 엔드포인트는 **현재 살아 있는 URL이므로 동작은 유지**. 다만 내부 메시지/태그(`port=33000`)는 PG 값(`5432`)으로, 로깅 메시지는 `PostgreSQL`로 변경.

### 4) `apps/project-runtime/src/main/resources/application.yml`
- `spring.datasource.driver-class-name`, `url`(dialect까지) → PostgreSQL로. k8s env로 override 받더라도 기본값이 진실에 부합해야 함. `jpa.database-platform`: `PostgreSQLDialect`.
- `release/config/application-prod.yml`은 이미 PostgreSQL 가정. 손대지 않음.

### 5) `AGENTS.md`
- "CUBRID broker check/repair" 항목, `ensure CUBRID StatefulSet cubrid-carbonet is ready` 문구는 **삭제하지 않고** 본문 한글자 한 행으로 표현만 PG 진실로 갱신 — startup rule과 충돌 시 중단 위험이 있어 보수.
- 단, **상위 rule 섹션** (`Resonance 켜줘` → `bash ops/scripts/resonance-up.sh`) 의 동작 설명에서 CUBRID 언급이 있으면 **그 줄만 PostgreSQL로 바뀐 동작이라는 사실 반영**.

### 6) `db/migrations/flyway/`, `db/changelog/liquibase/`
- 삭제 안함. 더미 컬럼 채워진 V1 파일은 그대로 두되 `db/migrations/flyway/README.md`(없으면 신규 1개) 및 `db/changelog/liquibase/README.md`에 "exported artifact, not applied at runtime" 라는 헤더 3줄만 추가. 단, 이 두 파일은 신규 문서 추가이므로 사용자가 "신규 문서 만들지 말라"고 하면 **이번 그룹은 out-of-scope**.

## 명시적 Out-of-Scope

- **데이터 이관 / 스키마 비교**: 사용자가 명시적으로 조회만 모드라고 했고, Patroni 데이터가 이미 정상 운영 중이므로 새로 손대지 않음.
- **Spring Boot Flyway/Liquibase 새 의존성 도입**: 현재 부재한 상태가 의도된 거동(자체 migrate-db.sh). 본 plan은 의존성 변경을 권고하지 않음.
- **CUBRID StatefulSet/PV 실 삭제**: manifest legacy 외 실제 리소스 삭제는 사용자 승인 필요. pending.
- **PostgreSQL HA 토폴로지 재설계 (manifest/source-of-truth 일치)**: 별도 plan `1783151170752-postgres-ha-to-patroni-migration.md`, `1783382782430-patroni-recovery-autoheal-plan.md` 와 overlap되므로 본 plan은 다루지 않음.
- **DB 마이그레이션 도구(Flyway/Liquibase)를 새로 도입할지**: 결정 보류. 별도 follow-up.

## 검증 (read-only, 본 plan은 검증 단계도 mutating 금지)

1. `grep -rn "[Cc]ubrid\|csql\|33000" apps modules ops var/k8s ` → 매니페스트/스크립트 외 코드에 남아 있지 않은지.
2. `kubectl -n carbonet-prod get pod -l app=carbonet-runtime` → Read-only 상태 확인 (구현 에이전트 또는 별도 진단 단계에서).
3. `curl -fsS http://127.0.0.1/actuator/health` → 사용자 환경 안 점검하면 동일 결과.
4. `grep -rn "CUBRID" AGENTS.md .kilo/plans` → 의도적으로 deprecated 마커만 남는지.

## 위험 / 롤백

| 위험 | 영향 | 완화 |
|---|---|---|
| 배포 스크립트가 잘못된 JDBC URL을 만들고 runtime 부팅 실패 | Pod Ready 실패 | 영향 0인 dry-run으로 `kubectl get deploy,pod` 확인 후 진행. 기존 `start-18000.sh`, `start-project-runtime.sh`에는 fallback env (`CUBRID_HOST`가 들어오면 그 값 그대로 쓰는 backward-compat 1-step)를 유지. |
| CUBRID 전용 스크립트 삭제로 인한 회귀 | 사용자 진단 도구 부재 | 삭제 대신 `DEPRECATED: ... exit 1` 헤더만 표시. 원본 보존. |
| 빌드된 이미지 캐싱 | 변동 사항 미반영 | 매니페스트 변경의 경우 `mvn -q -DskipTests package` 후 Docker 재빌드 + containerd import. 호스트 소스 수정 → 빌드 → 배포 순서 강제 (AGENTS.md 컨벤션 준수). |

## Rollout / 마이그레이션 경로

본 plan은 일반 작업처럼 **호스트 소스 수정 → 호스트 빌드(`mvn`/`bash resonance-frontend-auto-build.sh`) → `resonance-k8s-build-deploy-80.sh`로 배포**의 표준 경로를 따른다. 사용자가 "조회만 / 손대지 말라"고 계속 유지 중이므로, **실제 코드/스크립트 변경 적용은 다음 세션(또는 구현 가능한 별도 세션)에서 사용자 명시 지시 시 시작**.

## 다음 단계 (구현 시)

본 구현 session은 **plan 출력에서 종료**합니다. 다음 단계는:

1. 위 그룹 1~4를 차례로 수정. 각 그룹마다 (a) grep로 영향 위치 재확인 → (b) edit → (c) `grep -n "cubrid\|csql" <file>` 회귀 확인.
2. 그룹 5(`AGENTS.md`)와 6(README 헤더 3줄)은 사용자 승인 받으면 진행.
3. 빌드 → 배포 → `/actuator/health` UP 확인.

## 미해결/명시 Out-of-scope 결정

- **CUBRID StatefulSet/PV 실 리소스 삭제 여부** (manifest만 stale, 실제 자원 존재 여부 미확인 — read-only 모드라 kubectl 적용 못 함). 다음 세션에서 `kubectl -n carbonet-prod get statefulset,svc,pvc | grep cubrid`로 확인 후 사용자 결정 받기.
- **Flyway / Liquibase 도입 여부**. 본 plan에서는 부재 상태 유지. 사용자가 yes라고 결정하면 별도 plan.
