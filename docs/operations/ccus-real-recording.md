# 실제 화면 녹화 설계 및 검증 범위

## 1. 발견한 문제
이전 자동 녹화는 실제 업무 URL이 아니라 설계 JSON을 카드 HTML로 변환한 화면을 녹화했다. 단계별 실제 기능을 실행하지 않고 설계 단계 수를 passed로 저장했다. 이 기록은 업무 기능 통과 근거로 사용할 수 없다. 과거 파일은 이력 보존을 위해 삭제하지 않았다.

## 2. 변경
기존 자동 타이머를 중지하고 비활성화했다. 수동 실행 서비스는 /opt/Resonance/ops/scripts/ccus-record-real-pages.cjs를 사용한다. 업무 데이터, 설계 JSON, 기존 프로세스 PASS 원장은 수정하지 않는다.

## 3. 실제 녹화 범위
http://172.16.1.232/home, /home/certificate-verify, /admin을 실제 브라우저로 연다. URL, 최종 URL, HTTP 상태, 제목 표시, 브라우저 오류, 실패 응답, 시작/종료 시각, 동영상 SHA256을 기록한다. 화면별 PNG와 WebM을 저장한다.

## 4. 결과 판정
RENDER_CAPTURED는 화면 렌더링 기록만 의미한다. 기능 테스트는 NOT_EXECUTED, 프로세스는 NOT_VERIFIED로 명시한다. 관리자 화면은 로그인 세션이 없는 자동 브라우저이므로 AUTHENTICATED_VALIDATION_REQUIRED로 기록한다. 로그인 화면이나 관리자 외형만 보고 인증 성공을 추정하지 않는다.

## 5. 상태 제공
public/qa/process-preview-recorder-status.json은 실제 실행 상태를 원자적으로 저장한다. 업무 길잡이는 이 JSON을 읽는다. PARTIAL은 미완료 상태이며 정상 PASS로 바꾸지 않는다. 예외는 FAIL로 노출한다. 현재 자동 주기 실행은 사용하지 않는다.

## 6. 추가 검증 필요
사용자가 로그인한 브라우저에서 대상 프로세스 및 시험 데이터를 확정하고 단계별 입력, 저장, API 결과, 재조회, 다음 액터 인계까지 검증해야 업무 PASS가 가능하다. PDF 발급과 원본 업로드 진위검증은 별도 테스트다. 인증 세션을 추출하거나 임의로 실제 업무를 승인하지 않는다.

## 7. 실행 및 증거
수동 실행: sudo systemctl start carbonet-process-preview-recorder.service
증거: /opt/Resonance/runtime/recordings/<실행시각>/receipt.json 및 화면별 screen.png, WebM.
검수 시 동영상 시작/종료 프레임과 스크린샷을 실제 URL 및 제목과 대조한다. 과거 설계 카드 영상과 섞지 않는다.
