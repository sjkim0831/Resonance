# 서버 불필요 파일 정리 결과

삭제 파일: 411개
삭제 논리 용량: 237,695,328 bytes

## 삭제 범위
7일 이상 된 pnpm 캐시, Node 컴파일 캐시, 회전된 runtime 압축 로그 중 열린 파일 참조가 없는 일반 파일만 삭제.
심볼릭 링크는 따라가지 않았으며 삭제 직전 변경 여부를 재확인.

## 보존
/opt/reference, 운영 소스와 DB, 모델, 백업, 복구 설계 자료, 현재 실행 로그 및 사용 여부가 불명확한 registry를 보존.
복구 작업, 서비스 재시작, 실패 상태 초기화 없음.

## 서비스 확인
- carbonet-production-direct: active
- ccus-postgresql-native: active
- carbonet-dev-proxy: active
- resonance-p006-web: active
- resonance-shadow-gemma4-e4b: active

## 한계
서버 전체 정리가 완료된 것은 아님. /tmp의 3.9GB 요청 실행 이력과 /var/lib/registry 3.4GB는 실제 사용 및 보존 정책 확인 필요. 브라우저 E2E 미실행.