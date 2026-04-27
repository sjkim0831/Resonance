# Resonance First-stage Folder Migration

## Goal

전체 빌드를 깨지 않고 `Resonance` 폴더 구조를 먼저 도입한다.

## Why not move everything now?

- 현재 빌드는 Maven reactor로 이미 구성되어 있다.
- `carbonet` 문자열 참조가 많다.
- 한 번에 이동/치환하면 운영 리스크가 크다.

따라서 먼저 `Resonance workspace`를 만들고, 문서/카탈로그/매니페스트부터 그쪽으로 모은다.

## Stage 1 actions

1. `/opt/Resonance` 생성
2. 아래 폴더 생성
   - `docs/`
   - `catalog/`
   - `manifests/`
   - `plans/`
   - `notes/`
3. Carbonet에서 확정된 Resonance 문서 복사
4. common-module catalog / adapter catalog 골격 배치
5. Carbonet 빌드는 계속 기존 경로에서 유지
6. builder/common-jar/package-manifest 문서를 Resonance 쪽으로 이동

## Stage 1 result

- Carbonet는 계속 동작
- Resonance는 코어 설계/카탈로그/거버넌스 워크스페이스로 분리 시작
- 이후 실제 코드 이동은 module-by-module로 진행

## Do not do in stage 1

- reactor module 경로 변경
- pom.xml 전체 치환
- package name 전체 변경
- frontend route 대량 변경
