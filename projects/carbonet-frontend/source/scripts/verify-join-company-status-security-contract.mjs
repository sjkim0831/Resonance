import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../");
const read = (relative) => fs.readFileSync(path.resolve(root, relative), "utf8");
const page = read("projects/carbonet-frontend/source/src/features/join-company-status/JoinCompanyStatusMigrationPage.tsx");
const reapplyPage = read("projects/carbonet-frontend/source/src/features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx");
const api = read("projects/carbonet-frontend/source/src/lib/api/join.ts");
const types = read("projects/carbonet-frontend/source/src/lib/api/joinTypes.ts");
const controller = read("modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/web/MemberJoinController.java");
const limiter = read("modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/security/PublicLookupRateLimitService.java");
const migration = read("apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260807134000__close_company_reapplication_public_contract.sql");
const reapplyTest = read("modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/feature/member/MemberCompanyReapplyFlowTest.java");
const nginx = read("ops/k8s/carbonet-web/nginx.conf");
const applicationConfig = read("apps/carbonet-api/src/main/resources/application.yml");
const nginxDeployGate = read("ops/scripts/resonance-carbonet-web-config-apply.sh");
const runtimeE2e = read("ops/scripts/validate-company-reapplication-runtime.sh");
const splitRuntimeManifest = read("manifests/carbonet-split-runtime.yaml");
const clientIpPolicyValidator = read("ops/scripts/validate-carbonet-web-nodeport-client-ip-contract.sh");
const clientIpPolicyTest = read("ops/tests/test-carbonet-web-nodeport-client-ip-contract.sh");
const kubeadmDeploy = read("ops/scripts/deploy-carbonet-kubeadm-k8s.sh");
const buildDeploy = read("ops/scripts/resonance-k8s-build-deploy-80.sh");
const buildDeployV2 = read("ops/scripts/resonance-k8s-build-deploy-80-v2.sh");
const nginxDriftSources = [
  "manifests/carbonet-split-runtime.yaml",
  "ops/config/nginx/carbonet-duckdns.org.conf.example",
  "ops/config/nginx/carbonet2026.duckdns.org.local.conf.template",
  "ops/scripts/apply-carbonet-duckdns-nginx-backend-tls.sh",
  "ops/scripts/update-nginx-project-routing.sh",
  "release/ops/config/nginx/carbonet-duckdns.org.conf.example",
  "release/ops/config/nginx/carbonet2026.duckdns.org.local.conf.template"
].map(read);

const failures = [];
const requireSource = (condition, message) => { if (!condition) failures.push(message); };

