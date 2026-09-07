# OS 설정 경로 통합 — 2026-09-06

## 추가 적용
/var/lib/tailscale → /opt/ccus-host/storage/var-lib-tailscale, /var/log/journal → /opt/ccus-host/storage/var-log-journal. 기존 경로 bind mount 및 local-fs.target에 영구 등록했다. Tailscale은 일반 LAN SSH 연결을 확인한 뒤 중단·복사·체크섬 비교·마운트·재시작했다. journald는 --sync와 --relinquish-var로 /run 기록 전환 후 복사·체크섬 비교·마운트·--flush를 수행했다. 작업 5초, 두 서비스 active, 백엔드 UP 확인. 원본은 마운트 아래 복구용 사본으로 보존했다. 재부팅 테스트와 실제 원격 Tailscale 클라이언트 재접속은 별도 확인 필요.

## 남은 클러스터 전환 범위
/etc/kubernetes, /var/lib/etcd, /var/lib/kubelet는 미이동. kubelet 자체 데이터는 du -x 기준 약 748MB지만 활성 하위 마운트 85개가 있고 연결 볼륨 포함 du는 228GB다. 재귀 복사로 228GB를 복제하면 안 된다. 실행 중인 etcd 632MB도 단순 파일 복사로 정상 백업이 되지 않는다. 일관된 etcd 스냅샷, 워크로드/볼륨 목록, 컨트롤플레인 및 노드 정지·복구 계획이 먼저 필요하다. 짧은 개별 서비스 재시작 범위를 넘어 전체 클러스터 유지보수로 분리한다. 나머지 /var/log 파일 역시 일부 서비스가 열린 파일 핸들로 사용하므로 전체 이동 완료가 아니다.

## 적용
/etc/ssh, /etc/netplan, /etc/ssl, /home/sjkim/.ssh, /home/sjkim/.kube의 실제 사용 저장소를 /opt/ccus-host/storage 아래로 전환했다. 원래 경로는 bind mount로 유지한다. 원본 권한·소유자·ACL·확장 속성을 rsync -aHAX로 보존하고 checksum 비교 후 전환했다. 마운트 설정은 /opt/ccus-host/mounts, 전환 manifest는 /opt/ccus-host/evidence에 보관한다. root 소유 /opt/ccus-host는 사용자 쓰기를 허용하지 않고 각 비밀 디렉터리의 기존 접근 제한은 유지한다.

## 복구와 보안
기존 원본 내용은 마운트 아래에 남아 있는 복구용 사본이다. 완전한 삭제나 루트 디스크 공간 회수를 수행한 것은 아니다. 복구 시 변경 이후 파일을 별도로 보존한 뒤 해당 mount unit을 disable/stop하면 기존 사본이 다시 보인다. 기존 사본에는 변경 이후 내용이 없으므로 임의로 unmount하지 않는다. SSH 키·클러스터 인증 정보가 포함되므로 이 저장소를 공개/Git 커밋/일반 배포 ZIP에 포함하지 않는다.

## 검증
설정 이동 명령 약 7.68초. 새 SSH 접속, sshd -t, systemd mount unit 검증, HTTPS 로그인 페이지, 서비스 상태, 운영 PostgreSQL pod 상태를 확인한다. 네트워크 설정 적용이나 재부팅은 하지 않았으므로 부팅 복구 E2E까지 검증한 것은 아니다.

## 미완료
/etc/kubernetes, /var/lib/etcd, /var/lib/kubelet, /var/lib/tailscale 및 OS 로그 경로는 아직 기존 위치다. 실행 중인 클러스터 상태·마운트·원격 접속 서비스 데이터이므로 파일 복사 후 경로만 바꾸는 방식으로 처리하지 않는다. /var/lib/libvirt/images는 확인 시 4KB로 이미지 파일 이동 실익이 없었다. 전체 OS 또는 전체 복구 종속성이 /opt로 통합된 상태는 아니다. 운영 DB의 immutable 보호는 변경하지 않았다.
