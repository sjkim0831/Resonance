# P006 이번 실행 검증

페이지: http://172.16.1.232/projects/P006/assets/coverage666/index.html
계정: public read-only report; no login actor
입력: 고정724 / 연결372 / 미연결352 (MODIFY103 COMPOSE8 NEW_BASE183 WAIT_DATA58).
출력: 신규294 / 총666 / BLOCKED58 / 신규 READY0 / REAL0.
시간: 1112.6초

## 순서별 데이터/형상 검증
1. PASS: 352종 전수 검토 및 고정 724 ID
2. PASS: 수정103+조합8+신규183 =294
3. PASS: 294 USD 단위 원점 재열기 9검사
4. PASS: 19 레이아웃 저장복원 및 겹침0
5. PASS: 666 현재 USD 재열기 및 형상 존재
6. PASS: 58 BLOCKED 유지 및 READY/REAL 승격0
7. PASS: 294 이동식 패키지 복원 및 해시
8. PASS: 19 레이아웃+178 Variant RTX 캡처

## 공개 화면 동작
1. PASS: public URL 724 rows
2. PASS: new 294
3. PASS: phase1 111
4. PASS: phase2 183
5. PASS: linked 666
6. PASS: blocked 58
7. PASS: all 724
8. PASS: ID specific USD and thumbnail / inline selection
9. PASS: BLOCKED no fallback
10. PASS: instrument group68
11. PASS: all catalog and cluster images loaded
12. PASS: resolver666/58 and UNBOUND724
13. PASS: USD ZIP download not HTML
14. PASS: reload and desktop/mobile no overflow
15. PASS: readiness synchronized656/58/10
16. PASS: 178 unique Variant screenshots / 8 contact sheets

## 시각 검수
{
  "scope": "REFERENCE_RENDER_PRESENT_AND_FRAMED_NOT_TYPE_OR_FUNCTION_VERIFICATION",
  "reviewer": "Codex screenshot inspection",
  "contactSheets": [
    "contact-01.png",
    "contact-02.png",
    "contact-03.png",
    "contact-04.png",
    "contact-05.png",
    "contact-06.png",
    "contact-07.png",
    "contact-08.png"
  ],
  "variantsInspected": 178,
  "browserScreens": [
    "browser-overview.png",
    "browser-mobile.png"
  ],
  "changes": [
    "개별 Variant 카메라 거리·화각 수정 후 197장 재렌더링",
    "해시 검증을 Kit 종료 후 수행하여 마지막 PNG 비동기 저장 완료를 확인"
  ],
  "findings": [
    "검수 접촉시트에서 178개 형상 렌더 존재와 프레임 내 배치를 확인",
    "베이스 재사용으로 유사 외형이 존재하며 별도 장비로서의 종류/내부 기구 정확성은 아직 미검증",
    "일부 세부 기구는 단순화된 기준 형상이며 실제 제품·물리 기능 완성 판정에 사용할 수 없음",
    "모듈 장착/작업물 연결 앵커는 참고 위치이며 현장 장착 검증이 아님"
  ],
  "typeVerified": false,
  "functionalVerified": false,
  "physicalVerified": false,
  "readyPromotions": 0,
  "realPromotions": 0
}

## 다음 병목
남은58종은 실제 장비 자료 대기. 연결된 기준 형상의 종류·실측/기준치수·장착/입출력·작동/물리 검증이 다음 병목이며 ASSET_READY/REAL은 별도.

원본 factory-studio 로그인·드래그·스트리밍은 별도 검증 대상. 이 기록은 카탈로그 매핑/기준 USD/정적 보고서 검증이다.