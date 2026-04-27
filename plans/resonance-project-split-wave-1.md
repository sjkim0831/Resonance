# Resonance Project Split Wave 1

## Goal

폴더 이동과 분리를 “한 번에 전체 이동”이 아니라, 안전한 1차 wave로 진행한다.

## Wave 1 scope

- `Resonance` 워크스페이스 생성
- 공통 문서/카탈로그/매니페스트 분리
- builder/package/common-jar 거버넌스 문서 분리
- Carbonet 빌드는 그대로 유지

## Wave 1 non-goals

- Maven module path 변경
- package rename
- reactor module rename
- frontend route rename

## Deliverables

- `/opt/Resonance/docs/*`
- `/opt/Resonance/catalog/*`
- `/opt/Resonance/manifests/*`
- `/opt/Resonance/plans/*`

## Next wave candidates

- `modules/carbonet-*` 중 reusable 후보 분류
- `projects/carbonet-adapter` 책임 축소
- `projects/carbonet-runtime` package manifest 구체화
