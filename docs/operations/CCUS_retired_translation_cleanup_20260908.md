# 구 번역 서비스 중지 및 로그 정리

2026-09-08, 약 1분. 사용자가 승인한 서비스 2개와 로그 2개만 처리.

## 조치

1. resonance-ecoinvent-shadow-translation.service 중지 및 자동 시작 해제.
2. resonance-ecoinvent-product-translation.service 중지 및 자동 시작 해제.
3. /opt/Resonance/var/ai-runtime/ecoinvent-shadow-translation-events.jsonl 삭제: 1,161,878,482바이트.
4. /opt/Resonance/var/ai-runtime/ecoinvent-product-ko-translation-events.jsonl 삭제: 143,546,320바이트.

합계 1,305,424,802바이트(약1.216GiB), 할당량1,306,013,696바이트 제거.
원인 확인: 제품 번역 서비스 journal에서 kubectl FileNotFoundError 확인. 삭제된 구 컨테이너 명령을 사용하는 서비스가 반복 재시작하고 있었음. shadow 서비스도 반복 실패 상태였으나 동일 예외 원인까지 별도 확정하지는 않았음.

## 안전 확인

두 서비스 inactive 확인 후 정확한 로그 경로·일반 파일·단일 하드링크·열린 파일 없음 확인. 삭제 직전 inode/크기/수정 시각 재검증. systemctl disable로 등록 링크와 자동 시작 링크 제거. 스크립트와 보관된 서비스 정의는 삭제하지 않음.
현재 CCUS 백엔드/프런트, PostgreSQL, P006 웹, Omniverse 웹 서비스 5개 active.
홈 HTTP200, 제목 CCUS 탄소중립 플랫폼, 페이지 오류0건. 스크린샷 확인. 로그인/PDF/P006 전체 E2E 미실행.
DB 내용, 번역된 기존 데이터, AI 모델, 웹앱 소스 미변경. 웹앱 재시작 및 서버 재부팅0회. 앞으로 해당 구 서비스의 자동 번역 작업은 실행되지 않음.

## 재발 방지 및 한계

서비스를 다시 설치/시작하지 않는 한 이 두 생산자의 반복 로그 생성을 차단한 상태. 외부 스크립트가 다시 등록하는 모든 경우까지 방지한 것은 아님. 현재 데이터베이스에 맞춘 번역 기능 재구축은 별도 작업.
