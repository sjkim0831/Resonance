# E096 Ram 실제 GLB 가동부 Pilot

## 목적

제품 플래너의 `FUNCTIONAL_DEMO` 모듈 애니메이션과 실제 설비 Geometry 검토를 분리한다. 실제 P006 자산 E096(소형 프레스)의 GLB Scene에서 독립 `ram` Mesh를 찾아, 원본 GLB는 바꾸지 않고 사용자 지정 변위로 왕복 동작을 시각 검토한다.

## 요구 → 화면·코드 → 검증 매핑

| 요구 | 구현 | 검증 기준 |
|---|---|---|
| 실제 설비 Geometry 로드 | `product-planner-e096-motion-pilot.html`, `/projects/P006/assets/3d-derived/E096.glb` | HTTP/GLB 서명 및 Three.js GLTFLoader 로드 성공 |
| 가동 후보 노드 확인 | `Scene/Asset/Model/ram` 조회 | `isMesh=true`, 노드 경로와 local/world axis 화면 표시 |
| 왕복 시연 | `ram.position.z`에 사용자 변위 적용 | 재생·일시정지·원위치 버튼 및 화면 변위 확인 |
| 실증 수준 구분 | 페이지 경고·Gate 표·도움말 | 실제 스트로크·피벗·기구학은 UNVERIFIED |
| 계획 데이터 격리 | 독립 읽기 전용 화면 | Product Plan/DB/Asset Registry/관계 데이터 미변경 |

## 입력·출력

- 고정 입력 자산: `assetId=E096`, 이름 `소형 프레스`, 웹 GLB `/projects/P006/assets/3d-derived/E096.glb`.
- 관측 후보: 독립 Mesh 노드 `Scene/Asset/Model/ram`. Pilot의 참조 인벤토리에는 parent `Model`, local position `[0,0,-1.21]`, local quaternion `[0,0,0,1]`로 기록되어 있다.
- 사용자 시연 입력: 변위 `0.01–0.50 m`, 기본 `0.10 m`; 왕복 주기 `1–20 s`, 기본 `4 s`. 이는 작업 화면 내 가정값이며 파일/계획에 저장되지 않는다.
- 화면 동작은 원래 local transform에서 local +Z 방향으로 입력한 변위만큼 이동 후 복귀하는 일방향 시험이며, 좌우 대칭 `±` 스트로크를 뜻하지 않는다.
- 출력: GLB 로딩 상태, 노드 발견 여부, 후보 변환축, 재생 상태. 축 표시값은 hierarchy transform의 계산이며 공정상 실제 Stroke/설치 방향 승인값이 아니다.

## 범위 경계

`ram`이라는 이름과 별도 Mesh 및 transform은 실제 장면의 구조 증거다. Mesh를 움직일 수 있다는 것은 화면 시연 기능 증거일 뿐 제조사 기구학 증거가 아니다. 제조사 도면이나 계측된 Stroke, Pivot/axis, 속도 프로파일이 들어오기 전에는 다음을 승인하지 않는다.

```ini
MANUFACTURER_STROKE = UNVERIFIED
KINEMATICS = UNVERIFIED
PROCESS_COMPATIBILITY = UNVERIFIED
WORKPIECE_CONTACT = NOT_IMPLEMENTED
ANIMATION_VERIFIED = NO
```

현재 724 GLB node triage inventory는 `ORIGINAL_NODE_ANIMATABLE=273`, `WHOLE_MESH_ONLY=451`로 분류한다. 여기서 `ORIGINAL_NODE_ANIMATABLE`은 hierarchy 상 별도 Mesh에 transform을 적용할 수 있는 후보라는 의미이지, 독립적인 실제 가동부 273개를 검증했다는 뜻은 아니다. E096은 그 후보 중 한 Asset을 브라우저에서 재생 검토하는 Pilot이다.

## 사용 절차

1. 제품 플래너 → `실행 검토` → `E096 Ram 왕복 검토 열기`.
2. `실제 E096 모델 로드` 후 모델에서 프레스 본체와 Ram Mesh를 확인한다.
3. 필요할 경우 검토 변위/시간을 조정하고 `왕복 시연`을 누른다.
4. 제조사 스트로크 값이 아닌 화면 가정값임을 유지하고, 원위치 버튼으로 되돌린다.

## 다음 Gate

1. E096 제조사 도면/정비 문서의 기준축·stroke·cycle-time 근거 확보.
2. USD 원본 Prim과 파생 GLB hierarchy의 대응 및 실제 pivot/axis 검증.
3. 별도 작업물 USD/GLB와 작업면 높이·접촉 범위 자료 확보.
4. 근거 승인 후에만 생산 timeline의 PROCESS 단계와 기계 animation controller를 결합한다.

현재 Pilot은 설비 모델 상호작용 확인까지만 닫으며, 전체 공정 재생으로 승격하지 않는다.
