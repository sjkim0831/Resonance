# Kubernetes 파일 소유권 관리 솔루션 구현 계획

## 클러스터 환경
- **스토리지**: `local-storage` (Local PV) - 단일 노드
- **워크로드**: Java Spring Boot (carbonet-runtime) + CUBRID DB
- **네임스페이스**: carbonet-prod
- **설정 상태**: securityContext 미설정

## 문제 분석
AI 에이전트가 파일 생성 시 UID/GID 불일치로 소유권 문제 발생

## 구현 계획

### Phase 1: SecurityContext 기본 설정
**대상**: carbonet-runtime deployment
```yaml
securityContext:
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  runAsNonRoot: true
```

### Phase 2: Kyverno 정책 enforcement
**적용**: cluster-wide
- 모든 Pod에 runAsUser/runAsGroup 강제
- fsGroup 필수 설정

### Phase 3: Init Container 보정 (선택)
이미 생성된 파일에 대한 소유권 정정