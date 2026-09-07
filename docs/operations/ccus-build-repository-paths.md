# 빌드 저장소 및 캐시 /opt 통합 — 2026-09-06

## 적용 경로
모든 실제 저장 위치는 /opt/Resonance/runtime/host-data/build-repositories 아래이며 기존 홈 경로는 호환 심볼릭 링크다.

|기존 경로|대상 하위 폴더|확인 용량|
|---|---|---|
|/home/sjkim/.m2|maven-local|842MB|
|/home/sjkim/.gradle|gradle-user-home|1.7GB|
|/home/sjkim/.cache/resonance-gradle|resonance-gradle|464MB|
|/home/sjkim/.npm|npm-cache|240MB|
|/home/sjkim/.cache/ms-playwright|playwright-browsers|1.3GB|

## 검증 및 복구
rsync checksum dry-run 차이 0 확인 후 전환했다. 원본도 /opt/resonance-data/backups/build-repositories-20260906-211828 및 build-repositories-20260906-211901 아래 보관했다. manifest.tsv에 원본/대상 대응을 기록했다. 원본 권한과 소유자를 보존했다. Maven/Gradle 13초, npm/Playwright 3초. ./gradlew --version에서 Gradle 8.10 실행 정상. 백엔드 health UP. 전체 프로젝트 컴파일이나 사용자 업무 E2E 완료를 의미하지 않는다. Git 제외된 runtime/host-data 아래이며 인증 정보 포함 가능성이 있는 .m2 설정은 출력하지 않았다.

## /opt 밖의 중요한 경로 — 이번에 이동하지 않음
- /home/sjkim/.ssh 및 /etc/ssh: 원격 접속 키와 SSH 설정
- /etc/netplan: 서버 네트워크 설정
- /var/lib/tailscale: Tailscale 노드 상태와 인증 정보
- /home/sjkim/.kube 및 /etc/kubernetes: 클러스터 접속/운영 설정
- /var/lib/etcd: Kubernetes 핵심 상태 저장소
- /var/lib/kubelet: 실행 중인 볼륨 마운트와 노드 상태
- /var/lib/libvirt/images: 가상머신 이미지 경로 존재. 실제 이미지 및 사용량은 추가 확인 필요
- /etc/ssl: OS 인증서 및 신뢰 저장소
- /var/log/journal 및 /var/log/postgresql: 서비스/DB 로그

위 폴더는 단순 캐시가 아니므로 백업 대상이지만 이번 빌드 저장소 이동 요청으로 운영 경로를 변경하지 않았다. /var/lib/containerd는 이미 /opt/containerd를 가리키는 링크다. 따라서 /opt만 백업한다고 서버 전체 복구가 보장되는 것은 아니다.
