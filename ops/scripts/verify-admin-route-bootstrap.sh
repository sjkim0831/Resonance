#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-admin-route-bootstrap.sh <route-path> [route-id] [payload-key] [base-url]

Example:
  bash ops/scripts/verify-admin-route-bootstrap.sh /admin/certificate/rec_check certificate-rec-check

Purpose:
  Verify that an authenticated admin route renders through the shell bootstrap path
  and that the matching /api/admin/app/bootstrap response is available.

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

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
ROUTE_PATH="${1:-}"
ROUTE_ID="${2:-}"
PAYLOAD_KEY="${3:-}"
PORT="${PORT:-18000}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
ENV_FILE="${ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.env}"
RUNTIME_LOG="${RUNTIME_LOG:-/tmp/carbonet-runtime-18000.log}"
TARGET_JAR_PATH="${TARGET_JAR_PATH:-$ROOT_DIR/apps/carbonet-app/target/carbonet.jar}"
TMP_DIR="$(mktemp -d /tmp/admin-route-bootstrap.XXXXXX)"
CLASSPATH_FILE="$TMP_DIR/runtime.classpath"
JAVA_SOURCE="$TMP_DIR/ForgeAdminRouteToken.java"
JAVA_CLASS_DIR="$TMP_DIR/classes"
APP_CLASSES_DIR="$TMP_DIR/app-classes"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "[verify-admin-route-bootstrap] FAIL: $*" >&2
  exit 1
}

info() {
  echo "[verify-admin-route-bootstrap] $*"
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

[[ -n "$ROUTE_PATH" ]] || fail "route path is required"
if [[ -z "$ROUTE_ID" ]]; then
  ROUTE_ID="$(basename "$ROUTE_PATH" | tr '_' '-')"
fi

require_cmd curl
require_cmd mvn
require_cmd javac
require_cmd java
require_cmd jar
require_cmd rg

require_file "$ROOT_DIR/pom.xml"
require_file "$RUNTIME_LOG"
require_file "$TARGET_JAR_PATH"

load_optional_env "$ENV_FILE"
TOKEN_ACCESS_SECRET="${TOKEN_ACCESS_SECRET:-change-me-access-secret}"
TOKEN_REFRESH_SECRET="${TOKEN_REFRESH_SECRET:-change-me-refresh-secret}"
BASE_URL="${4:-$(carbonet_runtime_base_url)}"
carbonet_set_curl_args

mkdir -p "$JAVA_CLASS_DIR"
mkdir -p "$APP_CLASSES_DIR"

info "building runtime classpath"
mvn -q -f "$ROOT_DIR/apps/carbonet-app/pom.xml" -DincludeScope=runtime dependency:build-classpath "-Dmdep.outputFile=$CLASSPATH_FILE" >/dev/null
require_file "$CLASSPATH_FILE"
(cd "$APP_CLASSES_DIR" && jar xf "$TARGET_JAR_PATH" BOOT-INF/classes)
APP_COMPILE_CLASSPATH="$APP_CLASSES_DIR/BOOT-INF/classes"
[[ -d "$APP_COMPILE_CLASSPATH" ]] || fail "failed to extract app classes from $TARGET_JAR_PATH"

cat > "$JAVA_SOURCE" <<'EOF'
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import org.egovframe.boot.crypto.EgovCryptoConfiguration;
import org.egovframe.boot.crypto.EgovCryptoProperties;
import org.egovframe.boot.crypto.service.impl.EgovEnvCryptoServiceImpl;

public class ForgeAdminRouteToken {
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

javac -cp "$APP_COMPILE_CLASSPATH:$(cat "$CLASSPATH_FILE")" -d "$JAVA_CLASS_DIR" "$JAVA_SOURCE"
ACCESS_TOKEN="$(java -cp "$JAVA_CLASS_DIR:$APP_COMPILE_CLASSPATH:$(cat "$CLASSPATH_FILE")" ForgeAdminRouteToken "$TOKEN_ACCESS_SECRET" "$TOKEN_REFRESH_SECRET" | tr -d '\r\n')"
[[ -n "$ACCESS_TOKEN" ]] || fail "failed to forge access token"

COOKIE_HEADER="Cookie: accessToken=$ACCESS_TOKEN"
SESSION_JSON="$TMP_DIR/session.json"
HTML_FILE="$TMP_DIR/route.html"
BOOTSTRAP_JSON="$TMP_DIR/bootstrap.json"
NEW_LOG_LINES="$TMP_DIR/new-log-lines.txt"
LOG_MARKER="$(date '+%Y-%m-%d %H:%M:%S')"

info "verifying authenticated frontend session"
retry_curl "$SESSION_JSON" -H "$COOKIE_HEADER" "$BASE_URL/api/frontend/session" || fail "frontend session request failed"
rg -q '"authenticated"[[:space:]]*:[[:space:]]*true' "$SESSION_JSON" || fail "frontend session is not authenticated"
rg -q '"actualUserId"[[:space:]]*:[[:space:]]*"webmaster"' "$SESSION_JSON" || fail "frontend session actualUserId is not webmaster"
rg -q '"authorCode"[[:space:]]*:[[:space:]]*"ROLE_SYSTEM_MASTER"' "$SESSION_JSON" || fail "frontend session authorCode is not ROLE_SYSTEM_MASTER"

info "loading admin shell route"
retry_curl "$HTML_FILE" -H "$COOKIE_HEADER" "$BASE_URL$ROUTE_PATH" || fail "admin shell route request failed"
rg -q 'window\.__CARBONET_REACT_BOOTSTRAP__ = config\.reactBootstrapPayload \|\| \{\};' "$HTML_FILE" || fail "admin shell bootstrap assignment is missing"

info "loading route bootstrap payload"
retry_curl "$BOOTSTRAP_JSON" -H "$COOKIE_HEADER" "$BASE_URL/api/admin/app/bootstrap?route=$ROUTE_ID" || fail "bootstrap payload request failed"
rg -q "\"reactRoute\"[[:space:]]*:[[:space:]]*\"$ROUTE_ID\"" "$BOOTSTRAP_JSON" || fail "bootstrap route is not $ROUTE_ID"
if [[ -n "$PAYLOAD_KEY" ]]; then
  rg -q "\"$PAYLOAD_KEY\"" "$BOOTSTRAP_JSON" || fail "$PAYLOAD_KEY is missing from bootstrap payload"
fi

awk -v marker="$LOG_MARKER" '$0 >= marker { print }' "$RUNTIME_LOG" > "$NEW_LOG_LINES"

info "checking request log window after shell and bootstrap calls"
rg -q "uri=$ROUTE_PATH, status=200" "$NEW_LOG_LINES" || fail "admin route hit was not observed in runtime log"
rg -q 'uri=/api/admin/app/bootstrap, status=200' "$NEW_LOG_LINES" || fail "bootstrap API hit was not observed in runtime log"

info "session OK"
info "shell route OK: $ROUTE_PATH"
info "bootstrap route OK: $ROUTE_ID"
if [[ -n "$PAYLOAD_KEY" ]]; then
  info "bootstrap payload key OK: $PAYLOAD_KEY"
fi
info "verification completed"
