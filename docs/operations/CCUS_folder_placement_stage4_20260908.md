# 미확정 폴더 분류 및 CI 도구 위치 정리 4차

2026-09-08, 약 2분. 이동1폴더 약678MiB, 삭제0건, 서비스 재시작0회.

## 실제 이동

기존 /opt/Resonance/runtime/platform-data/github-runner
신규 /opt/Resonance/runtime/host-data/developer-tools/github-actions-runner

GitHub Actions 실행 도구를 서비스 데이터 영역에서 개발/CI 도구 영역으로 분리. 열린 파일 없음 확인 후 동일 파일시스템 rename. 기존 경로는 호환 링크로 유지. 9,333파일의 inode/크기/모드 유지 확인. 등록정보와 인증정보 미열람·미삭제.
기존 Actions 서비스 설정에서 이전 경로 참조 발견. 링크로 호환성을 유지했으며 CI 작업 실행이나 서비스 시작은 하지 않음. CI 전체 기능 확인은 미완료.

## 추가 분류

- runtime/platform-data/cache/gradle/java-fast-dev 약148MiB: Gradle 빌드 캐시. 최신 빌드에 연관될 수 있어 단순 잡파일로 삭제하지 않음.
- runtime/host-data/acme 약45MiB: 인증서 갱신 환경 후보. 운영 TLS 연관 확인 전 보존.
- runtime/tools/k9s 약124MiB: 실제 운영 웹 프로세스 포함. 전체 삭제 금지.
- runtime/platform-data/dev-evidence 약129MiB, quality 약65MiB, evidence 약19MiB: 검증 산출물 후보. 최근 결과/생산자/화면 링크를 검토한 뒤 보관 정책 적용.

## 검증과 한계

현재 서비스5개 active, CCUS 홈 HTTP200 및 페이지 오류0건, 스크린샷 확인. 최신 빌드·로그인·PDF·P006·CI 전체 E2E는 미수행.
전체 분류 CSV는 이전 스냅샷이므로 이번 이동의 실제 위치는 본 문서의 변경 목록을 우선함. 최종 통합 인벤토리 갱신 필요.
현재 소스/DB/AI 모델 미변경. 위치 정돈일 뿐 디스크 절감 아님. 다음은 검증 산출물 폴더의 생산자와 최신 결과 참조 확인.
