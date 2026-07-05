# /admin/emission/ecoinvent 화면 에러 해결计划

## 문제

`/admin/emission/ecoinvent` 화면 접근 시 404 에러 발생:
```
No static resource EmissionEcoinventAdminMigrationPage-CedmmNBE.js
```

**근본 원인:**
- Kubernetes deployment에서 `react-app-overlay` 볼륨이 호스트 경로 `/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app/`를 마운트
- 해당 호스트 디렉토리가 비어있음
- React 번들 파일이 존재하지 않음
- 결과: React 컴포넌트 로드 실패 → `UNHANDLED_REJECTION`, `REACT_ERROR_BOUNDARY`

---

## 현재 상태

| 항목 | 값 |
|------|-----|
| 오버레이 디렉토리 (호스트) | `/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app/` (비어있음) |
| 오버레이 디렉토리 (컨테이너) | `/app/react-app-overlay/` |
| 오버레이 활성화 | `CARBONET_REACT_APP_FS_OVERRIDE_ENABLED=true` |

---

## 해결 방법

### Task 1: 빠른 해결 (임시 조치)
**오버레이 기능 비활성화:**

1. `deploy/k8s/projects/carbonet/carbonet-runtime.config.yaml` 수정:
   ```yaml
   CARBONET_REACT_APP_FS_OVERRIDE_ENABLED: "false"
   ```

2. Kubernetes deployment에 변경사항 적용:
   ```bash
   kubectl apply -f deploy/k8s/projects/carbonet/carbonet-runtime.config.yaml
   kubectl rollout restart deployment/carbonet-runtime -n carbonet-prod
   ```

**장점:** 즉시 적용 가능, 복잡한 빌드 과정 불필요
**단점:** 오버라이드 기능 완전히 비활성화됨

### Task 2: 완전한 해결 (권장)
**프론트엔드 빌드 후 오버레이 디렉토리에 배치:**

1. 프론트엔드 프로젝트 빌드 (Vite/npm):
   ```bash
   cd /opt/Resonance/projects/carbonet-frontend
   npm install
   npm run build
   ```

2. 빌드 산출물을 오버레이 디렉토리로 복사:
   ```bash
   cp -r build/* /opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app/
   ```

3. Deployment 재시작:
   ```bash
   kubectl rollout restart deployment/carbonet-runtime -n carbonet-prod
   ```

**장점:** 전체 오버레이 기능 정상 작동
**단점:** 빌드 환경 필요, 시간이 소요됨

---

## 검증

### 빠른 확인 (Task 1 적용 후):
```bash
kubectl exec -n carbonet-prod deploy/carbonet-runtime -- curl -s localhost:8080/admin/emission/ecoinvent | grep -i error
```

### 완전한 확인 (Task 2 적용 후):
1. `/admin/emission/ecoinvent` 화면이 정상 로드되는지 확인
2. `EmissionEcoinventAdminMigrationPage-CedmmNBE.js` 파일 접근 가능 확인:
   ```bash
   kubectl exec -n carbonet-prod deploy/carbonet-runtime -- ls -la /app/react-app-overlay/assets/
   ```

---

## 영향 범위

- **영향받는 화면:** `/admin/emission/ecoinvent` 및 기타 React 기반 페이지
- **영향받지 않는 화면:** JSP 기반 기존 화면 (예: `/uat/uia/loginView`)

---

## 다음 단계

1. Task 1 (빠른 해결) 적용하여 즉시 복구
2. Task 2 (완전한 해결) 진행하여 오버레이 기능 복원

또는 별도 세션에서 프론트엔드 빌드 진행