# GraalVM + AI Builder 전환 계획

## 목적
- Backend를 GraalVM Native Image로 전환하여 빌드/배포 간소화
- AI Agent를 완전한 빌더로 발전시켜 코드 生成 자동화

## 현재 상태

### Backend 스택
| 컴포넌트 | 현재 | 문제점 |
|---------|------|--------|
| Framework | Spring Boot 3.4.5 | JVM 시작 30~60s |
| 빌드 | Maven | 빌드 시간 김 |
| 배포 | Docker + K8s | 2단계 배포 |
| 리플렉션 | `Class.forName` 사용 | GraalVM 문제 |

### AI Builder 현황
| 기능 | 상태 | 비고 |
|------|------|------|
| 코드 生成 | `generator.py` | JSON 출력, 저장 안함 |
| 페이지 生成 | `page.py` | React TSX, 파일 저장 미구현 |
| 어댑터 生成 | `generator.py` | 제한적 |
| 메타데이터 | 미구현 | SDUI만 존재 |

### GraalVM 호환성 문제

**Critical Issue (1건):**
```java
// CarbonetScreenBuilderCommandPageSourceImpl.java:21
Class<?> serviceType = Class.forName("egovframework.com.platform.codex.service.ScreenCommandCenterService");
```

**Medium Issues:**
- `ToStringBuilder.reflectionToString()` - Apache Commons Lang
- Lombok (어노테이션 프로세싱)

## Phase 1: GraalVM 전환

### 1.1 문제점 분석 및 분류

| 구분 | 파일 | 패턴 |GraalVM 호환 |
|------|------|------|-------------|
| Critical | `CarbonetScreenBuilderCommandPageSourceImpl` | `Class.forName` | ❌ 수동 Bean 주입으로 교체 |
| Medium | `ComDefaultVO` | `reflectionToString` | ⚠️ `toString()` 오버라이드 |
| Low | Lombok | 어노테이션 | ✅ 설정으로 해결 |

### 1.2 리플렉션 제거

**Before:**
```java
@Component
public class CarbonetScreenBuilderCommandPageSourceImpl {
    @Override
    public Map<String, Object> getScreenCommandPage(String pageId) throws Exception {
        Class<?> serviceType = Class.forName("...ScreenCommandCenterService");
        Object service = applicationContext.getBean(serviceType);
        Method method = serviceType.getMethod("getScreenCommandPage", String.class);
        return (Map<String, Object>) method.invoke(service, pageId);
    }
}
```

**After:**
```java
@Component
public class CarbonetScreenBuilderCommandPageSourceImpl {
    private final ScreenCommandCenterService screenCommandCenterService;

    public CarbonetScreenBuilderCommandPageSourceImpl(
            ScreenCommandCenterService screenCommandCenterService) {
        this.screenCommandCenterService = screenCommandCenterService;
    }

    @Override
    public Map<String, Object> getScreenCommandPage(String pageId) {
        return screenCommandCenterService.getScreenCommandPage(pageId);
    }
}
```

### 1.3 Native Image 빌드 설정

**Quarkus vs Spring Native:**
```
Spring Boot → Quarkus가 GraalVM 친화적
Spring Native는 아직 프로덕션 Maturity 낮음

권장: Phase 2에서 Quarkus로 마이그레이션
단기: Spring Native로 실험
```

**pom.xml 추가:**
```xml
<plugin>
    <groupId>org.graalvm.nativeimage</groupId>
    <artifactId>native-maven-plugin</artifactId>
    <version>24.0.0</version>
</plugin>
```

### 1.4 검증 단계

```bash
# 빌드 테스트
./mvnw native:compile -Pnative

# 실행 테스트
./target/project-runtime

# Cold Start 측정 (목표: < 2초)
```

---

## Phase 2: AI Builder 완전 자동화

### 2.1 현재 AI Builder 문제점

| 문제 | 위치 | 결과 |
|------|------|------|
| 生成 결과 저장 안함 | `generator.py:123` | 파일 시스템 미반영 |
| 페이지 생성 후 저장 안함 | `page.py:77` | `save()` 미호출 |
| 빌드 자동화 없음 | 전체 | Maven 빌드 manual |

### 2.2 AI Builder 개선 아키텍처

