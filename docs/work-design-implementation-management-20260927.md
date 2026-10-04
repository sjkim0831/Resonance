# 업무 설계·구현 통합 관리

작성일: 2026-09-27  
화면: `/admin/system/work-implementation`  
업무 정의 정본: `framework_business_work_type`, `framework_business_process_sequence`, `framework_process_definition`, `framework_process_step`, `framework_process_step_screen_binding`, `framework_screen_resource`

## 화면 구성

한 번 조회한 업무 카탈로그를 네 가지 방식으로 표시한다.

1. 목록: 업무 종류 → 프로세스 → 절차 → 화면 바인딩
2. 업무 흐름: 절차 순서, 담당 역할, 상태 전이, 완료·분기 규칙
3. 화면 지도: 절차에서 실제 연결된 화면·Route·API 및 입출력 계약
4. 변경 비교: 정의 버전과 저장된 Revision 감사 스냅샷 목록

좌측 탐색과 중앙 보기, 우측 절차 상세, 하단 정의 빈 항목을 제공한다. 화살표·Route 바인딩은 실제 실행 성공 증거로 승격하지 않는다.

## 저장과 이력 계약

### 정본 읽기

- `GET /admin/api/system/actor-process/catalog`: 목록과 활성 화면 바인딩
- `GET /admin/api/system/actor-process/process-design?processCode=...`: 선택 프로세스 절차 상세
- `GET /admin/api/system/actor-process/design/professional-graph?...`: 공식 업무흐름 간선이 필요한 화면에서 재사용 가능한 읽기 API

### 계약 Revision 저장

- `PUT /admin/api/system/actor-process/processes/{processCode}/steps/{stepCode}`
- 허용된 저장 필드: `inputContract`, `outputContract`, `completionRule`, `decisionRule`, `revisionReason`, `expectedProcessVersion` 또는 `expectedStructureHash`
- 서버는 기존 Revision 경로에서 프로세스 잠금, 버전/해시 확인, 정의 Snapshot, 프로세스 버전 증가를 수행한다.
- 현재 저장 경로는 `framework_begin_process_design_revision`과 `framework_finalize_process_design_revision`을 호출한다. 개발 DB에서 확인한 공식 Revision 저장소는 `framework_process_design_revision`이다. 존재하지 않는 `framework_process_step_revision_audit`에 대한 별도 INSERT는 사용하지 않는다.
- 화면은 성공 응답 후 카탈로그와 프로세스 설계를 다시 조회한다. 409이면 입력을 보존한다.

### Revision 이력 조회

- 추가한 읽기 API: `GET /admin/api/system/actor-process/processes/{processCode}/revisions?limit=50`
- Controller는 기존 `CurrentUserContextService`와 `systemReportAccessFailure`로 인증 및 시스템 관리자 권한을 확인한다. 비인증은 401, 권한 없는 사용자는 403이다.
- 서비스는 `framework_process_design_revision`의 공식 스냅샷을 `process_code`로 제한해 조회하고 최신 100건 이내에서 인접 스냅샷을 비교하여 변경 필드, 사유, 담당자, 이전·이후 프로세스 버전과 시각을 반환한다.
- 절차 변화는 코드별 `ADDED`·`MODIFIED`·`REMOVED_FROM_SNAPSHOT`으로 구분한다. 스냅샷에 폐기 상태가 저장되지 않았으면 폐기라고 단정하지 않는다.
- SQL은 조회만 한다. 별도 revision 테이블이나 Migration은 추가하지 않는다. 현재 개발 DB에서 이 테이블은 존재하지만, `framework_process_step_revision_audit` 테이블은 확인되지 않아 이 화면은 없는 저장소를 전제로 하지 않는다.
- 입력·출력·완료·판정 계약 수정 이력은 비교할 수 있다. 프로세스/절차 생성·폐기 전체 이력 API는 별도 확인 전 미지원으로 표시한다.

## 설계 필드 저장 범위

| 설계 정보 | 화면 표시/저장 계약 |
|---|---|
| ID·순서·업무/프로세스/절차 이름·상태·버전 | 기존 카탈로그 조회 전용 |
| 입력·출력 계약·완료 규칙·판정 규칙 | 공식 Step Revision PUT 저장 |
| Route·화면·대상·API 계약 | 기존 화면 바인딩 조회 전용 |
| 담당 역할·상태 전이 | 기존 절차 정의 조회 전용 |
| 선행/후속·분기·보완 관계 | 공식 Flow Edge가 제공되는 범위에서 표시; 없는 관계는 추정하지 않음 |
| 변경 사유·수정자·Before/After·버전 | 공식 Revision 감사 응답 조회 전용 |
| 별도 사용자 지정 기능 목록·인수 테스트 편집·권한 편집·메뉴 편집 | 이 화면의 저장 계약에 없음. 로컬 UI만 저장하는 기능을 만들지 않음 |

