# Static Pod 전환 완료计划

## 현재 상태

### 완료
- CUBRID Static Pod: ✅ Running (포트 33000)
- iptables 자동 복원: ✅ enabled (systemd 서비스)
- registry.local DNS: ✅ /etc/hosts에 추가됨
- Docker Registry: ✅ localhost:5000에서 HTTP로 실행 중

### 미완료
- Web Server Static Pod: ❌ ErrImagePull
- kubelet: 정상 작동 중 (재시작 필요)

## 문제 분석

containerd가 `registry.local:5000`에 HTTPS로 접근 시도:
```
"https://registry.local:5000/v2/...: http: server gave HTTP response to HTTPS client"
```

Docker Registry는 HTTP로 실행 중이지만 containerd는 HTTPS를 기대함.

## 해결 방법

### Step 1: containerd에 insecure registry 설정 추가
- 파일: `/etc/containerd/certs.d/registry.local.toml`
- 내용: HTTP 레지스트리 허용 설정
- 이미 생성됨 (재확인 필요)

### Step 2: containerd 재시작
```bash
sudo systemctl restart containerd
```

### Step 3: kubelet 재시작
```bash
sudo systemctl restart kubelet
```

### Step 4: 이미지 풀 확인
```bash
crictl pull registry.local:5000/carbonet-runtime:2026.06.16-032623-kubeadm
```

### Step 5: Static Pod 상태 확인
```bash
kubectl get pods -n default | grep runtime
```

## 검증
- 웹서버가 Running 상태가 되는지 확인
- `/actuator/health` 엔드포인트 접근 테스트
- CUBRID 연결 테스트

## 예상 소요 시간
5-10분