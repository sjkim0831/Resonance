# 실제 녹화 및 진위검증 추가 결과

검증 시각: 2026-09-06 15:55:35~15:55:51 KST. 자동 실행 15.588초.

## 수정 사항
진위확인 설계 조회 API의 500 원인은 CertificateVerificationScreenDesignRegistry에 설계 파일 경로 환경변수가 없었기 때문이다. 기존 /opt/Resonance/config/certificate-verification/certificate-verification-screen.json을 연결하는 systemd drop-in을 추가하고 백엔드를 1회 재시작했다. DB 및 인증서 원장은 변경하지 않았다. 이후 API는 200, schemaVersion=1, active=true 응답이다.

## 실제 기능 시험
1. 계정: 비로그인 공개 사용자. URL: http://172.16.1.232/home/certificate-verify
2. 입력: 사용자 다운로드 PDF 탄소배출량-리포트-e-케로신-20260906.pdf와 동일 바이트.
3. 입력 SHA256: df3ad9a477f8d87546372da8b99a23f4415a1173a6f3163810cc90c0fb185fd3
4. 동작: 실제 input[type=file] 업로드 → 원본 바이트 일치 문구 대기 → 발급/업로드 SHA256 2개 일치 확인.
5. 결과: EXACT_PDF_MATCH_VERIFIED. 인증서 CRN-20260906-322A3320EF9A. 브라우저 오류 0, 실패 HTTP 응답 0.
6. 증거: 2026-09-06T06-55-35-746Z/certificate-verify/screen.png, WebM 및 receipt.json.

## 사용자 비발디 결과와 대조
비발디에는 사용자가 15:44:44 발급한 인증서의 정상 판정과 15:44:55 다운로드 완료가 표시되었다. 실제 다운로드 파일 해시도 일치한다. 이는 사용자 실행 결과 관찰이며 에이전트가 발급 버튼부터 자동 실행한 결과가 아니다.

## 실패 이력과 정확성 제한
직전 자동 실행은 Chromium의 파일 경로 접근 오류로 업로드 판정을 못 했다. 파일 경로 전달 대신 같은 파일 바이트를 전달하도록 녹화기를 수정한 뒤 재시험했다. 실패 실행 2026-09-06T06-54-15-264Z는 보존한다.
관리자 자동 브라우저는 비로그인 상태여서 401 응답이며 관리자 기능 PASS가 아니다. 홈의 screen-context에도 비로그인 401이 있다. PDF 신규 발급 자동화, 변조 파일, 권한/격리/예외/복구, 액터 릴레이는 이번에 검증하지 않았다. 전체 상태 PARTIAL을 유지한다.

## 복구 및 실행
추가 설정: /etc/systemd/system/carbonet-production-direct.service.d/certificate-screen-design.conf
스크립트: /opt/Resonance/ops/scripts/ccus-record-real-pages.cjs
서비스: carbonet-process-preview-recorder.service (수동 실행), 타이머 disabled.
VERIFY_PDF에 로컬 시험 PDF 경로를 지정하면 업로드 검증을 포함한다. 미지정 시 렌더링 녹화만 수행한다. 기존 설계 카드 녹화기는 다시 실행하지 않는다.

원씽: 실제 증거에 한해서만 통과 판정을 남긴다. 다음 검증은 지정된 시험 계정과 데이터로 관리자 PDF 신규 발급부터 수행하는 것이다.
