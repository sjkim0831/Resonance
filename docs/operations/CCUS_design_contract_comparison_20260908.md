# 611개 과거·현재 설계 일괄 비교

2026-09-08. 약 2분. 삭제 0건, 서비스 변경 0회.

과거: /opt/Resonance/runtime/platform-data/control-plane/source/projects/carbonet-backend-metadata/process-runtime/design-preview
현재: /opt/Resonance/projects/carbonet-backend-metadata/process-runtime/design-preview

## 결과

611개 JSON 전체를 파싱해 재귀 비교. 558파일에서 핵심 영역의 구조 또는 값 차이 발견. 나머지 53개도 다른 영역 차이가 있으므로 동일 파일이 아님. 배열은 전체 값으로 비교함.

|변경 필드|파일 수|
|---|---:|
|업무 요구사항 step.business.requirement|69|
|단계 순서 step.transition.stepOrder|23|
|단계 이름 step.business.stepName|18|
|업무 완료 조건 step.business.completionRule|25|
|전이 완료 조건 step.transition.completionRule|31|
|목적 상태 step.transition.toState|5|
|시작 상태 step.transition.fromState|3|
|명령 코드 step.transition.commandCode|4|
|테스트 정의 tests|490|
|테스트 실행 기록 testExecution|550|

각 집계는 중복되므로 합산 불가. 권한 정책, 스키마 버전 등 558개에 반복되는 변경에는 구조 표준화가 섞여 있음. 558개 모두 업무 기능이 바뀌었다는 뜻이 아님. 반면 요구사항·단계 순서·상태 값 차이는 단순 해시/시각 차이로 취급할 수 없음.

## 판단

현재가 정확하고 과거가 불필요하다는 판단은 파일 비교만으로 불가. 과거 파일 일괄 삭제는 보류. 예전 사용자 요청과 현재 실행 기능을 연결해 순서 및 완료 조건의 의도된 변경 여부를 검증해야 함. 자동 복원도 하지 않음.

## 산출물

files.csv: 전체 611개 파일의 프로세스 코드, 변경 경로 수, 비교 영역.
details.json: 파일별 변경 JSON 경로 전체.
summary.json: 영역별 및 세부 업무/전이 필드 집계.

이번은 읽기 전용 설계 비교이며 화면이나 코드 변경 없음. 신규 브라우저 시각 검수 및 로그인/PDF E2E 미실행.
다음 우선순위: 단계 순서 23건과 상태/명령 코드 변경부터 의도된 변경인지 검토.
