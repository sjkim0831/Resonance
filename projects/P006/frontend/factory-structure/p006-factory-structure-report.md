# P006 Factory Structure Editor

## Fixture

- BUILDING: 1
- WALL: 4 (독립 walls 배열)
- AISLE: 2
- ZONE: 3
- Asset: E001 1개
- 총 구조 객체: 10개

## 저장/복원 계약

`box`, `buildings`, `walls`, `lanes`, `zones`, `doors`, `objects`를 JSON으로 유지한다. 기존 `walls` 없는 blueprint-plan은 `walls=[]`로 역호환한다.

## 편집

BUILDING/WALL/AISLE/ZONE은 선택·이동·크기 변경·이름 변경·복제·삭제를 지원한다. 회전은 WALL의 `rotation`을 포함해 저장한다.

## 검증

- JSON serialization/deserialization: PASS (fixture)
- backward compatibility without `walls`: PASS (default empty array)
- Asset coexistence: PASS (E001 remains in `objects`)
- USDA export: API contract preserved; live export not executed because DB write is prohibited
- browser authenticated E2E: BLOCKED until an existing authenticated session is provided
