# CCUS·P006 폴더 구조 및 배치 현황

2026-09-08. 이번 배치 약2분. 전체 정리 진행 중이며 완료 아님.

## 현재 물리 배치 원칙

```text
/opt/Resonance/
├─ projects/              CCUS 프런트·공유 자원·설계 메타데이터, P006
├─ apps/                  CCUS 백엔드 및 등록된 관리 앱
├─ modules/               공통 인증·업무·생성기 모듈
├─ ops/, scripts/         운영·빌드·자동화
├─ config/, gradle/       설정·빌드 도구
├─ docs/, tests/          설계·운영 문서·테스트
├─ data/, db/             참조 데이터·스키마·생성 정의(개별 분류 진행 중)
├─ runtime/
│  ├─ postgresql16/       운영 DB
│  ├─ tools/ai/           모델·AI 실행 환경
│  ├─ host-data/
│  │  ├─ postgresql-dev/  개발 DB
│  │  ├─ dev-runtime/     현재 CCUS Java 실행본
│  │  ├─ developer-tools/ Kilo/OpenCode/Neovim/CI 등
│  │  ├─ build-repositories/ 빌드·브라우저 의존성
│  │  ├─ web-viewer-sample/ P006 웹 실행본
│  │  └─ user-local/     공통 Python·Omniverse 혼합 환경
│  └─ platform-data/     현재 참조·구 자동화 혼합, 추가 정리 필요
└─ var/
   ├─ test-evidence/     검증 결과·녹화·복구훈련·배포 실패 자료
   ├─ cache/             개발 도구·빌드 캐시
   ├─ log/, logs/        로그(생산자별 통합 검토 필요)
   └─ ai-runtime/        AI 작업 데이터(미사용 생산자 일부 정리 완료)
```

## 이번 5개 폴더 일괄 이동

|이전 /opt/Resonance 하위|새 위치 /opt/Resonance 하위|파일 수|
|---|---|---:|
|runtime/recordings|var/test-evidence/recordings|35|
|runtime/platform-data/restore-drills|var/test-evidence/restore-drills|4|
|runtime/platform-data/deploy/failure-evidence|var/test-evidence/deploy-failures|308|
|runtime/host-data/developer-cache|var/cache/developer-tools|40|
|runtime/platform-data/cache|var/cache/platform|323|

합계710파일,411,128,242바이트(약392.1MiB). 동일 파일시스템 rename, 기존 위치 호환 링크 유지. 열린 파일과 외부 상대 링크 검사 후 이동. inode/크기/모드 보존 검증. 삭제0건.

## 누적 실제 이동

개발 도구: Kilo 데이터, OpenCode 데이터, Neovim, Kilo CLI, OpenCode CLI, GitHub Actions Runner.
검증 자료: platform-dev-evidence, platform-quality, platform-evidence, platform-test-evidence 및 이번3개.
캐시: 이번2개.
총15개 물리 폴더 이동. 각 기존 경로는 호환 링크로 남음. 구 번역 서비스2개는 별도 승인 후 중지/자동시작 해제 및 로그 약1.22GiB 삭제 완료.

## 안전 및 미완료 범위

CCUS/P006/DB 등 서비스5개 active, 홈 HTTP200 및 페이지 오류0건, 화면 확인. 소스·DB·AI 모델 미변경, 웹앱 재시작/재부팅0회.
전체 최신 빌드, 로그인/PDF 및 P006 전체 E2E는 미완료. 상위 소스 폴더를 일괄 이동하면 Gradle 상대 경로, 생성기 ROOT 계산, 서비스 경로가 깨질 수 있어 유지.
물리 경로 통합과 호환 링크 제거는 별개 작업이다. 폴더 목록에서 기존 링크까지 제거하려면 소비자 경로를 수정하고 실행 검증해야 한다. 임의로 링크를 지워 외형만 간단하게 만들지 않는다.
다음: 통합 이동 이력을 기준으로 이전 경로의 소비자 목록 작성, 빌드·생성기 참조 전환 계획 수립. 아직 모든 파일 위치가 최종 확정된 것은 아님.
