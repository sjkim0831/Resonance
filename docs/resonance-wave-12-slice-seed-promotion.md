# Resonance Wave 12 Slice Seed Promotion

## Goal

`carbonet-common-core`를 한 번에 승격하지 않고, 내부 슬라이스를 먼저 `Resonance`로 분리 보관한다.

이번 seed 대상:

1. `versioncontrol` slice
2. `runtimecontrol` slice

## Why this wave

`carbonet-common-core`는 너무 큰 묶음이다.

이미 확인된 내부 경계:

- `config`
- `versioncontrol`
- `runtimecontrol`
- `governance / observability / codex`
- `menu`

따라서 다음 단계는 “통째 승격”이 아니라 “슬라이스 seed promotion”이 맞다.

## Placement

- `/opt/Resonance/modules/resonance-common/versioncontrol-core`
- `/opt/Resonance/modules/resonance-common/runtimecontrol-core`

## Scope

### versioncontrol-core

- `src/main/java/egovframework/com/platform/versioncontrol/**`

### runtimecontrol-core

- `src/main/java/egovframework/com/platform/runtimecontrol/**`
- `src/main/resources/egovframework/mapper/com/platform/runtimecontrol/**`

## Important note

This wave is a **seed promotion** wave.

It does **not** mean:

- full reactor integration
- full compile success
- final bridge completion

It means:

- source is now mirrored in Resonance
- new module identity is created
- next bridge wave can target smaller modules instead of the whole `carbonet-common-core`

## Expected next wave

- `versioncontrol-core` dependency cleanup
- `runtimecontrol-core` dependency cleanup
- `platform-runtime-control` bridge retargeting
