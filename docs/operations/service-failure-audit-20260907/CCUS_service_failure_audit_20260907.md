# CCUS 서비스 실패 점검 및 정리 이력

- 확인 시각: 2026-09-07T12:12:55.158690+09:00
- 실패 항목: 35개. 실패 상태 초기화 없이 보존.
- 조치: p006-route-guard.timer 중지 및 비활성화. 기존 서비스/타이머 설정을 같은 폴더에 보관.
- 이유: 과거 Kubernetes carbonet-web 배포 수정 및 재시작을 반복하여 현재 운영 방식과 충돌.
- 웹앱, DB, 모델 서비스는 재시작하지 않음. /opt/reference 변경 없음.
- 인증서 불일치, 백업 복원훈련, 알림 수집, 자동 테스트 오류는 해결 완료가 아님.
- 디스크 사용률 목표 미달을 성공으로 위장하기 위해 임계값을 낮추지 않음.

## 현재 핵심 서비스
- carbonet-production-direct: active
- ccus-postgresql-native: active
- carbonet-dev-proxy: active
- carbonet-frontend-fast-dev: active
- resonance-p006-web: active
- resonance-shadow-gemma4-e4b: active

## 전체 실패 목록

| 서비스 | 결과 | 종료 코드 | 일시 작업 |
|---|---|---|---|
| carbonet-runtime-alert-collector.path | unit-start-limit-hit |  | no |
| carbonet-dev-design-sync.service | exit-code | 1 | no |
| carbonet-final-worker-dev-f5c636ed6.service | exit-code | 143 | yes |
| carbonet-java-fast-dev.service | start-limit-hit | 0 | no |
| carbonet-manual-postdeploy-recovery-1787275554.service | exit-code | 79 | yes |
| carbonet-postgres-restore-drill.service | exit-code | 2 | no |
| carbonet-process-bundle-dev-8a6773f63.service | exit-code | 143 | yes |
| carbonet-process-bundle-dev-a41567453.service | exit-code | 143 | yes |
| carbonet-production-bootstrap-excluded-v3.service | exit-code | 1 | yes |
| carbonet-reduction-canonical-dev-0dc8e886b.service | exit-code | 143 | yes |
| carbonet-reduction-canonical-dev-9b50d35cd.service | exit-code | 143 | yes |
| carbonet-reduction-canonical-dev-bf3204297.service | exit-code | 143 | yes |
| carbonet-runtime-alert-collector.service | start-limit-hit | 0 | no |
| carbonet-runtime-alert-escalator.service | exit-code | 1 | no |
| ccus-native-db-cutover-v2.service | exit-code | 1 | yes |
| ccus-native-db-cutover.service | exit-code | 1 | yes |
| ccus-native-db-postverify.service | exit-code | 1 | yes |
| hermes-agent-version-tracker.service | exit-code | 127 | no |
| p006-route-guard.service | exit-code | 1 | no |
| resonance-all-process-contract-audit.service | exit-code | 2 | no |
| resonance-backstage-full-e2e.service | exit-code | 5 | no |
| resonance-canonical-seven-worker-final.service | exit-code | 1 | yes |
| resonance-canonical-seven-worker.service | exit-code | 1 | yes |
| resonance-clean-root-seven-worker-2.service | exit-code | 1 | yes |
| resonance-clean-root-seven-worker.service | exit-code | 1 | yes |
| resonance-design-asset-snapshot.service | exit-code | 60 | no |
| resonance-full-screen-nightly.service | exit-code | 1 | no |
| resonance-hermes-framework-qwen40-exl3.service | exit-code | 130 | no |
| resonance-internal-ca-verify.service | exit-code | 5 | no |
| resonance-p006-equipment-master.service | exit-code | 0 | no |
| resonance-p006-threshold-escalation.service | exit-code | 3 | no |
| resonance-process-dev-final-449edd.service | exit-code | 1 | yes |
| resonance-process-dev-final-a3535.service | signal | 15 | yes |
| resonance-project-auto-completion.service | exit-code | 75 | no |
| resonance-safe-disk-cleanup.service | exit-code | 1 | no |

## 다음 작업
1. 기존 자동 수정 없는 읽기 전용 P006 경로 점검으로 대체 설계.
2. 운영 네이티브 PostgreSQL 기준 격리 복원훈련 설계 및 알림 수집 경로 점검.
3. Backstage 인증서 체인과 자동 테스트 오류 별도 진단.
4. 과거 실행 실패 기록은 보관 후 사용자 확인하여 정리.

## 검증 한계
서비스 상태 검증이며 로그인/PDF 발급 등 브라우저 E2E를 이번 작업에서 재실행하지 않음.