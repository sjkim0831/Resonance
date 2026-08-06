#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/codex/service/AdminMemberPagePayloadService.java"

grep -Fq 'boolean memberManagementMaster = authorityPagePayloadSupport.hasMemberManagementMasterAccess(' "$SOURCE"
grep -Fq 'webmaster || memberManagementMaster' "$SOURCE"
for permission in canViewMemberRegister canUseMemberRegisterIdCheck canUseMemberRegisterOrgSearch canUseMemberRegisterSave; do
  grep -Fq "response.put(\"$permission\", memberManagementMaster || hasFeature(" "$SOURCE"
done

echo 'PASS system master receives member-register feature permissions through the common authority policy'
