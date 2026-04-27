# Resonance Space-station Metaphor

## Goal

운영, 공통, 빌더, 프로젝트의 역할을 직관적으로 구분할 수 있게 비유로 정리한다.

## Mapping

### 우주정거장

해당:

- `ops`
- `operations-console`
- control plane
- backup / rollback / deploy / migration / project lifecycle

역할:

- 로켓을 관리
- 제트팩 버전 관리
- 발사/정비/복구

## 제트팩

해당:

- `Resonance common`
- reusable service logic
- common capability
- builder engine
- theme engine
- authority/account/board/common runtime

역할:

- 여러 로켓이 공통으로 쓰는 추진 장치
- 업그레이드는 여기서 집중 관리

## 로켓

해당:

- `projects/carbonet-adapter`
- `projects/carbonet-runtime`
- project-specific binding and runtime package

역할:

- 실제 프로젝트를 싣고 날아가는 단위
- 가능한 한 가볍게 유지

## 빌더

빌더는 로켓이나 제트팩 그 자체가 아니라 “조립소”에 가깝다.

### 빌더 엔진

- 제트팩 쪽
- Resonance common에 둔다

### 빌더 콘솔

- 우주정거장 쪽
- operations-console에서 관리한다

### 빌더 산출물

- 로켓 쪽
- project adapter/runtime에 들어간다

### 빌더와 공통 JAR

조립소는 단순히 로켓 외형만 만드는 것이 아니라,

- 어떤 제트팩 버전을 장착할지
- 어떤 공통 JAR 세트를 묶을지
- 어떤 manifest로 발사할지

까지 계산해야 한다.

## Practical rule

- 운영 로직이냐? -> 우주정거장
- 재사용 공통 로직이냐? -> 제트팩
- 프로젝트 바인딩/조합이냐? -> 로켓
- 생성기/스캐폴더/페이지 제작기냐? -> 빌더 엔진은 제트팩, 실행 콘솔은 우주정거장, 결과물은 로켓