```
[AI Agent] → Natural Language Request
     ↓
[Intent Classification]
     ↓
┌─────────────────────────────────────────┐
│ Metadata 요청?  → SDUI Generator        │
│                  → resonance-no-build-apply.sh
├─────────────────────────────────────────┤
│ 코드 요청?      → Code Generator        │
│                  → AI 코드 生成          │
│                  → 파일 저장             │
│                  → Maven 빌드 트리거     │
├─────────────────────────────────────────┤
│ 리팩토링 요청?  → AI 코드 수정           │
│                  → git commit + push    │
└─────────────────────────────────────────┘
```

### 2.3 구현할 파일 변경

**1. generator.py - save() 자동 호출:**
```python
def generate(self, type: str, context: Dict[str, Any]) -> List[GeneratedCode]:
    results = self._generate_and_parse(type, context)
    for code in results:
        self.save(code)  # 자동 저장
    return results
```

**2. 빌드 트리거 통합:**
```python
def build_and_deploy(self, project: str) -> bool:
    """생성된 코드 빌드 + 배포"""
    # 1. git add + commit
    # 2. Maven 빌드
    # 3. Docker 이미지 빌드 (선택)
    # 4. K8s rolling update (선택)
```

**3. page.py - SDUI + 소스 코드 동시 생성:**
```python
def generate(self, project: str, page_name: str, ...) -> Optional[GeneratedPage]:
    # 1. AI가 React 소스 코드를 生成
    source = self.client.call(prompt_for_source)
    
    # 2. AI가 SDUI 메타데이터를 生成
    metadata = self.client.call(prompt_for_metadata)
    
    # 3. 두 가지 모두 저장
    self.save_source(project, source)
    self.save_metadata(project, metadata)
```

---

## Phase 3: 완전한 No-Build/No-Deploy

### 3.1 목표 상태

```
AI Agent "신규 페이지 만들어줘" 
  → AI가 SDUI metadata 生成
  → resonance-no-build-apply.sh 실행
  → 페이지 즉시 표시 (빌드 불필요)

AI Agent "새 API 만들어줘"
  → AI가 Java 코드 生成
  → GraalVM Native 빌드
  → 단일 바이너리 교체 (재시작 1초)
```

### 3.2 Native Image 배포 최적화

| 현재 | 목표 |
|------|------|
| Docker Layer + K8s Manifest | 단일 바이너리 |
| Rolling Update 30s | 교체 1s |
| 메모리 512MB | 64~128MB |

### 3.3 배포 스크립트 변경

```bash
# 현재: 2단계
mvn package && docker build && k8s rollout

# 목표: 1단계 (GraalVM)
./mvnw native:compile && ./target/project-runtime
```

---

## 결정 사항 (확인 필요)

### Q1: Quarkus vs Spring Native

**Options:**
1. **Spring Native** - 현재 코드 변경 최소화, 하지만 Maturity 낮음
2. **Quarkus 전환** - GraalVM 최적화, 하지만 코드 대규모 변경

**권장:** Phase 1에서는 Spring Native로 실험. Phase 2에서 Quarkus 고려.

### Q2: 빌드 자동화 수준

**Options:**
1. **완전 자동** - AI 생성 → 자동 빌드 → 자동 배포
2. **반자동** - AI 생성 → 빌드는 수동 (ai-builder에서 트리거)

**권장:** 처음에는 반자동. 안정화 후 완전 자동.

### Q3: CUBRID 데이터베이스

GraalVM Native Image와 CUBRID 호환성 확인 필요.

---

## 작업 순서

1. **Critical 리플렉션 제거** (CarbonetScreenBuilderCommandPageSourceImpl)
2. **Spring Native 빌드 설정 추가**
3. **generator.py/build 트리거 추가**
4. **page.py 저장 로직 수정**
5. **Native Image 빌드 테스트**
6. **Cold Start 벤치마크**

---

## 검증 방법

```bash
# 1. 빌드 시간
time ./mvnw native:compile -Pnative

# 2. Cold Start
./target/project-runtime & sleep 2 && curl localhost:8080/actuator/health

# 3. AI Builder 테스트
cd /opt/Resonance && python -c "
from ai-builder.builder.generator import CodeGenerator
g = CodeGenerator()
results = g.generate_module('test', 'User', ['create', 'read'])
print(f'Generated {len(results)} files')
"
```