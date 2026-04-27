#!/usr/bin/env bash

source "$ROOT_DIR/ops/scripts/runtime-url-common.sh"

emission_fail() {
  echo "[$EMISSION_SCRIPT_NAME] FAIL: $*" >&2
  exit 1
}

emission_info() {
  echo "[$EMISSION_SCRIPT_NAME] $*"
}

emission_load_optional_env() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

emission_require_cmd() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || emission_fail "required command not found: $name"
}

emission_require_file() {
  local path="$1"
  [[ -f "$path" ]] || emission_fail "required file not found: $path"
}

emission_curl_to_file_with_retry() {
  local output_path="$1"
  shift
  local attempt=1
  carbonet_set_curl_args
  while true; do
    if curl "${CARBONET_CURL_ARGS[@]}" -fsS "$@" > "$output_path"; then
      return 0
    fi
    if [[ "$attempt" -ge "$EMISSION_HTTP_RETRIES" ]]; then
      return 1
    fi
    emission_info "retrying HTTP request ($attempt/$EMISSION_HTTP_RETRIES)"
    attempt=$((attempt + 1))
    sleep "$EMISSION_HTTP_RETRY_SECONDS"
  done
}

emission_curl_status_with_retry() {
  local output_path="$1"
  shift
  local attempt=1
  local status=""
  carbonet_set_curl_args
  while true; do
    status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -o "$output_path" -w '%{http_code}' "$@")" && {
      printf '%s\n' "$status"
      return 0
    }
    if [[ "$attempt" -ge "$EMISSION_HTTP_RETRIES" ]]; then
      return 1
    fi
    emission_info "retrying HTTP status request ($attempt/$EMISSION_HTTP_RETRIES)"
    attempt=$((attempt + 1))
    sleep "$EMISSION_HTTP_RETRY_SECONDS"
  done
}

emission_prepare_cached_runtime_artifacts() {
  local classpath_file="$EMISSION_VERIFY_CACHE_DIR/runtime.classpath"
  local java_source="$EMISSION_VERIFY_CACHE_DIR/ForgeEmissionManagementToken.java"
  local java_class_dir="$EMISSION_VERIFY_CACHE_DIR/classes"

  mkdir -p "$EMISSION_VERIFY_CACHE_DIR" "$java_class_dir"

  if [[ ! -f "$classpath_file" || "$ROOT_DIR/pom.xml" -nt "$classpath_file" ]]; then
    emission_info "building runtime classpath"
    mvn -q -f "$ROOT_DIR/pom.xml" -DincludeScope=runtime dependency:build-classpath "-Dmdep.outputFile=$classpath_file" >/dev/null
  else
    emission_info "reusing cached runtime classpath"
  fi
  emission_require_file "$classpath_file"

  local helper_source
  helper_source="$(cat <<'EOF'
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import org.egovframe.boot.crypto.EgovCryptoConfiguration;
import org.egovframe.boot.crypto.EgovCryptoProperties;
import org.egovframe.boot.crypto.service.impl.EgovEnvCryptoServiceImpl;

public class ForgeEmissionManagementToken {
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
        dto.setName("webmaster");
        dto.setUniqId("USRCNFRM_99999999999");
        dto.setAuthorList("ROLE_SYSTEM_MASTER");

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
)"

  if [[ ! -f "$java_source" ]] || [[ "$(cat "$java_source" 2>/dev/null)" != "$helper_source" ]]; then
    printf '%s\n' "$helper_source" > "$java_source"
  fi

  if [[ ! -f "$java_class_dir/ForgeEmissionManagementToken.class" || "$java_source" -nt "$java_class_dir/ForgeEmissionManagementToken.class" || "$ROOT_DIR/target/classes/egovframework/com/feature/auth/util/JwtTokenProvider.class" -nt "$java_class_dir/ForgeEmissionManagementToken.class" ]]; then
    emission_info "compiling emission token helper"
    javac -cp "$ROOT_DIR/target/classes:$(cat "$classpath_file")" -d "$java_class_dir" "$java_source"
  else
    emission_info "reusing cached emission token helper"
  fi
}

emission_create_cookie_jar() {
  local cookie_jar="$1"
  local classpath_file="$EMISSION_VERIFY_CACHE_DIR/runtime.classpath"
  local java_class_dir="$EMISSION_VERIFY_CACHE_DIR/classes"
  local token_access_secret="${TOKEN_ACCESS_SECRET:-change-me-access-secret}"
  local token_refresh_secret="${TOKEN_REFRESH_SECRET:-change-me-refresh-secret}"
  local access_token
  local cookie_host="${CARBONET_RUNTIME_HOST:-127.0.0.1}"

  if [[ -n "${BASE_URL:-}" ]]; then
    cookie_host="${BASE_URL#*://}"
    cookie_host="${cookie_host%%[:/]*}"
  fi

  access_token="$(java -cp "$java_class_dir:$ROOT_DIR/target/classes:$(cat "$classpath_file")" ForgeEmissionManagementToken "$token_access_secret" "$token_refresh_secret" | tr -d '\r\n')"
  [[ -n "$access_token" ]] || emission_fail "failed to forge access token"

  printf '# Netscape HTTP Cookie File\n' > "$cookie_jar"
  printf '%s\tFALSE\t/\tFALSE\t0\taccessToken\t%s\n' "$cookie_host" "$access_token" >> "$cookie_jar"
}

emission_default_scopes_from_metadata() {
  local metadata_file="$1"
  awk -F '\t' 'NF > 0 && $1 !~ /^#/ { print $1 }' "$metadata_file" | paste -sd' ' -
}

emission_metadata_line_for_scope() {
  local metadata_file="$1"
  local scope="$2"
  awk -F '\t' -v requested_scope="$scope" 'NF > 0 && $1 !~ /^#/ && $1 == requested_scope { print $0 }' "$metadata_file"
}

emission_rollout_scope_metadata_file() {
  printf '%s\n' "$ROOT_DIR/ops/fixtures/emission-management-rollout/scopes.tsv"
}

emission_rollout_default_scopes() {
  local metadata_file="$1"
  emission_default_scopes_from_metadata "$metadata_file" 2>/dev/null
}

emission_rollout_fixture_path_for_scope() {
  local metadata_file="$1"
  local fixture_dir="$2"
  local scope="$3"
  local scope_line
  local fixture_name
  scope_line="$(emission_metadata_line_for_scope "$metadata_file" "$scope")"
  [[ -n "$scope_line" ]] || emission_fail "unsupported scope requested: $scope"
  IFS=$'\t' read -r _scope _sub_code _tier _expected_input_var fixture_name <<< "$scope_line"
  printf '%s/%s\n' "$fixture_dir" "$fixture_name"
}

emission_require_allowed_value() {
  local name="$1"
  local actual="$2"
  shift 2
  local allowed=("$@")
  local candidate
  for candidate in "${allowed[@]}"; do
    if [[ "$actual" == "$candidate" ]]; then
      return 0
    fi
  done
  emission_fail "unsupported $name: $actual (allowed: ${allowed[*]})"
}
