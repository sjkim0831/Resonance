# Resonance Wave 13 Seed Reactor Registration

## Goal

`Wave 12`에서 만든 seed 모듈을 `Resonance/modules` reactor에 등록하고, 실제 선택 빌드로 다음 blocker를 확인한다.

대상:

1. `resonance-common/versioncontrol-core`
2. `resonance-common/runtimecontrol-core`

## Why this wave

The seed modules already exist, but Maven still cannot select them because they are not part of the current reactor module list.

So the next step is:

- register the seed modules
- run selected builds
- record the dependency blockers explicitly

## Reactor update

Add:

- `resonance-common/versioncontrol-core`
- `resonance-common/runtimecontrol-core`

to `/opt/Resonance/modules/pom.xml`

## Validation

```bash
cd /opt/Resonance/modules
mvn -q -pl resonance-common/versioncontrol-core -am -DskipTests package
mvn -q -pl resonance-common/runtimecontrol-core -am -DskipTests package
```

## Success criteria

- both seed modules are selectable in the reactor
- build success or blocker details are captured for each
