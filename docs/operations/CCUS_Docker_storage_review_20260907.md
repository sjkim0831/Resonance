# Docker 저장소 의존성 및 삭제 가능성 검토

## 1. 결과
2026-09-07 11:10~11:12 KST, 서버 172.16.1.232에서 읽기 전용 점검했다. 이번 추가 삭제량은 0B다. 미사용 빌드 캐시는 없으며, 대용량은 실행 중인 사설 레지스트리 볼륨이다.

## 2. 실제 구성
- DockerRootDir: /var/lib/docker
- 실행 컨테이너: carbonet-cloudflare-tunnel, local-registry (2개)
- local-registry: registry:2, 호스트 5000 포트
- 볼륨: 88e501cd85ae2e9848fa7e5972b3a3f9a39a8a882813634fc3b404e98572b4d4
- 컨테이너 내 마운트: /var/lib/registry
- 볼륨 크기: Docker 보고 약 99.99GB, du 약 94GiB
- 빌드 캐시: 0B
- 두 컨테이너 이미지 합계: 약 88.77MB. 실행 컨테이너가 참조하므로 삭제하지 않음.

## 3. 레지스트리 저장 내용
carbonet-nextjs, carbonet-report-ocr, carbonet-runtime, carbonet-runtime-base, carbonet-web, resonance-backstage, resonance-registry-probe, spilo-16-uid1000의 8개 저장소가 있다. 오래된 이름이나 버전만으로 불필요하다고 판단하지 않는다.

## 4. 무삭제 모의 검증
registry garbage-collect --dry-run /etc/docker/registry/config.yml 실행 결과:

    5408 blobs marked, 0 blobs and 0 manifests eligible for deletion

현재 참조되지 않는 자동 정리 대상은 0개다. 이 결과는 모든 과거 태그가 업무상 필요하다는 의미가 아니라, 참조가 연결돼 있어 단순 GC로 삭제할 수 없다는 의미다. Kubernetes의 현재 Pod 이미지도 조회했다. 레지스트리 이미지를 삭제하면 현재 프로세스가 당장 살아 있더라도 이후 Pod 재생성·복구·재배포에서 이미지 다운로드가 실패할 수 있다.

## 5. 변경 및 테스트
삭제, 컨테이너 정지, 설정 변경, GC 실제 실행은 하지 않았다. 두 Docker 컨테이너 실행 유지, CCUS 백엔드 health UP을 확인했다. 화면 변경이 없으며 브라우저 시각 검수나 업무 전체 E2E는 실행하지 않았다.

## 6. 다음 작업 설계
용량을 줄이려면 저장소별 태그·digest와 현재 Deployment/StatefulSet/Job 및 복구 정책을 대조한다. 보존 대상 digest를 확정한 뒤 과거 태그 삭제 목록을 검토하고, 승인된 범위만 레지스트리 API로 삭제한다. 실제 GC는 push 경합을 막는 읽기 전용 또는 정지 구간에서 수행해야 한다. 볼륨 폴더의 직접 삭제 및 docker system prune --volumes는 사용하지 않는다.

## 7. /opt 대체 가능성 추가 확인 (11:14 KST)
실제 호스트 저장 경로는 /var/lib/docker/volumes/88e501cd85ae2e9848fa7e5972b3a3f9a39a8a882813634fc3b404e98572b4d4/_data 이다. /var/lib/registry는 컨테이너 내부 경로이며 호스트의 동명 폴더와 혼동하지 않는다.

현재 8개 저장소에 태그 1,065개가 존재한다: runtime 850, backstage 164, web 38, nextjs 7, OCR 3, runtime-base 1, probe 1, spilo 1. 조회된 Deployment 10개와 StatefulSet 1개가 이 레지스트리 이미지를 참조한다. 이는 현재 실행 중이라는 판정이나 보존 대상 이미지 수와 같지 않다. 태그별 digest 공유 및 CronJob/복구 참조를 추가 대조하기 전 삭제 목록을 확정할 수 없다.

실제 데이터를 /opt/registry/data로 복사하고 registry 컨테이너의 /var/lib/registry에 bind mount하는 설계는 가능하다. 그러나 저장소 약 100GB에 대해 /opt 여유는 약 48GB이므로 지금은 전체 이전할 수 없다. 불필요 버전을 확정·정리하거나 별도 디스크를 /opt/registry에 마운트해야 한다. 기존 위치를 /opt 아래에서 링크 또는 bind mount로 보이게 하는 것은 경로만 바꾸며 물리 저장 위치·용량은 바뀌지 않는다. 이번에는 이전이나 삭제를 수행하지 않았다.
