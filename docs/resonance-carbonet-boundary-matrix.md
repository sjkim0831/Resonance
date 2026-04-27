# Resonance / Carbonet Boundary Matrix

## Goal

버전업 가능성이 있는 대부분의 코드는 `Resonance`에 두고, `carbonet`은 얇은 프로젝트 코드만 남기는 기준을 명확히 한다.

## Core rule

- 업그레이드 가능성이 높다 -> `Resonance`
- 여러 프로젝트에서 다시 쓸 수 있다 -> `Resonance`
- 프로젝트 표현/조합/바인딩이다 -> `carbonet`

## Put in Resonance

- 공통 권한/계정/게시판/메뉴/테마 로직
- 공통 계산/검증/승인/배치 로직
- 공통 DB 처리 정책
- migration policy
- screen builder engine
- project builder engine
- deployment / backup / rollback / promotion workers
- AI control plane / model gateway / verifier
- adapter contracts
- common module catalog
- compatibility report generation

## Put in Carbonet

- route binding
- menu binding
- theme binding
- page composition
- project labels / wording
- project-specific configuration
- thin runtime assembly code
- project manifest wiring

## Avoid in Carbonet

- large reusable service logic
- heavy calculation logic
- common auth/account/board implementation
- common DB policy logic
- broad migration logic
- reusable builder engine

## Adapter split

### `resonance-adapter`

- common boundary layer
- canonical contract transform
- version-difference absorption
- empty/common adapter baseline

### `carbonet-adapter`

- project-specific binding layer
- route/menu/theme/page mapping
- project-only exception handling
- call into resonance capabilities

## Runtime split

### `carbonet-runtime`

- runtime wiring only
- assembly of:
  - carbonet-adapter
  - resonance common
  - selected theme bundle
  - runtime config

### `operations-console`

- shared control plane
- common module governance
- adapter compatibility governance
- project runtime lifecycle

## Coding rule for AI

AI가 신규 기능을 만들 때도 아래 기준을 따른다.

1. reusable or versioned logic?
   - move to Resonance
2. project expression or binding only?
   - keep in carbonet
3. uncertain?
   - default to Resonance first, then expose to project via adapter

## Success criteria

- Carbonet은 시간이 갈수록 더 얇아진다.
- 공통 업그레이드는 Resonance에서 대부분 처리된다.
- project는 주로 바인딩과 화면 조합만 담당한다.
