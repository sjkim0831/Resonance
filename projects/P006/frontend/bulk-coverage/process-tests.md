# P006 USD 공통화 실행·검증 기록

페이지: http://172.16.1.232/projects/P006/assets/bulk-coverage/index.html
계정/액터: public read-only report; no login actor used
입력: 고정 724종 기준선, 미연결 528종, 기존 USD 구성요소.
출력: 연결 372종 / 미연결 352종 / READY 10종 / REAL 0종.
기간: 2026-09-10T03:35:59Z → 2026-09-10T03:57:19.732Z (1280.7초)
배포: 1.45초. 서비스 재시작/PLC 쓰기/실사용 Kit 장면 변경 없음.

## 프로세스 검증 순서

1. PASS — 528개 전수 5단계 재사용 검토
2. PASS — 176개 연결 ID 중복 없음 및 계획 일치
3. PASS — 176개 USD 9개 검사 통과
4. PASS — 17개 레이아웃 저장 복원, AABB 중복 0
5. PASS — 자료 대기 58종 연결 금지
6. PASS — READY 및 REAL 신규 승격 0
7. PASS — 이동식 ZIP 176개 복원
8. PASS — 17개 독립 RTX 렌더 존재
9. PASS — 최종 724 = 연결 372 + 미연결 352

## 공개 화면 검증 순서

1. PASS — public URL renders 724 rows
2. PASS — review filter 528
3. PASS — new filter 176
4. PASS — linked filter 372
5. PASS — design filter 294
6. PASS — blocked filter 58
7. PASS — all filter 724
8. PASS — MODIFY 110 / COMPOSE 66
9. PASS — card selects inline without navigation; ID-specific USD path and limits
10. PASS — BLOCKED has no fallback model
11. PASS — base selects corresponding asset group
12. PASS — 17 RTX images loaded, family preview changes
13. PASS — actual resolver 724 / 372 resolved / 58 blocked / REAL 0
14. PASS — actual USD ZIP download
15. PASS — reload 724 rows / desktop no overflow
16. PASS — 390px mobile no document overflow
17. PASS — previous coverage URL routes to current report
18. PASS — readiness registry synchronized: required352 created362 ready10

## 시각 검수

16개 자산군 RTX 렌더와 데스크톱/모바일 스크린샷을 검토했다. 원통 축·카메라 거리·지지대 3종의 문제를 공통 베이스에서 수정한 뒤 재생성했다. 실물 동등성/기능 완성 판정은 아니다.

## 재발 방지

724종 SHA 고정, 생성 ID 중복 방지, 58종 BLOCKED 연결 거부, READY/REAL 승격 거부, 17개 레이아웃 저장 복원, 원점·단위·재질 참조 검사. 배열/객체 두 형태의 기존 공정 데이터가 화면 전체 로딩을 중단하지 않도록 표시 어댑터를 적용했다.

## 남은 작업

다음 바위: 미연결 수정 103종·조합 8종의 전용 기구/헤드 구조를 전체 비교하여 재사용 가능한 다음 베이스 선정. 신규 베이스 183종은 그 다음, 자료 대기 58종은 BLOCKED 유지.

공장 스튜디오 로그인·드래그·실시간 미리보기는 이번 정적 카탈로그/독립 USD 검증 범위에 포함하지 않았다.
