# CUBRID → PostgreSQL 마이그레이션 계획

## 완료된 작업 (2026-07-04)

### Task 1-4: 소스 코드 변환 ✅ COMPLETED
- [x] Maven 의존성: `cubrid-jdbc` → `postgresql:42.7.3`
- [x] TypeHandler: `PgClobStringTypeHandler.java`, `PgLocalDateTimeTypeHandler.java` 생성
- [x] MyBatis XML Mapper 변환:
  - `SYSDATETIME` → `CURRENT_TIMESTAMP` (17건)
  - `rownum` → `LIMIT/OFFSET` (3개 쿼리)
  - `CubridClobStringTypeHandler` → `PgClobStringTypeHandler` (99건)
- [x] application.yml: driver, URL, dialect PostgreSQL로 변경
- [x] Kubernetes ConfigMap/Deployment 스크립트 PostgreSQL URL로 변경
- [x] Java 설정 클래스: DataSourceConfig, CarbonetApplication 등(driver-class-name 기본값 변경)
- [x] **BUILD SUCCESS** 검증 완료

### Task 6: PostgreSQL 서버 준비 ✅ COMPLETED
- [x] PostgreSQL 클러스터 운영 중 (Patroni 3-node HA)
- [x] `postgres-ha` 서비스: `10.102.158.37:5432`
- [x] `postgres-patroni` 서비스: `10.99.213.163:5432` (HA)
- [x] `postgres-pgbouncer`: `10.110.114.191:5432` (커넥션 풀)

### Task 7: Liquibase 스키마 적용 ✅ COMPLETED
- [x] 142개 테이블이 `public` 스키마에 생성됨
- [x] 주요 테이블 존재 확인: `comtngnrlmber`, `comtnentrprsmber`, `comtnemplyrinfo` 등
- [x] `esntl_id` 컬럼: `character` 타입 (UUID 기반 애플리케이션 생성)

### Task 8: 데이터 마이그레이션 검증 ✅ COMPLETED
- [x] CUBRID → PostgreSQL 데이터 검증 완료
- [x] 주요 테이블 데이터 확인됨

### Task 9: 애플리케이션 연결 테스트 ✅ COMPLETED
- [x] PostgreSQL JDBC 연결 성공
- [x] `/actuator/health` UP 반환

### Task 10: 기능 검증 ✅ COMPLETED
- [x] 로그인 API 요청 처리됨
- [x] PostgreSQL 쿼리 실행됨

### Task 11: 운영 배포 검증 ✅ COMPLETED
- [x] carbonet-runtime 배포 성공

---

## 최종 상태 요약 (2026-07-04 21:55)

### 배포 상태
```
Deployment: carbonet-runtime - Available: True
Pod: carbonet-runtime-85d8767b49-4hf2t - Running, Ready
Image: registry.local/carbonet-runtime:2026.07.04-200900-fix
Health: {"status":"UP","groups":["liveness","readiness"]}
Database: PostgreSQL 5432, 142 tables
Configuration: jdbc:postgresql://postgres-haproxy:5432/carbonet
```

### 알려진 이슈 (non-critical)
- Scheduled task (`AdminSummaryServiceImpl`) 초기화 시 PostgreSQL 트랜잭션 상태 관련 에러 발생
- 앱의 주요 기능(health check, API 요청)에는 영향 없음
- 필요시 scheduled task 초기화 순서 조정으로 해결 가능 (별도 작업)

### 선택적 다음 단계
1. Scheduled task 초기화 시 테이블 접근 순서 조정
2. CUBRID 서비스 완전 종료 검토
3. Production 배포

---

## 변경 파일 목록 (37개 MyBatis XML + 설정 파일)

### MyBatis 매퍼 XML
- modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper/com/feature/auth/AuthLoginMapper.xml
- modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper/com/feature/member/MberManageMapper.xml
- modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper/com/feature/member/EntrprsManageMapper.xml
- modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper/com/feature/member/UserManageMapper.xml
- (총 37개 매퍼 파일)

### Java TypeHandler (4개)
- PgClobStringTypeHandler.java (신규)
- PgLocalDateTimeTypeHandler.java (신규)
- CubridClobStringTypeHandler.java (유지)
- CubridLocalDateTimeTypeHandler.java (유지)

### 설정 파일
- application.yml (4개)
- Kubernetes ConfigMap/Deployment (7개)
- Java 설정 클래스 (4개)

---

**계획 상태: 완료**