requireSource(page.includes('lookupHandle: params.get("lookupHandle") || ""'), "status navigation must accept only an opaque lookup handle");
requireSource(!page.includes("joinCompanyStatusRegisteredContact") && !page.includes('search.set("bizNo"') && !page.includes('search.set("appNo"') && !page.includes('search.set("repName"'), "status URLs/session storage must not contain raw lookup identity");
requireSource(page.includes("fetchJoinCompanyStatusDetail({ lookupHandle:"), "detail refresh must resolve the opaque session handle");
requireSource(page.includes("bizNoPresent") && page.includes("appNoPresent") && page.includes("repNamePresent") && page.includes("registeredContactPresent"), "telemetry must use presence booleans");
requireSource(!/logGovernanceScope[\s\S]{0,500}(bizNo|appNo|repName):\s*(bizNo|appNo|repName)\.trim\(\)/.test(page), "telemetry must not record raw lookup identifiers");
requireSource(!page.includes("verifyAlert") && !page.includes("verifyButton") && !page.includes("본인인증 (휴대폰 등)"), "unimplemented identity-verification control must not be exposed");
requireSource(page.includes("사업자등록번호 또는 신청번호, 대표자명, 가입 시 등록한 연락처"), "UI must explain the three implemented verification factors");
requireSource(page.includes("downloadToken") && !page.includes("downloadInsttFile?fileId"), "download must use only an opaque token");
requireSource(api.includes("postValidatedJoinJson") && api.includes("postJsonWithResponse") && !api.includes("fetchValidatedJoinJson"), "public identity lookup clients must use POST JSON");
requireSource(api.includes("registeredContact: string") && api.includes("lookupHandle: string"), "status API client must support raw POST identity and opaque handle continuation");
requireSource(types.includes("lookupHandle?: string") && types.includes("downloadToken?: string") && !types.includes("fileStrePath?:"), "public status type must expose only opaque grants and allowlisted file fields");
requireSource(controller.includes('@PostMapping(value = "/api/company-status/detail"') && controller.includes('@PostMapping(value = "/api/company-reapply/page"'), "identity-bearing lookup endpoints must be POST-only");
requireSource(controller.includes("@org.springframework.web.bind.annotation.RequestBody Map<String, String> lookup"), "lookup identity must arrive in a JSON request body");
requireSource(controller.includes("issueCompanyLookupHandle") && controller.includes("resolveCompanyLookupGrant"), "server must issue and resolve a short-lived session-bound opaque handle");
requireSource(controller.includes("registerCompanyStatusLookup(session)"), "status session limiter must remain as supplemental protection");
requireSource(controller.includes("enforcePublicLookupRateLimit") && controller.includes("request.getRemoteAddr()") && !controller.includes("X-Forwarded-For"), "global limiter must hash servlet remote address and must not trust X-Forwarded-For");
requireSource(!nginx.includes("$proxy_add_x_forwarded_for") && (nginx.match(/proxy_set_header X-Forwarded-For \$remote_addr;/g) || []).length === 4, "canonical carbonet-web must overwrite inbound X-Forwarded-For in all four proxy locations");
requireSource((nginx.match(/proxy_set_header X-RateLimit-Client-IP \$remote_addr;/g) || []).length === 4, "canonical carbonet-web must overwrite the dedicated client-IP diagnostic header");
requireSource(nginxDriftSources.every((source) => !source.includes("proxy_add_x_forwarded_for") && source.includes("X-Forwarded-For")), "tracked nginx manifests, templates and update scripts must not reintroduce appended X-Forwarded-For");
requireSource(/forward-headers-strategy:\s*native/.test(applicationConfig), "Tomcat native forwarding must convert the sanitized one-hop X-Forwarded-For into getRemoteAddr");
requireSource(nginxDeployGate.includes("proxy_add_x_forwarded_for") && nginxDeployGate.includes('forwarded_count') && nginxDeployGate.includes('rate_client_count'), "carbonet-web config apply must fail closed on unsafe or incomplete forwarding headers");
requireSource(runtimeE2e.includes('X-Forwarded-For: 203.0.113.$index') && runtimeE2e.includes('X-Forwarded-For: 198.51.100.250'), "runtime E2E must prove spoofed X-Forwarded-For values cannot escape the shared rate bucket");
requireSource(/kind:\s*Service[\s\S]*?name:\s*carbonet-web[\s\S]*?type:\s*NodePort[\s\S]*?externalTrafficPolicy:\s*Local/.test(splitRuntimeManifest), "canonical carbonet-web manifest must preserve the original client address with externalTrafficPolicy Local");
requireSource(clientIpPolicyValidator.includes("target_count != 1") && clientIpPolicyValidator.includes("policy_count != 1") && clientIpPolicyValidator.includes("NodePort|Local"), "client-IP policy validator must fail closed on duplicate, missing, non-local, or live drift");
requireSource(clientIpPolicyTest.includes("missing-policy") && clientIpPolicyTest.includes("cluster-policy") && clientIpPolicyTest.includes("duplicate-policy") && clientIpPolicyTest.includes("duplicate-service"), "client-IP policy validator must have mutation regression coverage");
requireSource(nginxDeployGate.includes("validate-carbonet-web-nodeport-client-ip-contract.sh") && nginxDeployGate.includes("--live"), "carbonet-web config deployment must reject an unsafe live Service policy");
requireSource(kubeadmDeploy.includes("validate-carbonet-web-nodeport-client-ip-contract.sh") && buildDeploy.includes("validate-carbonet-web-nodeport-client-ip-contract.sh") && buildDeployV2.includes("validate-carbonet-web-nodeport-client-ip-contract.sh"), "all canonical carbonet-web manifest deploy paths must enforce the client-IP preservation contract");
requireSource(buildDeployV2.includes('if ! bash "$ROOT_DIR/ops/scripts/validate-carbonet-web-nodeport-client-ip-contract.sh"; then') && buildDeployV2.includes('kubectl apply --dry-run=client -f "$ROOT_DIR/manifests/carbonet-split-runtime.yaml" -o json') && buildDeployV2.includes('select(.kind == "Service" and .metadata.name == "carbonet-web")') && buildDeployV2.includes('if length == 1 then .[0]') && buildDeployV2.includes('kubectl apply -f -') && !buildDeployV2.includes('kubectl apply -f "$ROOT_DIR/manifests/carbonet-split-runtime.yaml"') && buildDeployV2.includes('--live --namespace "$NAMESPACE"'), "the active v2 auto-deploy path must extract exactly one carbonet-web Service, reject direct whole-manifest apply and fail closed on live drift");
requireSource(controller.includes('headers.set("Retry-After"') && controller.includes("Decision.unavailable"), "limiter must return Retry-After and fail closed");
requireSource(controller.includes("HttpStatus.GONE") && controller.includes("LEGACY_REAPPLICATION_ENDPOINT_RETIRED"), "legacy form POST must be retired with HTTP 410");
requireSource(controller.includes("Company reapply committed but status lookup handle could not be issued") && controller.includes('String lookupHandle = ""'), "post-commit handle failure must preserve the committed receipt and evidence");
requireSource(reapplyTest.includes("committedEvidenceIsPreservedWhenSessionHandleIssuanceFails") && reapplyTest.includes("session store unavailable"), "post-commit physical evidence preservation must have a failure-injection regression test");
requireSource(limiter.includes("ON CONFLICT(project_id,remote_addr_hash,endpoint_code,window_bucket)") && limiter.includes("RETURNING request_count"), "cross-pod limiter must use atomic PostgreSQL upsert/returning");
requireSource(limiter.includes('MessageDigest.getInstance("SHA-256")') && !limiter.includes("X-Forwarded-For"), "rate ledger must store only SHA-256 remote address hashes");
requireSource(limiter.includes("MAX_LEDGER_ROWS") && limiter.includes("expires_at < current_timestamp") && limiter.includes("LIMIT 1000"), "rate ledger must have bounded TTL cleanup");
requireSource(migration.includes("CREATE TABLE IF NOT EXISTS framework_public_lookup_rate_limit") && migration.includes("PRIMARY KEY(project_id,remote_addr_hash,endpoint_code,window_bucket)"), "rate ledger migration must define the cross-pod bucket key");
requireSource(migration.includes("idx_public_lookup_rate_limit_expiry"), "rate ledger migration must index expiration cleanup");
requireSource(reapplyPage.includes("?lookupHandle=") && !reapplyPage.includes("bizNo: form.bizRegistrationNumber") && !reapplyPage.includes("repName: form.representativeName"), "reapply-to-status navigation must carry only the opaque handle");
requireSource(controller.includes('headers.set("Cache-Control", "no-store")'), "public responses must disable caching");
requireSource(controller.includes('response.setHeader("Cache-Control", "no-store")'), "evidence download must disable caching");

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}
console.log("PASS join-company-status-security checks=40 transport=POST handle=session-bound rateLimit=cross-pod+session clientIp=nodeport-local token=opaque cache=no-store legacy=410");
