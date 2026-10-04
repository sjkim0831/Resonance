# CCUS 접근 이력 회사 목록 조회 개선

## 작업 범위

2026-09-08 약 3분 작업. CCUS 운영에서 회사 선택 목록과 회사명 맵을 만드는 2곳만 변경했다. DB·로그 삭제 0건, 백엔드 재시작 1회 5초. 프런트엔드 전체 빌드는 하지 않았다.

## 설계와 구현

소스: /opt/Resonance/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/observability/service/AdminAccessHistoryPageService.java

- buildAccessHistoryCompanyOptions: searchRecent(...,1,500).getItems() → readRecentMatching(...,500).
- buildAccessHistoryCompanyNameMap: 같은 변경.
- 최신 500건, 역시간 순서, 회사명 처리와 권한 범위는 그대로다.
- 전체 건수가 필요한 검색·페이징 searchRecent 호출은 유지한다. 전체 이력 화면의 모든 조회가 개선되었다는 의미는 아니다.
- tail 조회는 기존 FileRequestExecutionLogService의 64KiB 블록 역방향 읽기를 재사용한다.
- 실제 runtime/host-data/dev-runtime/certificate-verification/backend/runtime/BOOT-INF/lib/carbonet-common-core-1.0.0.jar의 대상 클래스 1개와 정식 소스만 갱신했다.

## 검증 결과

1. 격리 파일 30,000개 정상 기록과 잘못된 JSON·빈 줄을 함께 생성했다. 한글 경로를 포함한다.
2. 기존 전체 스캔과 새 tail 조회의 최신 500건을 JSON으로 비교: 내용과 순서 동일.
3. 읽기량: 33,311,504 bytes → 589,824 bytes, 약 98.2% 감소.
4. 적용 후 재검증 시간: 전체 186ms, tail 11ms. 단일 테스트 실행값이며 서비스 전체의 성능 보장은 아니다.
5. 일치 기록 없는 필터: 빈 결과 확인.
6. 회사 목록·회사명 맵 두 메서드가 tail 조회를 호출하고 전체 검색을 호출하지 않는지 mock으로 검증.
7. 실제 운영 3,877,161,260 bytes 파일에서 최신 500건 파싱 성공: 393,216 bytes 읽기, 4ms. 운영 파일 전체 스캔은 부하 방지를 위해 실행하지 않았다.

자동 검증 출력 PASS 5개. 테스트는 합성 데이터/운영 파일 읽기 전용이며 실제 관리자 계정의 브라우저 E2E가 아니다.

재실행: bash /opt/Resonance/ops/tests/event-reliability/run-access-tail.sh

실제 파일 읽기 검증: 위 명령 뒤에 /tmp/carbonet-request-execution-history.jsonl 추가.

## 시각 검수

http://172.16.1.232/home HTTP 200, pageerror 0. 캡처를 열어 헤더·검색 아이콘·업무 길잡이·화면 설계·QA·도움말 버튼 표시를 확인했다. 관리자 접근 이력 화면 인증 후 검수는 미수행이다.

![적용 후 홈](CCUS_access_tail_home_20260908.png)

## 안전 및 다음 작업

기존 로그·보존 기간·DB·업무 안내 문구·권한은 변경하지 않았다. 공통 기술 설계는 이 문서에 기록하며 업무 카드에 관련 없는 안내를 추가하지 않았다.

원씽: 총계가 필요 없는 조회에서만 전체 스캔을 제거한다.
다음: 녹화 감사 API의 과거 500 응답이 현재도 재현되는지 확인하고 실제 원인을 진단한다. 로그를 숨기거나 삭제해서 오류를 없앤 것으로 처리하지 않는다.
