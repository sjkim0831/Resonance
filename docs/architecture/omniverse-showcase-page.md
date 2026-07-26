# Omniverse CCUS 디지털 트윈 통합 화면 설계

## 화면 계약

- 화면 ID: `SCR-PUBLIC-OMNIVERSE-SHOWCASE`
- 공개 경로: `/img/omniverse-showcase/index.html`
- 3D 뷰어 경로: `/img/omniverse-3d-viewer/index.html?v=ccus-area-controls-v3-20260723`
- 화면 유형: Public / No-Build 정적 자산
- 배포 파일: `projects/carbonet-assets/static/img/omniverse-showcase/index.html`
- 3D 자산: `carbon_emissions_facility.usda`

## Actor

- 일반 사용자: 홈페이지 정보 구조 안에서 CCUS 설비 3D 장면을 확인하고 카메라를 조작한다.
- 운영 담당자: 스트림 상태, 장면 자산, 공개 경로를 확인한다.
- 개발 담당자: 홈페이지와 3D 뷰어를 독립적으로 수정하고 정적 파일만 배포한다.

## 화면 및 테마

- 기존 Resonance 홈페이지의 흰 배경, 상단 메뉴, breadcrumb, 파란색 그라데이션 hero를 유지한다.
- 본문은 3D 뷰어 카드와 장면 정보·이용 방법 안내 패널로 구성한다.
- desktop은 뷰어와 안내 패널의 2열, tablet/mobile은 1열 구조로 전환한다.
- 현재 CCUS 모델과 원본 Omniverse WebRTC 플레이어를 iframe으로 연결한다.
- 원본 편집기의 메뉴·Stage·Content 패널은 CSS crop으로 가리고 3D viewport 영역만 출력한다.
- 흰 배경 홈페이지의 header, hero, 뷰어 카드, 안내 패널은 변경하지 않는다.

## 입력 동작

- 좌클릭 드래그: 카메라 평행 이동
- 우클릭 드래그: 카메라 회전
- 마우스 휠: 확대·축소
- 설비 애니메이션: 정지
- 전체 화면 링크: 독립 3D 뷰어를 새 창으로 연다.

## 연결 및 자가 복구

- 원본 WebRTC 플레이어를 직접 노출해 신뢰된 브라우저 입력을 전달한다.
- 간편 카메라 계층이 좌·우 드래그를 Omniverse 기본 카메라 조작으로 변환한다.
- 입력 처리는 비디오 요소가 아닌 스트림 문서 capture 단계에 등록한다. WebRTC 연결 중 비디오 요소가 교체되어도 MutationObserver가 새 요소를 자동 인식한다.
- 다시 연결 버튼은 iframe만 갱신하며 전체 애플리케이션을 빌드하거나 재시작하지 않는다.
- 단일 스트림의 잔여 연결은 운영 점검 시 `NVST_R_BUSY`로 탐지한다.

## 검증

- 공개 경로 HTTP 200
- 흰 배경 홈페이지 구조와 CCUS 제목 표시
- iframe 경로가 `ccus-area-controls-v3-20260723`인지 확인
- `carbon_emissions_facility.usda` 표시
- 스트리밍·웹 서비스 active
- 장면 `timeSamples=0`
- 최근 `NVST_R_BUSY=0`

## 배포

- Carbonet 정적 자산 경로에 HTML 파일만 설치한다.
- Java/React 전체 빌드와 pod 재시작은 수행하지 않는다.
- 교체 전 파일은 `/opt/Resonance/var/backups`에 자동 백업한다.

## 다운로드·내보내기 계약

- 뷰어 헤더의 `내보내기` 메뉴에서 USDA, GLB, PNG, MP4 4종을 제공한다.
- USDA는 생성된 원본 장면과 애니메이션 time sample을 보존한다.
- GLB는 현재 USDA에서 자동 생성한 호환용 정적 지오메트리 스냅샷이다.
- PNG는 Kit 시작 검증에서 저장한 최신 장면 이미지다.
- MP4는 화면에 보이는 3D 영역만 1280×720, 30fps로 정확히 30초간
  녹화한다. 브라우저가 WebM을 512 KiB 단위로 순서대로 전송하면 웹
  서비스가 마지막 프레임 패딩과 30초 절단을 적용한 H.264 MP4로 변환하고
  다운로드 URL을 반환한다.
- MP4 녹화 중에는 남은 초와 변환 상태를 표시하며, 중복 클릭은 별도의
  녹화를 만들지 않고 진행 중 작업을 공유한다.
- 자동 다운로드가 브라우저 정책으로 차단되어도 내보내기 메뉴에
  `MP4 다운로드` 직접 링크를 유지한다.

## 흰 화면 자동 복구

- iframe 로드는 연결 완료로 간주하지 않고 실제 `remote-video`의
  readyState와 영상 크기를 확인한다.
- 40초 동안 영상 트랙이 준비되지 않으면 단일 스트림의 잔여 점유를
  해제하도록 서버에 강제 복구를 1회 요청하고 iframe을 다시 연결한다.
- 사용자가 `다시 연결`을 누르는 경우에도 동일한 강제 복구 절차를
  수행하므로 단순 새로고침으로 `NVST_R_BUSY` 연결을 중첩하지 않는다.
- 여러 탭이 동시에 흰 화면을 감지해도 웹 게이트웨이가 첫 복구 요청만
  실행하고 이후 90초 동안은 동일 복구 결과를 공유해 재시작 폭주를 막는다.

## 최신 화면 단독 활성화

- 새 3D 화면이 열릴 때마다 서버가 새로운 활성 세대번호를 발급한다.
- 같은 브라우저의 기존 화면은 `BroadcastChannel` 알림을 받는 즉시
  WebRTC iframe을 종료한다.
- 다른 브라우저나 PC의 기존 화면도 3초 heartbeat에서 세대 불일치를
  확인하면 스트림·재연결·자동복구·MP4 녹화를 비활성화한다.
- 비활성 화면은 홈페이지 정보는 유지하지만 3D 스트림을 점유하지 않는다.
- 최신 화면만 카메라 조작, 내보내기, 흰 화면 복구 권한을 가진다.
- USDA, GLB, PNG는 `Content-Disposition: attachment`와 `no-store`로
  제공하고, MP4 결과는
  `/home/sjkim/OmniverseProjects/recordings`에 저장한다.
