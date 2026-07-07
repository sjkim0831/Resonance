# No-Build Backend Development Guide v3

## 개요

Resonance v3.0부터 백엔드의 대부분의 로직을 **무빌드/무배포**로 수정할 수 있습니다.

## 지원 영역

| 구분 | 무빌드 가능 | 변경 방식 |
|------|:----------:|----------|
| Frontend/UI | ✅ | HostPath Overlay |
| Static Assets | ✅ | HostPath Overlay |
| Metadata | ✅ | HostPath Overlay |
| Menu/Query/Validation | ✅ | Groovy Script |
| **보안/인증** | ✅ | YAML 설정 |
| **DB Schema Interpretation** | ✅ | YAML 메타데이터 |
| **비즈니스 로직** | ✅ | Groovy Script |
| **데이터 처리** | ✅ | Groovy Script |
| Java 클래스 추가/삭제 | ❌ | 빌드 필요 |
| DB DDL 직접 변경 | ❌ | Flyway/Liquibase 필요 |

## 디렉토리 구조

```
projects/carbonet-backend-metadata/
├── security/
│   ├── security-rules.yaml        # 보안 규칙 (경로 인가, CORS 등)
│   └── role-permission-mapping.yaml  # 역할별 권한 매핑
├── schema/
│   ├── table-metadata.yaml        # 테이블 구조 정의
│   ├── query-templates.yaml       # SQL 템플릿
│   └── db-changes.yaml            # 변경 이력
└── scripts/
    ├── menu-renderer.groovy       # 메뉴 렌더링
    ├── query-builder.groovy       # Query 빌더
    ├── validation-rules.groovy    # 검증 규칙
    ├── business-rules.groovy      # 비즈니스 로직
    └── data-processing.groovy      # 데이터 처리
```

## 보안/인증 무빌드

### security-rules.yaml

```yaml
publicPaths:
  - pattern: "/api/public/**"
    method: ANY
    
adminPaths:
  - pattern: "/admin/**"
    roles: ["ROLE_ADMIN"]
    
userPaths:
  - pattern: "/api/user/**"
    roles: ["ROLE_USER", "ROLE_ADMIN"]
```

### role-permission-mapping.yaml

```yaml
roleMenuPermissions:
  ROLE_ADMIN:
    menus: ["MENU_ADMIN", "MENU_SYSTEM"]
    screens: ["admin-home", "user-management"]
```

**수정 후 즉시 적용** (WatchService 자동 감지)

## DB Schema 무빌드

### table-metadata.yaml

```yaml
tables:
  users:
    physical:
      tableName: "users"
      columns:
        - name: "user_id"
          type: "VARCHAR"
          length: 50
```

### query-templates.yaml

```yaml
screenQueries:
  userList:
    query: |
      SELECT * FROM users
      WHERE 1=1 {searchCondition}
```

## 비즈니스 로직 스크립트

### business-rules.groovy

```groovy
class BusinessRules {
    static Map calculateEmission(Map input) {
        def factor = getEmissionFactor(input.emissionType, input.country)
        return [result: input.amount * factor]
    }
}
```

### data-processing.groovy

```groovy
class DataProcessing {
    static List<Map> filter(List<Map> data, Map criteria) { ... }
    static Map aggregate(List<Map> data, String groupBy, String sumField) { ... }
}
```

## API 엔드포인트

### 스크립트 관리
```bash
GET  /api/script/list           # 로드된 스크립트 목록
POST /api/script/reload/{name}  # 특정 스크립트 재로드
POST /api/script/reload-all     # 전체 재로드
POST /api/script/test/{name}/{method}  # 테스트
```

### 보안 설정
```bash
GET  /api/security/config       # 현재 보안 설정 조회
POST /api/security/reload       # 설정 재로드
```

### 스키마 메타데이터
```bash
GET  /api/schema/metadata                    # 전체 테이블 메타데이터
GET  /api/schema/metadata/{tableName}        # 특정 테이블 메타데이터
GET  /api/schema/query-template/{name}        # Query 템플릿 조회
GET  /api/schema/changes                      # DB 변경 이력
```

## 빌드가 필요한 경우

| 작업 | 이유 |
|------|------|
| Java 클래스 신규 추가 | JVM 바이트코드 생성 필요 |
| 인터페이스 계약 변경 | 컴파일 시 검증 필요 |
| DB DDL 직접 변경 | 마이그레이션 도구 사용 필요 |
| ORM 엔티티 매핑 | JPA/Hibernate 컴파일 필요 |
| 보안 엔진 핵심 변경 | Spring Security 컴포넌트 의존성 |

## 검증 명령어

```bash
# 스크립트 확인
curl -s http://127.0.0.1:32947/api/script/list

# 보안 설정 확인
curl -s http://127.0.0.1:32947/api/security/config

# 스키마 메타데이터 확인
curl -s http://127.0.0.1:32947/api/schema/metadata
```