누락된 저장 기능은 공식 정의 테이블 또는 Revision 계약을 확장하고 권한·감사·동시성 테스트를 추가해야 한다. 현재 구현은 새 정본 JSON이나 Migration을 만들지 않는다.

## 구현 상태 판정 기준

- 설계 확정: 카탈로그/절차 필드 존재 증거가 있을 때 표시
- 구현 확인: 각 바인딩의 `implementationStatus`; 빈 값은 미확인
- 자동 테스트: 현 화면의 자동 테스트 결과만 해당 UI 기능의 근거로 사용
- 실제 업무 흐름: 이 화면에서는 미확인. 실제 업무 브라우저/API 인수 시나리오로 별도 증명
- Revision 변경 뒤 기존 테스트 통과 표시는 자동 유지하지 않으며, 해당 설계 버전에 대한 재검증 필요 상태로 안내한다.

## 자동 테스트

명령:

```powershell
cd projects/carbonet-frontend/source
npm run test:unit -- --run src/features/work-implementation/WorkImplementationPage.test.tsx
npm run typecheck:full
```

Backend 공통 모듈 검증:

```powershell
mvn -f modules/resonance-common/carbonet-common-core/pom.xml -Dtest=ActorProcessGovernanceServiceSecurityTest test
```

테스트는 목록↔흐름 동일 절차, 화면 Route·인계 계약, Revision 이력 표시, 저장 후 재조회, 버전 증가, 409 입력 보존, 잘못된 프로세스코드 이력 조회 거부를 확인한다.

### 실행 결과 (2026-09-27)

- Frontend 관련 Vitest: 43/43 통과 (WorkImplementation, 화면 흐름/병렬 패널, StepContractEditor 포함)
- Frontend TypeScript `npm run typecheck:full`: 통과
- Frontend production build `npm run build`: 통과
- Backend common-core main compile: 726개 소스 컴파일 통과
- Revision API/서비스 JUnit: 6/6 통과 (`javac` 단일 테스트 소스 컴파일 후 Surefire 단일 클래스 실행)
- 전체 common-core `testCompile`: 기존 `HomePageControllerAuthenticationTest`의 누락된 생성자 의존성 때문에 실패. 이 기존 테스트를 수정하거나 assertion을 낮추지 않았다.
- Revision History API 실행본 반영과 인증 관리자 브라우저 E2E는 완료되지 않았다.

Backend 단일 테스트 우회 실행(전체 testCompile의 무관한 오류와 분리):

```bash
cd /opt/Resonance/modules/resonance-common/carbonet-common-core
CP="target/classes:target/test-classes:$(find ~/.m2/repository -type f -name '*.jar' -printf '%p:')"
javac -cp "$CP" -d target/test-classes src/test/java/egovframework/com/platform/governance/ActorProcessRevisionHistoryApiTest.java
mvn -f pom.xml -Dtest=egovframework.com.platform.governance.ActorProcessRevisionHistoryApiTest surefire:test
```

## 작업 범위와 한계

- 업무/절차 정의, Migration, DB 행은 이 작업에서 수정하지 않는다.
- Revision History GET은 읽기 전용이며 기존 시스템 관리자 인증 경로를 따른다.
- API·DB·브라우저 실제 권한 검증은 자동 단위 검증과 분리해 보고한다.
- 기존 자유형 `integrated-design-documents`는 업무 정의 원본으로 사용하지 않는다.
- `/opt/Resonance` Vite가 새 TSX 모듈을 HTTP 200으로 제공하는 것까지 확인했다. 실행 중인 Java JAR는 기존 버전이므로 Revision History GET은 아직 실행본에 반영되지 않았다.
- 개발 DB는 읽기 전용으로 확인했으며 공식 `framework_process_design_revision` 테이블과 Revision 행 10건이 존재했다. DB 행 변경은 0건이다.
- Java 모듈 main compile은 통과했지만 testCompile은 기존 `HomePageControllerAuthenticationTest`의 생성자 인자 불일치로 차단됐다. 이 무관한 기존 테스트를 약화·수정하지 않았다.
- 현재 개발 Source Tree에는 총 35,336개 dirty path가 있다(본 작업 변경 포함, 일부 경로 접근 불가). 전체 Carbonet JAR를 재빌드·재기동하면 본 작업 밖 사용자 변경까지 포함될 수 있으므로 실행본 교체는 보류했다.
- 인증된 관리자 브라우저 세션이 제공되지 않아 실제 관리자 렌더링·브라우저 스크린샷은 `DEFERRED_AUTH`다. 로그인 화면 캡처를 업무 화면 증거로 대체하지 않는다.
