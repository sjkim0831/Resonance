# Resonance 서버 계정 분리 운영서

기준일: 2026-07-23  
대상: `172.16.1.232`, `/opt/Resonance`, Kubernetes `carbonet-prod` / `carbonet-dev`

## 계정 및 권한

| 용도 | Linux 계정 | 작업공간 | Kubernetes 권한 |
|---|---|---|---|
| 운영 | `carbonet-ops` | `/srv/resonance-workspaces/operations` | `carbonet-prod` 운영, Secret 조회 금지; monitoring/resonance-ops 읽기 |
| 개발 서버 | `carbonet-dev` | `/srv/resonance-workspaces/development` | `carbonet-dev` namespace 관리자, 운영 namespace 접근 금지 |
| 개인 개발 | `jwchoo-dev` | `/srv/resonance-workspaces/personal` | `carbonet-dev` 개발, Secret 및 운영 namespace 접근 금지 |
| 센터장 | `center-director` | `/srv/resonance-workspaces/director` | `carbonet-prod` 및 monitoring 읽기 전용 |

기존 `sjkim`은 비상 관리자(break-glass)로 유지한다. 네 역할 계정에는 `sudo`와 `docker` 그룹을 부여하지 않는다.

## 접속 보안

- 네 계정은 모두 비밀번호가 잠겨 있다. 공용 비밀번호를 재사용하지 않는다.
- 사용자 본인의 SSH 공개키가 전달된 뒤에만 계정별 `authorized_keys`를 설치한다.
- 공개키 파일은 관리자 검토 후 다음 방식으로 설치한다.

```bash
sudo install -m 0600 -o <account> -g <account> \
  /secure/onboarding/<account>.authorized_keys \
  /home/<account>/.ssh/authorized_keys
```

- 센터장 계정은 운영상 필요할 때만 SSH 키를 설치하며, 기본은 읽기 전용 상태 조회에 사용한다.
- 각 계정의 kubeconfig는 `/home/<account>/.kube/config`에 mode `0600`으로 저장된다.

## 변경 경계

- 개발·개인·센터장 계정은 live tree `/opt/Resonance`에 쓸 수 없다.
- 개발 작업은 각 전용 workspace에서 수행하고, 검토된 산출물만 배포 pipeline으로 전달한다.
- 운영 계정은 `/opt/Resonance/var/ai-runtime`의 실행 증거를 기록할 수 있지만 source 수정 권한은 없다.
- 운영 Secret은 어느 역할 계정도 직접 조회하지 않는다. 필요한 값은 workload Secret 참조로만 사용한다.

## 검증 및 자가복구

일상 점검:

```bash
sudo /opt/Resonance/ops/scripts/verify-separated-server-accounts.sh
```

계정·RBAC·kubeconfig drift가 확인된 경우 멱등 복구:

```bash
sudo /opt/Resonance/ops/scripts/verify-separated-server-accounts.sh --repair
sudo /opt/Resonance/ops/scripts/verify-separated-server-accounts.sh
```

복구는 계정과 RBAC 기준선을 재적용하지만 기존 `sjkim`, 실행 workload, 데이터베이스, `/opt/Resonance` 소유권은 변경하지 않는다.

## 권한 변경 절차

1. 역할 변경 요청에 계정, 기간, namespace, 필요한 verb/resource를 기록한다.
2. Secret, cluster-admin, docker, unrestricted sudo는 기본 거부한다.
3. RBAC 변경 후 허용 동작과 거부 동작을 모두 `kubectl auth can-i`로 검증한다.
4. 퇴사·직무 변경 시 SSH key를 먼저 회수하고 kubeconfig token Secret을 재발급한다.
5. 분기마다 break-glass 계정과 장기 토큰을 검토하고 OIDC/단기 토큰 전환을 추진한다.
