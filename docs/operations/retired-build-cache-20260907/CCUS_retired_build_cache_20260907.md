# 폐기 작업본 빌드 캐시 정리

{
  "directories": 26,
  "bytes": 728147425,
  "seconds": 1.7745315372012556,
  "services": {
    "carbonet-production-direct": "active",
    "ccus-postgresql-native": "active",
    "carbonet-dev-proxy": "active"
  }
}

Git 추적 파일이 없고 ignore된 build/node_modules/.gradle 폴더만 삭제. 소스·검수자료·원본 작업본 보존. 운영 서비스 재시작 없음.

/opt/Resonance/var/deploy-worktrees/runtime-build/build
/opt/Resonance/var/deploy-worktrees/runtime-build/.gradle
/opt/Resonance/var/deploy-worktrees/runtime-build/projects/carbonet-frontend/source/node_modules
/opt/Resonance/var/deploy-worktrees/runtime-build/platform/control-plane/backstage/packages/backend/node_modules
/opt/Resonance/var/deploy-worktrees/runtime-build/platform/control-plane/backstage/packages/app/node_modules
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-ops/platform-version-control/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-ops/platform-runtime-control/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/platform-help-content/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/platform-request-contracts/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/carbonet-common-core/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/carbonet-contract-metadata/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/platform-observability-web/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/platform-observability-query/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/platform-observability-payload/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/versioncontrol-core/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/runtimecontrol-core/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/mapper-infra/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/platform-help/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/common-auth/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/stable-execution-gate/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/web-support/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-common/platform-service-contracts/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-builder/screenbuilder-carbonet-adapter/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-builder/screenbuilder-core/build
/opt/Resonance/var/deploy-worktrees/runtime-build/modules/resonance-builder/carbonet-builder-observability/build
/opt/Resonance/var/deploy-worktrees/runtime-build/apps/carbonet-api/build