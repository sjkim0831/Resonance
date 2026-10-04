# 과거 자동화 등록 폐기

서비스 6개, 타이머 5개 설정 보관 후 등록 제거. 소요 6.2초.
원래 링크 대상 스크립트와 runtime-build 작업본은 삭제하지 않음. 운영 서비스 재시작 없음. reference 변경 없음.
자동 생성·감사·야간검증·자산정리·복구·디스크정리의 해당 systemd 자동 실행은 더 이상 제공하지 않음.
복원 요청 시 before.json과 각 unit 텍스트를 검토하여 다시 등록해야 하며 이번에는 복원하지 않음.

## 대상
- resonance-safe-disk-cleanup.service
- resonance-incremental-screen-generation.service
- resonance-all-process-contract-audit.service
- resonance-full-screen-nightly.service
- resonance-react-asset-prune.service
- resonance-recovery.service
- resonance-safe-disk-cleanup.timer
- resonance-incremental-screen-generation.timer
- resonance-all-process-contract-audit.timer
- resonance-full-screen-nightly.timer
- resonance-react-asset-prune.timer

## 운영 확인
- carbonet-production-direct: active
- ccus-postgresql-native: active
- carbonet-dev-proxy: active
- resonance-shadow-gemma4-e4b: active