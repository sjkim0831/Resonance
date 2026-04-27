#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-external-monitoring-bootstrap.sh [base-url]

Purpose:
  Verify that /admin/external/monitoring uses bootstrap payload on first entry
  against the running local service.

Environment overrides:
  PORT
  CONFIG_DIR
  ENV_FILE
  RUNTIME_LOG
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/ops/scripts/runtime-url-common.sh"
RUNTIME_LOG="${RUNTIME_LOG:-/tmp/carbonet-runtime-18000.log}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
PORT="${PORT:-18000}"
ENV_FILE="${ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.env}"
TMP_DIR="$(mktemp -d /tmp/external-monitoring-bootstrap.XXXXXX)"
CLASSPATH_FILE="$TMP_DIR/runtime.classpath"
JAVA_SOURCE="$TMP_DIR/ForgeExternalMonitoringToken.java"
JAVA_CLASS_DIR="$TMP_DIR/classes"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "[verify-external-monitoring-bootstrap] FAIL: $*" >&2
  exit 1
}

info() {
  echo "[verify-external-monitoring-bootstrap] $*"
}

load_optional_env() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

retry_curl() {
  local output_file="$1"
  shift
  local attempt
  for attempt in $(seq 1 20); do
    if curl "${CARBONET_CURL_ARGS[@]}" -fsS "$@" > "$output_file"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "required file not found: $path"
}

require_cmd() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || fail "required command not found: $name"
}

require_cmd curl
require_cmd mvn
require_cmd javac
require_cmd java
require_cmd rg

require_file "$ROOT_DIR/pom.xml"
require_file "$ROOT_DIR/target/classes/egovframework/com/feature/auth/util/JwtTokenProvider.class"
require_file "$RUNTIME_LOG"

load_optional_env "$ENV_FILE"
TOKEN_ACCESS_SECRET="${TOKEN_ACCESS_SECRET:-change-me-access-secret}"
TOKEN_REFRESH_SECRET="${TOKEN_REFRESH_SECRET:-change-me-refresh-secret}"
BASE_URL="${1:-$(carbonet_runtime_base_url)}"
carbonet_set_curl_args

mkdir -p "$JAVA_CLASS_DIR"

info "building runtime classpath"
mvn -q -f "$ROOT_DIR/pom.xml" -DincludeScope=runtime dependency:build-classpath "-Dmdep.outputFile=$CLASSPATH_FILE" >/dev/null
require_file "$CLASSPATH_FILE"

cat > "$JAVA_SOURCE" <<'EOF'
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import org.egovframe.boot.crypto.EgovCryptoConfiguration;
import org.egovframe.boot.crypto.EgovCryptoProperties;
import org.egovframe.boot.crypto.service.impl.EgovEnvCryptoServiceImpl;

public class ForgeExternalMonitoringToken {
    public static void main(String[] args) {
        String accessSecret = args.length > 0 ? args[0] : "change-me-access-secret";
        String refreshSecret = args.length > 1 ? args[1] : "change-me-refresh-secret";
        EgovCryptoProperties props = new EgovCryptoProperties();
        props.setAlgorithm("SHA-256");
        props.setAlgorithmKey("egovframe");
        props.setAlgorithmKeyHash("gdyYs/IZqY86VcWhT8emCYfqY1ahw2vtLG+/FzNqtrQ=");

        EgovEnvCryptoServiceImpl crypto = new EgovCryptoConfiguration(props).egovEnvCryptoService();
        JwtTokenProvider provider = new JwtTokenProvider(crypto);

        LoginResponseDTO dto = new LoginResponseDTO();
        dto.setUserId("webmaster");
        dto.setName("");
        dto.setUniqId("");
        dto.setAuthorList("");

        try {
            for (String[] item : new String[][] {
                {"accessSecret", accessSecret},
                {"refreshSecret", refreshSecret},
                {"accessExpiration", "3600000"},
                {"refreshExpiration", "3600000"}
            }) {
                java.lang.reflect.Field field = JwtTokenProvider.class.getDeclaredField(item[0]);
                field.setAccessible(true);
                field.set(provider, item[1]);
            }
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }

        System.out.println(provider.createAccessToken(dto));
    }
}
EOF

