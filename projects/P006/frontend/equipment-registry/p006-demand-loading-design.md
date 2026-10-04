# P006 가시영역·필요 자산 선택 로딩

## 2026-09-23 3D 진입 오류 수정

- 증상: 로그인된 Vivaldi의 3D 전환에서 `Maximum call stack size exceeded`, 모델 0/14 상태 확인.
- 원인: 비동기 기능 시뮬레이션이 renderThreeScene을 감싼 뒤 패널의 1초 타이머가 선택 로딩 래퍼를 재설치했다. 이전 래퍼도 변경 가능한 originalRender를 참조하여 `선택 로딩 → 시뮬레이션 → 선택 로딩` 순환 호출이 발생했다.
- 수정: 패널 생명주기에서 래퍼를 한 번만 설치하고, 각 래퍼의 이전 함수는 지역 const로 고정한다. 기존 비동기 어댑터 체인은 보존한다.
- 코드 버전: factory-load-panel.js?v=6-demand-2.
- 추가 수정: 창 크기 변경 시 setSize로 지워진 WebGL 캔버스를 즉시 다시 렌더링한다. 숨겨진/크기 0인 뷰포트는 크기 갱신을 생략한다. composer.js?v=related-set-6-3d-fix-1.
- 추가 QA: resize redraw / hidden viewport / zero-size viewport 자동 검사 통과. 실제 Vivaldi 전체화면 전환 후에도 4개 설비 모델이 유지되는 화면 확인.
- 자동 QA: p006-demand-render-regression.cjs. 수정 전 RangeError 재현. 수정 후 motion-before-panel / motion-after-panel 2개 시나리오에서 각각 21회 호출이 기본 렌더 21회로 종료됨.
- 실제 화면 QA: 저장 공장 `ec441959-da46-4b6d-aadc-462cb42967f5`, DB v3. 새로고침 후 실제 설비 4 Instance / 고유 Asset 3종 준비, 3D 표시, 2D 복귀 후 3D 재진입, 전체 로딩에서 가시·필요만 전환 확인. 저장/배치 편집은 수행하지 않음.
- 도움말: 코드 업데이트 후 열린 탭은 새로고침 1회가 필요하다. 이후 3D 보기와 하단 모델 모드를 사용한다.
- 다음 업무: 대규모 레이아웃의 선택 로딩·캐시 해제 수명 검증. 이번 수정으로 대규모 메모리 최적화 전체를 검증한 것으로 간주하지 않는다.
- 백업: /home/sjkim/backups/P006-demand-recursion-20260923/.

## 구현 설계

- 화면 하단의 기존 `공장 성능 결과` 패널을 재사용하며 별도 팝업은 추가하지 않는다.
- `NEEDED` 모드는 3D 카메라 Frustum과 카탈로그 `model_xyz_m` 치수 후보를 이용해 화면 가시 모델만 GLB 로딩 후보로 선택한다. 선택 Instance와 공정 재생 중에는 화면 밖 자산도 유지한다.
- 치수 정보가 없으면 가시영역을 판정하지 않고 안전하게 로딩 대상으로 유지한다. 치수 기반 판정은 원본 GLB bounds의 구조 검증과 동일하지 않으므로 UI에 후보 기준으로 명시한다.
- 동일 `assetId`는 하나의 GLTF Scene 캐시를 공유하고 각 Instance는 Scene clone을 사용한다. 신규 모델의 동시 로딩 수를 제한하고 완료된 GLB마다 다음 대기 모델을 요청한다.
- 화면 밖·비선택·비실행 Asset은 유지시간 이후 캐시에서 제거한다. Cache budget 초과 시에도 필요한 Asset은 유지하고, 비필요한 캐시만 LRU 순으로 해제한다.
- 캐시 예산은 Three.js Geometry attribute와 인식 가능한 Texture 크기를 합산한 근사치다. GPU driver 메모리는 브라우저에서 직접 측정하지 않으며, 이 근사치를 GPU 메모리 실측값으로 표시하지 않는다.
- 카메라 최초 배치는 모델 다운로드 전에 레이아웃 메타데이터 중심으로 계산해 첫 Frustum을 정한다. 이후 사용자가 조작한 카메라 상태를 그대로 사용한다.
- 기존 상태 요약, GLB Resource Timing, Three.js geometry/texture count, JS heap(브라우저가 제공할 때)을 같은 패널에 표시한다. 측정 불가능한 항목은 미측정으로 표시한다.
- 모드와 설정값은 브라우저 localStorage에 저장한다. 레이아웃 DB나 자산 Evidence/관계 계약에는 기록하지 않는다.

