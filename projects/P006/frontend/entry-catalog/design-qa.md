# P006 개별 진입 USD 설계·QA

## 목적과 범위
666종 원본 연결·Base·Variant·기존 품질 상태 보존. 별도 assets/catalog 폴더에 ID별 진입 USD만 추가. 기존 카탈로그 페이지와 resolver 수정 없음.
자산 ID는 기존 E/N/A ID를 사용한다. 예시 N001~N666으로 재번호 부여하지 않는다.

## 구성
Stage defaultPrim /Asset (component) → /Asset/Model에서 정확한 원본 source USD/source Prim Reference.
부모 월드 변환이 있으면 진입 루트에 적용해 원본 표시 위치 보존. 단위/상향축 동일. root 및 하위 Variant 구성을 기록/검증.
원본 제품 Prim 밖에 있는 재질은 /Asset/Resources의 추가 Reference로 보존한다. 재질/메시 본문 복제 없음.
assetId, nameKo, nameEn, category, sourceUsd, sourcePrim, variantInfo, reference 관계를 기록. 영문명은 기존 설명형 번역이며 제조사 공식 모델명이 아님.

## 썸네일
기존 정확한 자산 Prim의 RTX 이미지를 재사용. 원본/종속 해시, 이미지 해시, entry 형상 수·바운딩박스·전체 형상 변환·Variant를 검증.
새로운 entry RTX 렌더링을 수행한 것은 아니다. 외부 재질 보존 71종은 원본 렌더와 색 표현이 다를 수 있다.
Content Browser 캐시 경로: .thumbs/256x256/ID.usda.png. 설치된 omni.kit.widget.filebrowser 2.13.4의 test_thumbnails.py 경로 규칙 확인. 원본 썸네일 해상도는 유지한다.
MSTSC의 실제 Content Browser 클릭/드래그 검수는 사용자 세션을 방해하지 않기 위해 수행하지 않음. 동일 동작의 defaultPrim Reference 구성은 USD API로 666종 검사.

## 검증
파일 666개 존재, ID 중복 0, 유효 source Prim, composition 오류 없음, 관계 대상 누락 없음, 단일 최상위 /Asset, 원본과 Variant 동일, 단위/축/바운딩박스/변환 동일, authored geometry 본문 복제 0.
진입 파일 defaultPrim을 별도 Stage에 Reference한 결과 재검증. 원본 및 resolver/품질 장부 SHA 보존.
생성 계정 sjkim. 장비 제어/PLC 쓰기/외부 메시지/품질 승격 없음.

## 사용
서버 Omniverse Content Browser: /home/sjkim/OmniverseProjects/assets/catalog
열기: E001.usda 등 선택 → 해당 제품만 표시. 배치: 파일을 Stage/뷰포트에 Reference로 추가.
웹: 이미지 검색·분류 → 이미지 확대 → 개별 USD 다운로드 또는 서버 경로 복사.
wrapper는 절대 서버 원본 경로를 사용한다. 다른 컴퓨터에서 파일만 다운로드해 열면 원본 접근이 불가능할 수 있다. ZIP에는 원본 형상이나 전체 종속 리소스를 포함하지 않는다.

## 다음 원씽
추가 자산 제작이 아니라 필요한 제품 entry를 실제 작업 레이아웃에서 선택/배치한다. 기존 바닥 문제 6종과 GEOMETRY 검증 상태는 보존한다.