javac -cp "$ROOT_DIR/target/classes:$(cat "$CLASSPATH_FILE")" -d "$JAVA_CLASS_DIR" "$JAVA_SOURCE"
ACCESS_TOKEN="$(java -cp "$JAVA_CLASS_DIR:$ROOT_DIR/target/classes:$(cat "$CLASSPATH_FILE")" ForgeExternalMonitoringToken "$TOKEN_ACCESS_SECRET" "$TOKEN_REFRESH_SECRET" | tr -d '\r\n')"
[[ -n "$ACCESS_TOKEN" ]] || fail "failed to forge access token"

COOKIE_HEADER="Cookie: accessToken=$ACCESS_TOKEN"
LOG_MARKER="$(date '+%Y-%m-%d %H:%M:%S')"
info "using log marker $LOG_MARKER"

SESSION_JSON="$TMP_DIR/session.json"
HTML_FILE="$TMP_DIR/external-monitoring.html"
BOOTSTRAP_JSON="$TMP_DIR/bootstrap.json"
NEW_LOG_LINES="$TMP_DIR/new-log-lines.txt"

info "verifying authenticated frontend session"
retry_curl "$SESSION_JSON" -H "$COOKIE_HEADER" "$BASE_URL/api/frontend/session" || fail "frontend session request failed"
rg -q '"authenticated"[[:space:]]*:[[:space:]]*true' "$SESSION_JSON" || fail "frontend session is not authenticated"
rg -q '"actualUserId"[[:space:]]*:[[:space:]]*"webmaster"' "$SESSION_JSON" || fail "frontend session actualUserId is not webmaster"
rg -q '"authorCode"[[:space:]]*:[[:space:]]*"ROLE_SYSTEM_MASTER"' "$SESSION_JSON" || fail "frontend session authorCode is not ROLE_SYSTEM_MASTER"

info "loading admin shell route"
retry_curl "$HTML_FILE" -H "$COOKIE_HEADER" "$BASE_URL/admin/external/monitoring" || fail "admin shell route request failed"
rg -q 'window\.__CARBONET_REACT_BOOTSTRAP__ = config\.reactBootstrapPayload \|\| \{\};' "$HTML_FILE" || fail "admin shell bootstrap assignment is missing"

info "loading route bootstrap payload"
retry_curl "$BOOTSTRAP_JSON" -H "$COOKIE_HEADER" "$BASE_URL/api/admin/app/bootstrap?route=external-monitoring" || fail "bootstrap payload request failed"
rg -q '"reactRoute"[[:space:]]*:[[:space:]]*"external-monitoring"' "$BOOTSTRAP_JSON" || fail "bootstrap route is not external-monitoring"
rg -q '"externalMonitoringPageData"' "$BOOTSTRAP_JSON" || fail "externalMonitoringPageData is missing from bootstrap payload"
rg -q '"overallStatus"[[:space:]]*:[[:space:]]*"' "$BOOTSTRAP_JSON" || fail "overallStatus is missing from bootstrap payload"

awk -v marker="$LOG_MARKER" '$0 >= marker { print }' "$RUNTIME_LOG" > "$NEW_LOG_LINES"

info "checking request log window after shell and bootstrap calls"
rg -q 'uri=/admin/external/monitoring, status=200' "$NEW_LOG_LINES" || fail "admin route hit was not observed in runtime log"
rg -q 'uri=/api/admin/app/bootstrap, status=200' "$NEW_LOG_LINES" || fail "bootstrap API hit was not observed in runtime log"
if rg -q 'uri=/admin/external/monitoring/page-data' "$NEW_LOG_LINES"; then
  fail "unexpected /admin/external/monitoring/page-data request observed after shell/bootstrap verification"
fi

info "verification completed"