## 상태·수치의 의미

| 표시 | 계산/기준 |
|---|---|
| `METADATA_ONLY` | Instance 배치 정보는 유지, GLB 미요청 |
| `QUEUED` | 가시·선택·공정 요구 대상, 동시 요청 한도 대기 |
| `LOADING` | GLTF 요청/변환 진행 중 |
| `READY` | Asset의 GLTF Scene이 메모리 캐시에 존재 |
| `FAILED` | GLTF 요청 실패, 재시도 버튼으로 재요청 |
| `EVICTED` | 과거 캐시에서 해제됨, 다시 필요해지면 재요청 |
| 관측 전송량 | 동일 출처 Resource Timing `transferSize` 합. Timing 미제공/캐시 응답은 미측정 가능 |
| Cache MB | Geometry attribute bytes + 추정 Texture RGBA bytes. GPU 실측 아님 |
| JS Heap | `performance.memory`가 제공되는 브라우저만 표시 |

`ALL`/`NEEDED`를 전환해 동일 레이아웃에서 비교할 수 있다. 비교는 캐시 상태가 다를 수 있어 통제된 성능 벤치마크로 간주하지 않는다. 기존 저장 공장 로딩/FPS 벤치마크와 별개로 현재 세션의 운영 상태 표시다.

## 확인할 QA

1. 2D 화면에서는 GLB 로딩을 시작하지 않고, 하단 요약은 3D 대기 상태를 표시한다.
2. 3D 전환 후 `NEEDED`에서 가시/선택 모델만 GLB 요청되며 화면 밖 배치 데이터는 유지된다.
3. 다른 구역으로 카메라 이동하면 신규 모델이 요청되고, 빠른 이동 중 신규 동시 요청은 설정 한도 이내다.
4. 같은 Asset의 여러 Instance는 GLTF 요청 하나와 cache reuse로 표시된다.
5. `ALL` 전환은 모든 GLB를 로딩 대상으로 만들고, `NEEDED` 복귀 후에도 선택/실행 대상은 유지된다.
6. 유지시간·cache budget 적용 후 비필요 Scene만 Geometry/Material/Texture 안전 해제되고, 필요 자산 예산 초과는 경고로 남는다.
7. 오류 Asset 재시도, EVICTED 재요청, 저장 레이아웃/관계 상태 불변을 확인한다.
8. 2D 선택·Canvas 요약·Mapping 상태에서 지연 로딩을 `3D 없음`으로 오인하지 않게 한다.
9. 하단 패널에서 Instance와 고유 Asset 단위를 혼동하지 않으며, GPU 메모리는 미측정으로 표시한다.

## 현재 범위와 제한

이번 반영은 Factory Composer의 웹 Three.js GLB 렌더 경로만 대상으로 한다. Omniverse USD streaming은 별도다. 실제 전후 5회 벤치마크, 대규모 100/300/700 Instance 시험, 브라우저별 GPU memory, operation-run continuous verification은 계측 데이터가 확보되기 전까지 완료 처리하지 않는다. Selection mode는 카탈로그 bounds를 이용한 초기 최적화이며 exact mesh-frustum culling은 아니다.
