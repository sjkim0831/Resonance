# Builder 8-Layer Architecture

## Overview

8 계층 아키텍처로 1,000+ 화면을 자동 생성하는 시스템. 설계 → 파싱 → 검증 → 템플릿 → 컴포지션 → 생성 →导出 → 모니터링

## Layer Structure

```
L01_design/     - 계약 정의 추출 (DB → Python objects)
L02_parse/      - 계약 파싱 및 정규화
L03_validate/   - 계약 무결성 검증
L04_template/   - 기본 React 템플릿 생성
L05_compose/    - 화면 컴포넌트 작성
L06_generate/   - 화면 파일 생성 (디스크)
L07_export/     - 라우트 및 카탈로그 생성
L08_watch/      - 설계 변경 감지
```

## Layer Details

### L01: Design Extraction (설계 추출)
- PostgreSQL에서 계약 정의 추출
- `framework_professional_screen_contract` 테이블
- `row_to_json()` 사용 (한국어 텍스트 안전 처리)

**입력**: DB
**출력**: `List[ScreenContract]`

### L02: Parse & Normalize (파싱 및 정규화)
- 계약 데이터 파싱
- 화면 이름 정규화 (특수문자 제거)
- API 경로 정규화 (`/` 접두사 보장)
- 필드 코드 정규화

**입력**: `List[ScreenContract]` (L01)
**출력**: `List[ScreenContract]` (정규화됨)

### L03: Validation (검증)
- 계약 무결성 검사
- 중복 경로 감지
- 필드 타입 검증 (21가지 지원)
- 선택 필드에 옵션 존재 여부 검사

**입력**: `List[ScreenContract]` (L02)
**출력**: `List[ScreenContract]` (검증됨)

### L04: Template Generation (템플릿 생성)
다음 파일들을 생성:
- `types.ts` - TypeScript 타입 정의
- `hooks.ts` - React Hooks (useScreenState, useFormState, useApi)
- `utils.ts` - 유틸리티 함수 (검증, 포맷)
- `FieldFactory.tsx` - 21가지 필드 타입 렌더러
- `SectionComponents.tsx` - CardSection, StatusChip, TableSection
- `FormComponents.tsx` - AutoForm, FormArray
- `api_client.ts` - Axios API 클라이언트
- `screen_registry.ts` - 화면 레지스트리

**입력**: `List[ScreenContract]` (L03)
**출력**: `Dict[str, str]` (템플릿 파일들)

### L05: Screen Composition (화면 작성)
- 계약에서 React 컴포넌트 코드 생성
- import문, state, form fields, render 메서드 생성
- 각 계약에 대해 독립적인 화면 컴포넌트 생성

**입력**: `List[ScreenContract]` (L04)
**출력**: `Dict[int, str]` (contract_id → component_code)

### L06: Screen Generation (화면 생성)
- 컴포넌트 코드를 .tsx 파일로 저장
- 변경 감지를 위한 체크섬 추적
- 파일 해시 비교를 통한增量更新
- `index.tsx` 생성 (모든 화면 export)

**입력**: `Dict[int, str]` (L05)
**출력**: `Dict[str, str]` (화면 파일 경로)

### L07: Export (내보내기)
- `routes.tsx` - React Router 설정
- `catalog.json` - 화면 카탈로그 (메타데이터)
- `navigation.json` - 프로세스별 화면 그룹화

**입력**: `List[ScreenContract]`
**출력**: 라우트, 카탈로그, 내비게이션 파일

### L08: Watch (모니터링)
- 설계 변경 감지
- 파일 해시 기반 차이점 분석
- 변경 이력 추적
- 재생성 필요성 판단

**입력**: 이전 상태
**출력**: 변경 목록

## Error Recovery (오류 복구)

### Checkpoint System
각 레이어 완료 후 체크포인트 저장:
```
.checkpoints/
  layer_01.json  # L01 완료 후
  layer_02.json  # L02 완료 후
  ...
  history.json   # 전체 이력
```

### Recovery Options (오류 발생 시)
1. **Skip** - 이 레이어 건너뛰고 계속
2. **Retry** - 이 레이어 재시도
3. **Reset** - 이 레이어부터 재시작

### Change Detection (변경 감지)
- 파일 해시 비교를 통한 변경 감지
- 설계 레이어 (L01-L03) 변경 시 재생성

## Supported Field Types (지원 필드 타입)

| Type | Description |
|------|-------------|
| TEXT | 일반 텍스트 입력 |
| NUMBER | 숫자 입력 |
| DATE | 날짜 선택 |
| DATETIME | 날짜/시간 선택 |
| SELECT | 드롭다운 선택 |
| CHECKBOX | 체크박스 |
| SWITCH | 토글 스위치 |
| RADIO | 라디오 버튼 |
| AUTOCOMPLETE | 자동완성 |
| SLIDER | 슬라이더 |
| FILE | 파일 업로드 |
| IMAGE | 이미지 업로드 |
| EMAIL | 이메일 입력 |
| PASSWORD | 비밀번호 (표시/숨기기) |
| PHONE | 전화번호 (010-0000-0000 형식) |
| TEXTAREA | 다중 행 텍스트 |
| CODE | 코드 에디터 |
| ENUM | 열거형 |
| HIDDEN | 숨김 필드 |
| CALCULATED | 계산된 값 (읽기 전용) |
| ADDRESS | 주소 입력 |

## Usage

```bash
# 전체 파이프라인 실행
python3 master_orchestrator.py

# 강제 재시작
python3 master_orchestrator.py --force

# 특정 레이어부터 재시작
python3 master_orchestrator.py --from 5

# 체크포인트 리셋
python3 master_orchestrator.py --reset

# 상태 확인
python3 master_orchestrator.py --status
```

## Output Structure

```
/tmp/builder_output/
  01_design/          # 계약 추출 결과
  02_parse/           # 파싱 결과
  03_validate/        # 검증 결과
  04_template/        # 생성된 템플릿
  05_compose/         # 컴포지션 결과
  06_generate/screens/ # 생성된 화면들
  07_export/          # 라우트, 카탈로그, 내비게이션
  .checkpoints/       # 체크포인트
  pipeline_summary.json
```

## Key Design Decisions

1. **Absolute Imports**: 모든 Python 모듈이 `builder.` 접두사 사용
2. **String Concatenation**: f-string 대신 문자열 연결 사용 (JSX 생성 시)
3. **Checkpoint-based Recovery**: 각 레이어 완료 후 체크포인트 저장
4. **Checksum-based Change Detection**: 파일 변경 감지를 위한 해시 추적
5. **21 Field Types**: 필드工厂 supports all 21 field types

## Validation Rules

- 경로: `/`로 시작해야 함
- 중복 경로: 동일 경로 여러 번 생성 불가
- 필드 타입: 지원되는 타입만 허용
- 선택 필드: 옵션 배열 필요
- 필수 필드: required 플래그 확인

## Error Handling

각 레이어에서:
- 성공 시 체크포인트 저장
- 실패 시 오류 로깅
- 오류 상세 정보 (contract_id, error_type)
- 복구 옵션 제공

## Performance

- 1,000+ 화면 생성 지원
- 변경 감지를 통한增量更新
- 병렬 처리 가능하도록 설계
- 체크포인트로 실패 시 복구 시간 단축
