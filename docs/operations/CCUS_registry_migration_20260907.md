# CCUS 사설 이미지 저장소 정리·/opt 이전 설계 및 결과

## 1. 완료 요약
2026-09-07 11:15:56~11:21:52 KST, 약 5분 56초. 실제 레지스트리 전환 구간 약 0.46초. 기존 약 99.99GB 저장소를 필요한 데이터 10,349,346,186바이트(약 10.35GB)로 선별 이전했다. 기존 익명 Docker 볼륨은 검증 후 Docker 명령으로 제거했다.

- 실제 데이터: /opt/registry/data
- 컨테이너 이름: local-registry
- 컨테이너 경로: /var/lib/registry
- 접속 주소: http://172.16.1.232:5000/v2/
- 기존 주소와 이미지 이름은 유지한다. 이는 웹앱 소스 경로가 아닌 이미지 저장소 API다.
- Docker registry:2 실행 방식 유지, restart=always. Kubernetes·Cloudflare 터널은 변경하지 않았다.

## 2. 보존·정리 정책
Kubernetes Pod, Deployment, StatefulSet, DaemonSet, Job, CronJob, ReplicaSet, ReplicationController의 이미지 및 imageID 참조를 조회했다. 총 43개 로컬 레지스트리 참조를 대조했다. source에 존재하는 참조 태그/digest와 큰 저장소별 링크 수정시각 기준 최근 20개 태그, latest/stable/production 명칭을 보존했다. 작은 5개 저장소는 모든 태그를 유지했다. 외부 Git 파일이나 등록되지 않은 사용자의 개인 복구 스크립트까지 전수 검증한 것은 아니다.

| 저장소 | 이전 태그 | 보존 태그 |
|---|---:|---:|
| carbonet-runtime | 850 | 29 |
| resonance-backstage | 164 | 20 |
| carbonet-web | 38 | 20 |
| carbonet-nextjs | 7 | 7 |
| carbonet-report-ocr | 3 | 3 |
| carbonet-runtime-base | 1 | 1 |
| resonance-registry-probe | 1 | 1 |
| spilo-16-uid1000 | 1 | 1 |
| 합계 | 1065 | 82 |

별도로 직접 참조된 digest 및 manifest list 하위 manifest도 보존했다. 제거된 과거 태그 983개는 더 이상 이름으로 조회할 수 없다. 해당 데이터가 보존 digest와 공유되지 않았다면 바이너리는 삭제됐으므로 메타데이터만으로 복구할 수 없다. 소스에서 재빌드하거나 별도 외부 백업이 필요하다.

## 3. 안전한 이전 절차
1. 원본 레지스트리 운영을 유지하며 조회 계획과 전체 repository 메타데이터를 보존했다.
2. /opt에 선택된 manifest와 의존 layer/config blob만 복사했다.
3. 561개 blob을 목적지에서 다시 읽어 SHA-256 digest와 일치하는지 확인했다.
4. 15000번 로컬 전용 읽기 전용 검증 컨테이너에서 태그·manifest 163건 및 종속 레이어 HEAD 검증을 수행했다.
5. 원본 태그 snapshot 불변 및 신규 Kubernetes 참조 없음 확인 후 기존 저장소를 정지했다.
6. 정지 후 snapshot을 재검사하고 동일 이미지·주소·환경으로 /opt bind mount 컨테이너를 생성했다. 오류 시 기존 컨테이너로 복원하도록 스크립트에 분기를 두었다.
7. 실제 5000번에서 같은 검증 163건과 작은 probe blob 쓰기·읽기를 수행했다.
8. 기존 볼륨을 참조하는 컨테이너가 정지한 이전 컨테이너 1개뿐임을 확인하고, 검증 컨테이너와 이전 컨테이너 및 옛 익명 볼륨을 제거했다.

## 4. 검증 및 한계
- 561개 데이터 blob SHA-256: 모두 일치
- 15000번 검증: 163건 통과
- 5000번 검증: 163건 통과
- 새 위치 registry probe 실제 쓰기/읽기: 통과
- CCUS 백엔드·네이티브 DB·프론트·P006 서비스: active
- CCUS backend health: UP
- Cloudflare 터널: 기존 컨테이너 실행 유지
- source에서 이미 없던 carbonet-runtime:2026.06.14-023404-kubeadm은 작업 전부터 HTTP 404였으며 복원하지 않았다. 오래된 배포 정의의 결함으로 별도 수정이 필요하다.
- 모든 Kubernetes 업무 컨테이너 재기동, 로그인·PDF 기능 전체 E2E, 브라우저 시각 검수는 하지 않았다. 화면·SDUI·업무 길잡이 및 DB 스키마 변경 없음.

## 5. 용량 결과
루트 파일시스템 여유 약 85GB → 178GB. /opt 여유 약 48GB → 38GB(사용률 98%). /opt 밖 Docker 볼륨은 0개가 되었으나, 새 저장소 bind mount의 10.35GB는 docker system df의 Local Volumes 항목에 계산되지 않는다. 따라서 해당 출력의 0B를 전체 저장소가 비었다고 해석하면 안 된다.

## 6. 증거 및 향후 운영
서버: /opt/Resonance/docs/operations/registry-migration-20260907

- plan.json: 전체·보존 태그, 참조 digest, blob 목록, 사전 누락 목록
- original-repository-metadata: 이전 태그 및 digest 연결 정보 (바이너리 전체 백업 아님)
- copy-result.json: 복사·해시 검증
- api-verify-15000.json / api-verify-5000.json: API 검증
- cutover-result.json: 전환 시간 및 쓰기·읽기 검증
- original-container.json: 이전 컨테이너 구성, 서버 관리자 전용 권한

이전 실행 스크립트는 운영 기록으로 보존하며 자동 재실행하지 않는다. 일반 재기동은 docker restart local-registry를 사용한다. 컨테이너를 새로 만들 때는 반드시 /opt/registry/data를 /var/lib/registry로 bind mount한다. -v 옵션 없이 생성하면 다시 익명 볼륨으로 저장될 수 있다. 자동 이미지 삭제 정책은 활성화하지 않았다. /opt 여유 38GB이므로 추가 대형 빌드·이전 전에 용량 관리가 우선이다.
