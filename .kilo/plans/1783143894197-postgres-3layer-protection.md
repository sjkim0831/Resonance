# DB 모니터링 페이지 배포 계획

## 현황

### 완료된 작업
| 항목 | 상태 | 비고 |
|------|------|------|
| PrometheusMetricsController.java | ✅ 완료 | `/admin/api/prometheus/metrics` API |
| adminSystemFamily.ts | ✅ 완료 | `/admin/system/db-monitoring` 라우트 추가 |
| DbMonitoringPage.tsx | ✅ 완료 | React 컴포넌트 |
| Maven 빌드 | ✅ 완료 | 152MB JAR 생성 |
| Docker 이미지 빌드 | ✅ 완료 | registry.local/carbonet-runtime:2026.07.04-182500-fresh |
| postgres-exporter | ✅ 배포됨 | Monitoring namespace |
| Grafana 대시보드 | ✅ 생성됨 | PostgreSQL Database Monitoring |

### 남은 문제
| 문제 | 원인 | 해결책 |
|------|------|--------|
| Docker Registry Push 실패 | "invalid checksum digest format" | 새 태그로 재빌드 또는 Registry 재시작 |
| Kubernetes 배포 미실행 | 위 문제로 인하여 | Registry 문제 해결 후 배포 |

---

## 배포 계획

### 1단계: Registry 문제 해결

#### Task 1.1: Registry 상태 확인
```bash
kubectl get pods -n kube-system -l app=registry 2>&1
kubectl logs -n kube-system -l app=registry --tail=50 2>&1
```

#### Task 1.2: Registry 재시작 (필요시)
```bash
kubectl rollout restart deployment registry -n kube-system 2>&1
# 또는
kubectl delete pod -n kube-system -l app=registry 2>&1
```

#### Task 1.3: 이미지 Push 재시도
```bash
docker push registry.local/carbonet-runtime:2026.07.04-182500-fresh 2>&1
```

---

### 2단계: Kubernetes 배포

#### Task 2.1: 이미지 업데이트
```bash
kubectl set image deployment/carbonet-runtime -n carbonet-prod \
  carbonet-runtime=registry.local/carbonet-runtime:2026.07.04-182500-fresh 2>&1
```

#### Task 2.2: Rolling Update 확인
```bash
kubectl rollout status deployment/carbonet-runtime -n carbonet-prod --timeout=180s 2>&1
```

#### Task 2.3:Pod 상태 확인
```bash
kubectl get pods -n carbonet-prod -l app=carbonet-runtime -o wide 2>&1
```

---

### 3단계: 검증

#### Task 3.1: 백엔드 API 테스트
```bash
curl -s http://172.16.1.232:80/admin/api/prometheus/metrics 2>&1 | jq '.'
# 응답 예시: {"pgUp": 1, "databaseSizes": [...], "activeConnections": 5, ...}
```

#### Task 3.2: DB 모니터링 페이지 접근
```
URL: http://172.16.1.232/admin/system/db-monitoring
```

#### Task 3.3: Grafana 대시보드 접근
```
URL: http://172.16.1.232:30300/d/postgres-db-monitoring/postgresql-database-monitoring
ID: admin
PW: admin
```

---

## 검증 체크리스트

- [ ] Registry push 성공
- [ ] Kubernetes deployment 업데이트 완료
- [ ] 새 pod Running 상태
- [ ] `/admin/api/prometheus/metrics` 응답 정상
- [ ] `/admin/system/db-monitoring` 페이지 로드
- [ ] DB 상태, 연결 수, 복제 지연 메트릭 표시
- [ ] Grafana 대시보드 연결

---

## 실패 시 복원

### 이전 이미지로 롤백
```bash
kubectl rollout undo deployment/carbonet-runtime -n carbonet-prod 2>&1
```

### Registry 문제 시 대안 (로컬 이미지 사용)
```bash
# 현재 서버에서 이미지 저장
docker save registry.local/carbonet-runtime:2026.07.04-182500-fresh -o /tmp/carbonet-runtime.tar

# 클러스터 노드에서 이미지 로드 (각 노드에서 실행)
docker load -i /tmp/carbonet-runtime.tar

# 즉시 배포
kubectl set image deployment/carbonet-runtime -n carbonet-prod \
  carbonet-runtime=registry.local/carbonet-runtime:2026.07.04-182500-fresh
```

---

## 실행 순서
1. Task 1.1 - Registry 상태 확인
2. Task 1.2 - Registry 재시작 (필요시)
3. Task 1.3 - 이미지 Push 재시도
4. Task 2.1 - Kubernetes 이미지 업데이트
5. Task 2.2 - Rolling Update 확인
6. Task 3.1 ~ 3.3 - 검증