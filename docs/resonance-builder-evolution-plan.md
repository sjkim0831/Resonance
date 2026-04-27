# Resonance Builder Evolution Plan

## Goal

빌더를 단계적으로 발전시켜, 처음에는 화면 중심 생성부터 시작하고 이후 백엔드/DB까지 포함한 프로젝트 패키지 빌더로 확장한다.

## Stage model

### Stage 1. Screen-first builder

현재 우선순위.

역할:

- page schema 선택
- route binding 초안 생성
- screen composition 생성
- theme token 적용
- preview render

산출물:

- frontend page
- route family entry
- project adapter binding fragment
- page manifest

### Stage 2. Backend-connected builder

화면 빌더가 안정화되면 연결.

역할:

- API client scaffold
- request/response type scaffold
- backend contract binding
- adapter hook generation

산출물:

- API type
- client function
- backend controller/service scaffold
- contract metadata

### Stage 3. DB-aware builder

백엔드 규약이 안정화되면 연결.

역할:

- migration draft
- mapper/entity/VO draft
- schema diff proposal
- release checklist 생성

산출물:

- migration bundle draft
- mapper or repository draft
- DB change manifest

## Core builder rule

빌더는 “공통 JAR을 포함한 프로젝트 패키지”를 만드는 방향으로 발전해야 한다.

즉 빌더는 단순히 파일 몇 개를 생성하는 것이 아니라 아래를 함께 관리해야 한다.

- project runtime package
- project adapter package
- common JAR set
- theme bundle
- migration bundle
- package manifest
- k8s release manifest

## Why framework updates matter

공통 업데이트가 일어나면:

- common JAR 세트 버전이 바뀐다
- adapter contract가 바뀔 수 있다
- screen/schema/template 구조가 바뀔 수 있다

그래서 빌더는 항상 최신 framework 구조를 참조해야 한다.

즉 builder는:

- scaffolding only tool 이 아니라
- framework-aware package composer

여야 한다.

## Builder update rule

빌더가 스캐폴딩할 때는 아래 순서를 따른다.

1. current framework structure version 확인
2. common JAR set 확인
3. adapter contract version 확인
4. project package manifest 생성
5. scaffold output 생성
6. container / k8s release descriptors 생성

## Success criteria

- 화면 빌더로 시작하되 나중에 backend/db까지 자연스럽게 확장 가능하다.
- 공통 업데이트가 일어나면 builder template도 같이 업데이트된다.
- builder 산출물은 항상 project package manifest 기준으로 생성된다.
