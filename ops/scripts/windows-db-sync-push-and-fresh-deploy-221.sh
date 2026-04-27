#!/usr/bin/env bash
set -euo pipefail

resolve_root_dir() {
  if [[ -n "${PROJECT_ROOT:-}" ]] && [[ -d "${PROJECT_ROOT:-}" ]]; then
    printf '%s\n' "$PROJECT_ROOT"
    return 0
  fi

  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local candidate_root
  candidate_root="$(cd "$script_dir/../.." && pwd)"
  if [[ -d "$candidate_root/.git" ]] || [[ -f "$candidate_root/pom.xml" ]]; then
    printf '%s\n' "$candidate_root"
    return 0
  fi

  if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
    printf '%s\n' "$git_root"
    return 0
  fi

  pwd
}

ROOT_DIR="$(resolve_root_dir)"
CONFIG_DIR="$ROOT_DIR/ops/config"
LOG_DIR="$ROOT_DIR/var/logs"
BACKUP_DIR_DEFAULT="/opt/util/cubrid/11.2/backup/sql"
BACKUP_DIR_FALLBACK="$ROOT_DIR/var/backups/db-sync"
BACKUP_RUN_STAMP="${BACKUP_RUN_STAMP:-$(date '+%Y%m%d-%H%M%S')}"
RELEASE_ROOT_DIR_DEFAULT="$ROOT_DIR/var/releases"
TMP_DIR="$ROOT_DIR/var/tmp"
LOG_FILE="$LOG_DIR/windows-db-sync-push-and-fresh-deploy-221.log"
JDBC_JAR_DEFAULT="$HOME/.m2/repository/cubrid/cubrid-jdbc/11.2.0.0035/cubrid-jdbc-11.2.0.0035.jar"

mkdir -p "$LOG_DIR" "$TMP_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

load_optional_env() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

load_optional_env "$CONFIG_DIR/carbonet-18000.env"
load_optional_env "$CONFIG_DIR/deploy-automation.env"

BACKUP_ROOT_DIR="${BACKUP_ROOT_DIR:-${BACKUP_DIR:-$BACKUP_DIR_DEFAULT}}"
BACKUP_RUN_DIR="${BACKUP_RUN_DIR:-$BACKUP_ROOT_DIR/$BACKUP_RUN_STAMP}"
if ! mkdir -p "$BACKUP_RUN_DIR" 2>/dev/null; then
  BACKUP_ROOT_DIR="$BACKUP_DIR_FALLBACK"
  BACKUP_RUN_DIR="$BACKUP_ROOT_DIR/$BACKUP_RUN_STAMP"
  mkdir -p "$BACKUP_RUN_DIR"
fi
BACKUP_DIR="$BACKUP_RUN_DIR"
RELEASE_ROOT_DIR="${RELEASE_ROOT_DIR:-$RELEASE_ROOT_DIR_DEFAULT}"
RELEASE_RUN_DIR="${RELEASE_RUN_DIR:-$RELEASE_ROOT_DIR/$BACKUP_RUN_STAMP}"
mkdir -p "$RELEASE_RUN_DIR"

JDBC_JAR="${JDBC_JAR:-$JDBC_JAR_DEFAULT}"
LOCAL_DB_HOST="${LOCAL_DB_HOST:-${CUBRID_HOST:-127.0.0.1}}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-${CUBRID_PORT:-33000}}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-${CUBRID_DB:-carbonet}}"
LOCAL_DB_USER="${LOCAL_DB_USER:-${CUBRID_USER:-dba}}"
LOCAL_DB_PASSWORD="${LOCAL_DB_PASSWORD:-${CUBRID_PASSWORD:-}}"
LOCAL_DB_URL="${LOCAL_DB_URL:-jdbc:cubrid:${LOCAL_DB_HOST}:${LOCAL_DB_PORT}:${LOCAL_DB_NAME}:::?charset=UTF-8}"

REMOTE_DB_SSH_USER="${REMOTE_DB_SSH_USER:-${REMOTE_CUBRID_SSH_USER:-}}"
REMOTE_DB_SSH_HOST="${REMOTE_DB_SSH_HOST:-${REMOTE_CUBRID_SSH_HOST:-}}"
REMOTE_DB_SSH_PORT="${REMOTE_DB_SSH_PORT:-${REMOTE_CUBRID_SSH_PORT:-22}}"
REMOTE_DB_SSH_PASSWORD="${REMOTE_DB_SSH_PASSWORD:-${REMOTE_CUBRID_SSH_PASSWORD:-}}"
REMOTE_DB_HOST="${REMOTE_DB_HOST:-127.0.0.1}"
REMOTE_DB_PORT="${REMOTE_DB_PORT:-${CUBRID_PORT:-33000}}"
REMOTE_DB_NAME="${REMOTE_DB_NAME:-${LOCAL_DB_NAME}}"
REMOTE_DB_USER="${REMOTE_DB_USER:-${LOCAL_DB_USER}}"
REMOTE_DB_PASSWORD="${REMOTE_DB_PASSWORD:-${LOCAL_DB_PASSWORD}}"
REMOTE_DB_URL="${REMOTE_DB_URL:-jdbc:cubrid:127.0.0.1:${REMOTE_DB_PORT}:${REMOTE_DB_NAME}:::?charset=UTF-8}"
REMOTE_DB_TUNNEL_PORT="${REMOTE_DB_TUNNEL_PORT:-13300}"
REMOTE_DB_SNAPSHOT_ATTEMPTS="${REMOTE_DB_SNAPSHOT_ATTEMPTS:-3}"
REMOTE_DB_SNAPSHOT_RETRY_SECONDS="${REMOTE_DB_SNAPSHOT_RETRY_SECONDS:-10}"
APPLY_MODE="${APPLY_MODE:-sql-files}"
SQL_FILE_LIST_DEFAULT="$ROOT_DIR/docs/sql/20260409_admin_project_version_management_menu.sql:$ROOT_DIR/docs/sql/project_version_governance_schema.sql:$ROOT_DIR/docs/sql/20260413_fleet_common_upgrade_governance.sql:$ROOT_DIR/docs/sql/platform_control_plane_schema.sql"
SQL_FILE_LIST="${SQL_FILE_LIST:-$SQL_FILE_LIST_DEFAULT}"
DB_PATCH_ID="${DB_PATCH_ID:-}"
DB_PATCH_NAME="${DB_PATCH_NAME:-}"
DB_PATCH_SOURCE_ENV="${DB_PATCH_SOURCE_ENV:-local}"
DB_PATCH_TARGET_ENV="${DB_PATCH_TARGET_ENV:-remote}"
DB_PATCH_DIRECTION="${DB_PATCH_DIRECTION:-LOCAL_TO_REMOTE}"
DB_PATCH_RISK_LEVEL="${DB_PATCH_RISK_LEVEL:-HIGH}"
REQUIRE_DB_PATCH_HISTORY="${REQUIRE_DB_PATCH_HISTORY:-true}"

GITHUB_TOKEN="${GITHUB_TOKEN:-${BACKUP_GIT_AUTH_TOKEN:-}}"
GIT_REMOTE_NAME="${GIT_REMOTE_NAME:-origin}"
GIT_BRANCH="${GIT_BRANCH:-$(git -C "$ROOT_DIR" branch --show-current)}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-chore: automated db sync and deploy $(date '+%Y-%m-%d %H:%M:%S')}"

MAIN_REMOTE_USER="${MAIN_REMOTE_USER:-carbonet2026}"
MAIN_REMOTE_HOST="${MAIN_REMOTE_HOST:-136.117.100.221}"
MAIN_REMOTE_PORT="${MAIN_REMOTE_PORT:-22}"
MAIN_REMOTE_PASSWORD="${MAIN_REMOTE_PASSWORD:-}"
MAIN_REMOTE_ROOT="${MAIN_REMOTE_ROOT:-/opt/Resonance}"
MAIN_TARGET="${MAIN_REMOTE_USER}@${MAIN_REMOTE_HOST}"
REPO_URL="${REPO_URL:-$(git -C "$ROOT_DIR" remote get-url "$GIT_REMOTE_NAME")}"

DB_SNAPSHOT_FILE="$BACKUP_DIR/01-local-db-before-deploy-${BACKUP_RUN_STAMP}.sql"
REMOTE_DB_SNAPSHOT_FILE_DEFAULT="$BACKUP_DIR/02-remote-db-before-deploy-${BACKUP_RUN_STAMP}.sql"
REMOTE_DB_AFTER_SQL_SNAPSHOT_FILE_DEFAULT="$BACKUP_DIR/03-remote-db-after-sql-${BACKUP_RUN_STAMP}.sql"
DB_DIFF_LOCAL_TO_REMOTE_FILE_DEFAULT="$BACKUP_DIR/04-schema-diff-local-to-remote-${BACKUP_RUN_STAMP}.sql"
DB_DIFF_REMOTE_TO_LOCAL_FILE_DEFAULT="$BACKUP_DIR/05-schema-diff-remote-to-local-${BACKUP_RUN_STAMP}.sql"
DB_DIFF_VERIFY_LOCAL_TO_REMOTE_FILE_DEFAULT="$BACKUP_DIR/06-schema-diff-verify-local-to-remote-${BACKUP_RUN_STAMP}.sql"
DB_DIFF_VERIFY_REMOTE_TO_LOCAL_FILE_DEFAULT="$BACKUP_DIR/07-schema-diff-verify-remote-to-local-${BACKUP_RUN_STAMP}.sql"
LOCAL_JAR_ARCHIVE_FILE_DEFAULT="$RELEASE_RUN_DIR/carbonet.jar"
SNAPSHOT_FILE="${SNAPSHOT_FILE:-$DB_SNAPSHOT_FILE}"
REMOTE_DB_SNAPSHOT_FILE="${REMOTE_DB_SNAPSHOT_FILE:-$REMOTE_DB_SNAPSHOT_FILE_DEFAULT}"
REMOTE_DB_AFTER_SQL_SNAPSHOT_FILE="${REMOTE_DB_AFTER_SQL_SNAPSHOT_FILE:-$REMOTE_DB_AFTER_SQL_SNAPSHOT_FILE_DEFAULT}"
DB_DIFF_LOCAL_TO_REMOTE_FILE="${DB_DIFF_LOCAL_TO_REMOTE_FILE:-$DB_DIFF_LOCAL_TO_REMOTE_FILE_DEFAULT}"
DB_DIFF_REMOTE_TO_LOCAL_FILE="${DB_DIFF_REMOTE_TO_LOCAL_FILE:-$DB_DIFF_REMOTE_TO_LOCAL_FILE_DEFAULT}"
DB_DIFF_VERIFY_LOCAL_TO_REMOTE_FILE="${DB_DIFF_VERIFY_LOCAL_TO_REMOTE_FILE:-$DB_DIFF_VERIFY_LOCAL_TO_REMOTE_FILE_DEFAULT}"
DB_DIFF_VERIFY_REMOTE_TO_LOCAL_FILE="${DB_DIFF_VERIFY_REMOTE_TO_LOCAL_FILE:-$DB_DIFF_VERIFY_REMOTE_TO_LOCAL_FILE_DEFAULT}"
LOCAL_JAR_ARCHIVE_FILE="${LOCAL_JAR_ARCHIVE_FILE:-$LOCAL_JAR_ARCHIVE_FILE_DEFAULT}"
SKIP_LOCAL_DB_SNAPSHOT="${SKIP_LOCAL_DB_SNAPSHOT:-false}"
SKIP_REMOTE_DB_SNAPSHOT="${SKIP_REMOTE_DB_SNAPSHOT:-false}"
SKIP_REMOTE_DB_AFTER_SQL_SNAPSHOT="${SKIP_REMOTE_DB_AFTER_SQL_SNAPSHOT:-false}"
SKIP_DB_SCHEMA_DIFF="${SKIP_DB_SCHEMA_DIFF:-false}"
APPLY_DB_DIFF_TO_REMOTE="${APPLY_DB_DIFF_TO_REMOTE:-true}"
APPLY_DB_DIFF_TO_LOCAL="${APPLY_DB_DIFF_TO_LOCAL:-true}"
FORCE_DESTRUCTIVE_DB_DIFF="${FORCE_DESTRUCTIVE_DB_DIFF:-false}"
DB_DIFF_DROP_POLICY="${DB_DIFF_DROP_POLICY:-archive}"
FAIL_ON_DB_DIFF_REMAINS="${FAIL_ON_DB_DIFF_REMAINS:-true}"
FAIL_ON_UNTRACKED_DESTRUCTIVE_DIFF="${FAIL_ON_UNTRACKED_DESTRUCTIVE_DIFF:-false}"
SKIP_LOCAL_BUILD_PACKAGE="${SKIP_LOCAL_BUILD_PACKAGE:-false}"
SKIP_GIT_PUSH="${SKIP_GIT_PUSH:-false}"
SKIP_REMOTE_DEPLOY="${SKIP_REMOTE_DEPLOY:-false}"
REMOTE_DEPLOY_MODE="${REMOTE_DEPLOY_MODE:-pull}"
REMOTE_BATCH_TRANSPORT="${REMOTE_BATCH_TRANSPORT:-auto}"
EXECUTION_SOURCE="${EXECUTION_SOURCE:-}"
SIGNED_EXECUTION_REQUEST_ID="${SIGNED_EXECUTION_REQUEST_ID:-}"
POLICY_CHECK_RESULT="${POLICY_CHECK_RESULT:-}"
APPROVED_TARGET_HOSTS="${APPROVED_TARGET_HOSTS:-}"
BREAKGLASS_REASON="${BREAKGLASS_REASON:-}"
BREAKGLASS_APPROVER="${BREAKGLASS_APPROVER:-}"
JAVA_TOOL_SRC="$TMP_DIR/CarbonetJdbcSnapshotTool.java"
JAVA_TOOL_CLASS="$TMP_DIR/CarbonetJdbcSnapshotTool.class"
REMOTE_DB_SSH_PID=""

log() {
  printf '[windows-db-sync-push-and-fresh-deploy-221] %s\n' "$*"
}

fail() {
  printf '[windows-db-sync-push-and-fresh-deploy-221] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "missing required command: $cmd"
}

require_env() {
  local env_name="$1"
  [[ -n "${!env_name:-}" ]] || fail "missing required env: $env_name"
}

require_nonempty_value() {
  local value="$1"
  local label="$2"
  [[ -n "$value" ]] || fail "missing required value: $label"
}

local_port_accepts_tcp() {
  local port="$1"
  bash -lc "exec 3<>/dev/tcp/127.0.0.1/${port}" >/dev/null 2>&1
}

enforce_execution_contract() {
  case "$EXECUTION_SOURCE" in
    page|queue)
      require_nonempty_value "$SIGNED_EXECUTION_REQUEST_ID" "SIGNED_EXECUTION_REQUEST_ID"
      require_nonempty_value "$APPROVED_TARGET_HOSTS" "APPROVED_TARGET_HOSTS"
      case "$POLICY_CHECK_RESULT" in
        PASS|APPROVED)
          ;;
        *)
          fail "POLICY_CHECK_RESULT must be PASS or APPROVED for EXECUTION_SOURCE=$EXECUTION_SOURCE"
          ;;
      esac
      ;;
    breakglass)
      require_nonempty_value "$BREAKGLASS_REASON" "BREAKGLASS_REASON"
      require_nonempty_value "$BREAKGLASS_APPROVER" "BREAKGLASS_APPROVER"
      ;;
    "")
      fail "EXECUTION_SOURCE is required. allowed values: page, queue, breakglass"
      ;;
    *)
      fail "unsupported EXECUTION_SOURCE=$EXECUTION_SOURCE (allowed: page, queue, breakglass)"
      ;;
  esac
  log "execution source contract OK source=$EXECUTION_SOURCE"
}

cleanup() {
  close_remote_db_tunnel
}

close_remote_db_tunnel() {
  if [[ -n "${REMOTE_DB_SSH_PID:-}" ]] && kill -0 "$REMOTE_DB_SSH_PID" 2>/dev/null; then
    kill "$REMOTE_DB_SSH_PID" 2>/dev/null || true
    wait "$REMOTE_DB_SSH_PID" 2>/dev/null || true
  fi
  REMOTE_DB_SSH_PID=""
}

trap cleanup EXIT

build_git_extraheader() {
  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    return 0
  fi
  printf 'AUTHORIZATION: basic %s' "$(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)"
}

build_authenticated_repo_url() {
  local repo_url="$1"
  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    printf '%s' "$repo_url"
    return 0
  fi

  if [[ "$repo_url" =~ ^https://github\.com/(.+)$ ]]; then
    printf 'https://x-access-token:%s@github.com/%s' "$GITHUB_TOKEN" "${BASH_REMATCH[1]}"
    return 0
  fi

  printf '%s' "$repo_url"
}

ensure_java_tool() {
  [[ -f "$JDBC_JAR" ]] || fail "CUBRID JDBC jar not found: $JDBC_JAR"

  cat >"$JAVA_TOOL_SRC" <<'EOF'
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.text.SimpleDateFormat;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class CarbonetJdbcSnapshotTool {
  private static final Set<String> EXCLUDED_DUMP_TABLES = Set.of(
      "access_event",
      "audit_event",
      "trace_event"
  );

  public static void main(String[] args) throws Exception {
    if (args.length < 2) {
      throw new IllegalArgumentException("Usage: CarbonetJdbcSnapshotTool <dump|run|diff> <file>");
    }

    String mode = args[0];
    if ("diff".equals(mode)) {
      if (args.length < 3) {
        throw new IllegalArgumentException("diff requires <localToRemoteFile> <remoteToLocalFile>");
      }
      Class.forName("cubrid.jdbc.driver.CUBRIDDriver");
      try (Connection local = DriverManager.getConnection(
             env("CARBONET_LOCAL_DB_URL", "jdbc:cubrid:127.0.0.1:33000:carbonet:::?charset=UTF-8"),
             env("CARBONET_LOCAL_DB_USER", "dba"),
             env("CARBONET_LOCAL_DB_PASSWORD", ""));
           Connection remote = DriverManager.getConnection(
             env("CARBONET_REMOTE_DB_URL", "jdbc:cubrid:127.0.0.1:13300:carbonet:::?charset=UTF-8"),
             env("CARBONET_REMOTE_DB_USER", "dba"),
             env("CARBONET_REMOTE_DB_PASSWORD", ""))) {
        diffDatabases(local, remote, Path.of(args[1]), Path.of(args[2]));
      }
      return;
    }

    Path file = Path.of(args[1]);
    String url = env("CARBONET_DB_URL", "jdbc:cubrid:127.0.0.1:33000:carbonet:::?charset=UTF-8");
    String user = env("CARBONET_DB_USER", "dba");
    String password = env("CARBONET_DB_PASSWORD", "");

    Class.forName("cubrid.jdbc.driver.CUBRIDDriver");
    try (Connection connection = DriverManager.getConnection(url, user, password)) {
      if ("dump".equals(mode)) {
        dumpDatabase(connection, file);
        return;
      }
      if ("table-exists".equals(mode)) {
        String tableName = args.length >= 3 ? args[2] : "";
        if (tableName.isBlank()) {
          throw new IllegalArgumentException("table-exists requires <tableName>");
        }
        boolean exists = tableExists(connection, tableName);
        System.out.println(exists ? "EXISTS" : "MISSING");
        if (!exists) {
          System.exit(3);
        }
        return;
      }
      if ("run".equals(mode)) {
        runSqlFile(connection, file);
        return;
      }
      if ("ensure-history".equals(mode)) {
        ensurePatchHistoryTable(connection);
        return;
      }
      if ("record-patch".equals(mode)) {
        if (args.length < 9) {
          throw new IllegalArgumentException("record-patch requires <file> <patchId> <patchName> <sourceEnv> <targetEnv> <direction> <riskLevel> <status>");
        }
        ensurePatchHistoryTable(connection);
        recordPatchHistory(connection, args[2], args[3], args[4], args[5], args[6], args[7], args[8], file);
        return;
      }
      if ("patch-exists".equals(mode)) {
        if (args.length < 3) {
          throw new IllegalArgumentException("patch-exists requires <file> <patchId>");
        }
        ensurePatchHistoryTable(connection);
        boolean exists = patchHistoryExists(connection, args[2]);
        System.out.println(exists ? "EXISTS" : "MISSING");
        if (!exists) {
          System.exit(4);
        }
        return;
      }
      throw new IllegalArgumentException("Unsupported mode: " + mode);
    }
  }

  private static String env(String key, String fallback) {
    String value = System.getenv(key);
    return value == null || value.isBlank() ? fallback : value;
  }

  private static void dumpDatabase(Connection connection, Path file) throws Exception {
    List<String> tables = loadUserTables(connection);
    Map<String, Set<String>> dependencies = loadDependencies(connection, tables);
    List<String> insertOrder = topoSort(tables, dependencies);
    List<String> deleteOrder = new ArrayList<>(insertOrder);
    java.util.Collections.reverse(deleteOrder);

    System.out.println("[CarbonetJdbcSnapshotTool] dump start file=" + file);
    System.out.println("[CarbonetJdbcSnapshotTool] user table count=" + tables.size());

    try (BufferedWriter writer = Files.newBufferedWriter(file)) {
      writer.write("-- Carbonet JDBC snapshot\n");
      writer.write("-- generatedAt=" + LocalDateTime.now() + "\n");
      writer.write("-- tableCount=" + tables.size() + "\n\n");
      writer.write("-- excludedTables=" + EXCLUDED_DUMP_TABLES + "\n\n");

      for (String table : deleteOrder) {
        writer.write("DELETE FROM " + quoteIdentifier(table) + ";\n");
      }
      writer.write("\n");

      for (int index = 0; index < insertOrder.size(); index++) {
        String table = insertOrder.get(index);
        System.out.println("[CarbonetJdbcSnapshotTool] dump table " + (index + 1) + "/" + insertOrder.size() + ": " + table);
        int rowCount = dumpTable(connection, table, writer);
        System.out.println("[CarbonetJdbcSnapshotTool] dump table complete " + table + " rows=" + rowCount);
      }

      System.out.println("[CarbonetJdbcSnapshotTool] dump complete file=" + file);
    }
  }

  private static List<String> loadUserTables(Connection connection) throws SQLException {
    DatabaseMetaData meta = connection.getMetaData();
    Set<String> tables = new LinkedHashSet<>();
    try (ResultSet rs = meta.getTables(null, null, "%", new String[] {"TABLE"})) {
      while (rs.next()) {
        String name = rs.getString("TABLE_NAME");
        if (name == null || name.isBlank()) {
          continue;
        }
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.startsWith("db_")) {
          continue;
        }
        if (isExcludedDumpTable(lower)) {
          System.out.println("[CarbonetJdbcSnapshotTool] dump table skipped by policy: " + name);
          continue;
        }
        tables.add(name);
      }
    }
    List<String> ordered = new ArrayList<>(tables);
    ordered.sort(Comparator.naturalOrder());
    return ordered;
  }

  private static boolean isExcludedDumpTable(String lowerTableName) {
    if (EXCLUDED_DUMP_TABLES.contains(lowerTableName)) {
      return true;
    }
    int schemaSeparator = lowerTableName.lastIndexOf('.');
    return schemaSeparator >= 0
        && EXCLUDED_DUMP_TABLES.contains(lowerTableName.substring(schemaSeparator + 1));
  }

  private static boolean tableExists(Connection connection, String tableName) throws SQLException {
    DatabaseMetaData meta = connection.getMetaData();
    List<String> candidates = new ArrayList<>();
    candidates.add(tableName);
    if (tableName.contains(".")) {
      candidates.add(tableName.substring(tableName.indexOf('.') + 1));
    }

    for (String candidate : candidates) {
      try (ResultSet rs = meta.getTables(null, null, candidate, new String[] {"TABLE"})) {
        if (rs.next()) {
          return true;
        }
      }
      try (ResultSet rs = meta.getTables(null, null, candidate.toUpperCase(Locale.ROOT), new String[] {"TABLE"})) {
        if (rs.next()) {
          return true;
        }
      }
    }
    return false;
  }

  private static void ensurePatchHistoryTable(Connection connection) throws SQLException {
    if (tableExists(connection, "DB_PATCH_HISTORY")) {
      return;
    }
    try (Statement statement = connection.createStatement()) {
      statement.execute(
          "CREATE TABLE DB_PATCH_HISTORY ("
              + "PATCH_ID VARCHAR(120) PRIMARY KEY, "
              + "PATCH_NAME VARCHAR(300), "
              + "SOURCE_ENV VARCHAR(40), "
              + "TARGET_ENV VARCHAR(40), "
              + "PATCH_DIRECTION VARCHAR(40), "
              + "RISK_LEVEL VARCHAR(40), "
              + "STATUS VARCHAR(40), "
              + "SQL_FILE_PATH VARCHAR(500), "
              + "SQL_PREVIEW VARCHAR(4000), "
              + "CHECKSUM VARCHAR(128), "
              + "APPLIED_AT DATETIME, "
              + "APPLIED_BY VARCHAR(80), "
              + "RESULT_MESSAGE VARCHAR(4000), "
              + "CREATED_AT DATETIME"
              + ")"
      );
    }
    System.out.println("[CarbonetJdbcSnapshotTool] DB_PATCH_HISTORY created");
  }

  private static void recordPatchHistory(
      Connection connection,
      String patchId,
      String patchName,
      String sourceEnv,
      String targetEnv,
      String direction,
      String riskLevel,
      String status,
      Path sqlFile
  ) throws Exception {
    String sqlText = Files.exists(sqlFile) ? Files.readString(sqlFile) : "";
    String checksum = sha256(sqlText);
    String sqlPreview = sqlText.length() > 3800 ? sqlText.substring(0, 3800) : sqlText;
    String sqlFilePath = sqlFile.toAbsolutePath().toString();
    if (patchHistoryExists(connection, patchId)) {
      try (PreparedStatement ps = connection.prepareStatement(
          "UPDATE DB_PATCH_HISTORY "
              + "SET STATUS=?, SQL_FILE_PATH=?, SQL_PREVIEW=?, CHECKSUM=?, APPLIED_AT=CURRENT_DATETIME, RESULT_MESSAGE=? "
              + "WHERE PATCH_ID=?")) {
        ps.setString(1, status);
        ps.setString(2, sqlFilePath);
        ps.setString(3, sqlPreview);
        ps.setString(4, checksum);
        ps.setString(5, "patch history updated by deploy script");
        ps.setString(6, patchId);
        ps.executeUpdate();
      }
      return;
    }
    try (PreparedStatement ps = connection.prepareStatement(
        "INSERT INTO DB_PATCH_HISTORY ("
            + "PATCH_ID, PATCH_NAME, SOURCE_ENV, TARGET_ENV, PATCH_DIRECTION, RISK_LEVEL, STATUS, "
            + "SQL_FILE_PATH, SQL_PREVIEW, CHECKSUM, APPLIED_AT, APPLIED_BY, RESULT_MESSAGE, CREATED_AT"
            + ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATETIME, ?, ?, CURRENT_DATETIME)")) {
      ps.setString(1, patchId);
      ps.setString(2, patchName);
      ps.setString(3, sourceEnv);
      ps.setString(4, targetEnv);
      ps.setString(5, direction);
      ps.setString(6, riskLevel);
      ps.setString(7, status);
      ps.setString(8, sqlFilePath);
      ps.setString(9, sqlPreview);
      ps.setString(10, checksum);
      ps.setString(11, env("DB_PATCH_APPLIED_BY", "deploy-script"));
      ps.setString(12, "patch history recorded by deploy script");
      ps.executeUpdate();
    }
  }

  private static boolean patchHistoryExists(Connection connection, String patchId) throws SQLException {
    try (PreparedStatement ps = connection.prepareStatement(
        "SELECT PATCH_ID FROM DB_PATCH_HISTORY WHERE PATCH_ID = ?")) {
      ps.setString(1, patchId);
      try (ResultSet rs = ps.executeQuery()) {
        return rs.next();
      }
    }
  }

  private static String sha256(String text) throws Exception {
    java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
    byte[] hash = digest.digest((text == null ? "" : text).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    StringBuilder result = new StringBuilder();
    for (byte b : hash) {
      result.append(String.format("%02x", b));
    }
    return result.toString();
  }

  private static void diffDatabases(Connection local, Connection remote, Path localToRemoteFile, Path remoteToLocalFile) throws Exception {
    Map<String, TableInfo> localTables = loadTableInfo(local);
    Map<String, TableInfo> remoteTables = loadTableInfo(remote);
    writeSchemaPatch(localTables, remoteTables, localToRemoteFile, "local", "remote");
    writeSchemaPatch(remoteTables, localTables, remoteToLocalFile, "remote", "local");
    System.out.println("[CarbonetJdbcSnapshotTool] schema diff complete localToRemote=" + localToRemoteFile);
    System.out.println("[CarbonetJdbcSnapshotTool] schema diff complete remoteToLocal=" + remoteToLocalFile);
  }

  private static Map<String, TableInfo> loadTableInfo(Connection connection) throws SQLException {
    Map<String, TableInfo> tables = new LinkedHashMap<>();
    for (String tableName : loadUserTables(connection)) {
      TableInfo table = new TableInfo(tableName);
      DatabaseMetaData meta = connection.getMetaData();
      try (ResultSet rs = meta.getColumns(null, null, tableName, "%")) {
        while (rs.next()) {
          ColumnInfo column = new ColumnInfo();
          column.name = rs.getString("COLUMN_NAME");
          column.typeName = rs.getString("TYPE_NAME");
          column.size = rs.getInt("COLUMN_SIZE");
          column.scale = rs.getInt("DECIMAL_DIGITS");
          column.nullable = rs.getInt("NULLABLE");
          column.defaultValue = rs.getString("COLUMN_DEF");
          column.sampleValues = sampleColumnValues(connection, tableName, column.name);
          table.columns.put(column.name.toLowerCase(Locale.ROOT), column);
        }
      }
      try (ResultSet rs = meta.getIndexInfo(null, null, tableName, false, false)) {
        while (rs.next()) {
          String indexName = rs.getString("INDEX_NAME");
          String columnName = rs.getString("COLUMN_NAME");
          if (indexName == null || indexName.isBlank() || columnName == null || columnName.isBlank()) {
            continue;
          }
          String lowerIndexName = indexName.toLowerCase(Locale.ROOT);
          if (lowerIndexName.startsWith("pk_") || lowerIndexName.startsWith("fk_")) {
            continue;
          }
          IndexInfo index = table.indexes.computeIfAbsent(lowerIndexName, key -> {
            IndexInfo created = new IndexInfo();
            created.name = indexName;
            try {
              created.unique = !rs.getBoolean("NON_UNIQUE");
            } catch (Exception ignored) {
              created.unique = false;
            }
            return created;
          });
          index.columns.add(columnName);
        }
      }
      tables.put(tableName.toLowerCase(Locale.ROOT), table);
    }
    return tables;
  }

  private static List<String> sampleColumnValues(Connection connection, String tableName, String columnName) {
    int sampleLimit = parseInt(env("DB_DIFF_SAMPLE_LIMIT", "20"), 20);
    if (sampleLimit <= 0) {
      return new ArrayList<>();
    }
    List<String> values = new ArrayList<>();
    String sql = "SELECT " + quoteIdentifier(columnName)
        + " FROM " + quoteIdentifier(tableName)
        + " WHERE " + quoteIdentifier(columnName) + " IS NOT NULL LIMIT " + sampleLimit;
    try (Statement statement = connection.createStatement();
         ResultSet rs = statement.executeQuery(sql)) {
      while (rs.next()) {
        values.add(normalizeSampleValue(rs.getObject(1)));
      }
    } catch (Exception ignored) {
      return new ArrayList<>();
    }
    values.sort(Comparator.naturalOrder());
    return values;
  }

  private static int parseInt(String value, int fallback) {
    try {
      return Integer.parseInt(value);
    } catch (Exception ignored) {
      return fallback;
    }
  }

  private static String normalizeSampleValue(Object value) {
    if (value == null) {
      return "";
    }
    String text = String.valueOf(value).trim();
    if (text.length() > 120) {
      text = text.substring(0, 120);
    }
    return text.toLowerCase(Locale.ROOT);
  }

  private static void writeSchemaPatch(
      Map<String, TableInfo> sourceTables,
      Map<String, TableInfo> targetTables,
      Path file,
      String sourceName,
      String targetName
  ) throws Exception {
    boolean forceDestructive = isTruthy(env("FORCE_DESTRUCTIVE_DB_DIFF", "false"));
    String dropPolicy = env("DB_DIFF_DROP_POLICY", "archive").trim().toLowerCase(Locale.ROOT);
    boolean archiveDrops = !"drop".equals(dropPolicy);
    String archiveSuffix = "_arch_" + env("BACKUP_RUN_STAMP", "run").replaceAll("[^A-Za-z0-9]", "");
    int statementCount = 0;
    try (BufferedWriter writer = Files.newBufferedWriter(file)) {
      writer.write("-- Carbonet DatabaseMetaData schema diff\n");
      writer.write("-- generatedAt=" + LocalDateTime.now() + "\n");
      writer.write("-- source=" + sourceName + "\n");
      writer.write("-- target=" + targetName + "\n");
      writer.write("-- policy=" + (forceDestructive
          ? "FORCE_DESTRUCTIVE auto patch; creates, modifies, and drops schema objects"
          : "auto-applied additive schema patch; non-additive differences are emitted as REVIEW comments") + "\n");
      writer.write("-- dropPolicy=" + (archiveDrops ? "archive-before-drop" : "drop") + "\n");
      writer.write("-- excludedTables=" + EXCLUDED_DUMP_TABLES + "\n\n");

      Map<String, String> renameSourceToTargetTable = forceDestructive
          ? detectTableRenameCandidates(sourceTables, targetTables)
          : new LinkedHashMap<>();
      Set<String> renamedSourceTables = new LinkedHashSet<>(renameSourceToTargetTable.keySet());
      Set<String> renamedTargetTables = new LinkedHashSet<>(renameSourceToTargetTable.values());
      for (Map.Entry<String, String> rename : renameSourceToTargetTable.entrySet()) {
        TableInfo sourceTable = sourceTables.get(rename.getKey());
        TableInfo targetTable = targetTables.get(rename.getValue());
        if (sourceTable == null || targetTable == null) {
          continue;
        }
        writer.write("-- FORCE rename table selected by metadata/sample comparison: "
            + targetTable.name + " -> " + sourceTable.name + "\n");
        writer.write("RENAME TABLE " + quoteIdentifier(targetTable.name)
            + " AS " + quoteIdentifier(sourceTable.name) + ";\n\n");
        statementCount++;
      }

      for (TableInfo sourceTable : sourceTables.values()) {
        String sourceTableKey = sourceTable.name.toLowerCase(Locale.ROOT);
        TableInfo targetTable = renamedSourceTables.contains(sourceTableKey)
            ? targetTables.get(renameSourceToTargetTable.get(sourceTableKey))
            : targetTables.get(sourceTableKey);
        if (targetTable == null) {
          writer.write("-- missing table on " + targetName + ": " + sourceTable.name + "\n");
          writer.write("CREATE TABLE " + quoteIdentifier(sourceTable.name) + " (\n");
          int index = 0;
          for (ColumnInfo column : sourceTable.columns.values()) {
            writer.write("    " + columnDefinition(column));
            index++;
            writer.write(index < sourceTable.columns.size() ? ",\n" : "\n");
          }
          writer.write(");\n\n");
          statementCount++;
          continue;
        }

        Map<String, String> renameSourceToTarget = forceDestructive
            ? detectColumnRenameCandidates(sourceTable, targetTable)
            : new LinkedHashMap<>();
        Set<String> renamedSourceColumns = new LinkedHashSet<>(renameSourceToTarget.keySet());
        Set<String> renamedTargetColumns = new LinkedHashSet<>(renameSourceToTarget.values());
        for (Map.Entry<String, String> rename : renameSourceToTarget.entrySet()) {
          ColumnInfo sourceColumn = sourceTable.columns.get(rename.getKey());
          ColumnInfo targetColumn = targetTable.columns.get(rename.getValue());
          if (sourceColumn == null || targetColumn == null) {
            continue;
          }
          writer.write("-- FORCE rename column selected by metadata/sample comparison: "
              + targetTable.name + "." + targetColumn.name + " -> " + sourceColumn.name + "\n");
          writer.write("-- sourceSample=" + sourceColumn.sampleValues + "\n");
          writer.write("-- targetSample=" + targetColumn.sampleValues + "\n");
          writer.write("ALTER TABLE " + quoteIdentifier(targetTable.name)
              + " RENAME COLUMN " + quoteIdentifier(targetColumn.name)
              + " AS " + quoteIdentifier(sourceColumn.name) + ";\n");
          if (!sameColumnShape(sourceColumn, targetColumn)) {
            if (isUnsupportedCubridDomainChange(sourceColumn, targetColumn)) {
              writer.write("-- REVIEW unsupported CUBRID domain change after rename: "
                  + sourceTable.name + "." + sourceColumn.name + "\n");
              writer.write("-- " + sourceName + ": " + columnDefinition(sourceColumn) + "\n");
              writer.write("-- " + targetName + ": " + columnDefinition(targetColumn) + "\n");
              writer.write("-- manual migration required because CUBRID cannot change this attribute domain in place\n");
            } else {
              writer.write("ALTER TABLE " + quoteIdentifier(targetTable.name)
                  + " MODIFY COLUMN " + columnDefinition(sourceColumn) + ";\n");
            }
          }
          writer.write("\n");
          statementCount++;
        }

        for (ColumnInfo sourceColumn : sourceTable.columns.values()) {
          if (renamedSourceColumns.contains(sourceColumn.name.toLowerCase(Locale.ROOT))) {
            continue;
          }
          ColumnInfo targetColumn = targetTable.columns.get(sourceColumn.name.toLowerCase(Locale.ROOT));
          if (targetColumn == null) {
            writer.write("-- missing column on " + targetName + ": " + sourceTable.name + "." + sourceColumn.name + "\n");
            writer.write("ALTER TABLE " + quoteIdentifier(sourceTable.name)
                + " ADD COLUMN " + columnDefinition(sourceColumn) + ";\n\n");
            statementCount++;
            continue;
          }
          if (!sameColumnShape(sourceColumn, targetColumn)) {
            if (forceDestructive) {
              if (isUnsupportedCubridDomainChange(sourceColumn, targetColumn)) {
                writer.write("-- REVIEW unsupported CUBRID domain change " + sourceTable.name + "." + sourceColumn.name + "\n");
                writer.write("-- " + sourceName + ": " + columnDefinition(sourceColumn) + "\n");
                writer.write("-- " + targetName + ": " + columnDefinition(targetColumn) + "\n");
                writer.write("-- manual migration required because CUBRID cannot change this attribute domain in place\n\n");
              } else {
                writer.write("-- FORCE column differs " + sourceTable.name + "." + sourceColumn.name + "\n");
                writer.write("-- " + sourceName + ": " + columnDefinition(sourceColumn) + "\n");
                writer.write("-- " + targetName + ": " + columnDefinition(targetColumn) + "\n");
                writer.write("ALTER TABLE " + quoteIdentifier(sourceTable.name)
                    + " MODIFY COLUMN " + columnDefinition(sourceColumn) + ";\n\n");
                statementCount++;
              }
            } else {
              writer.write("-- REVIEW column differs " + sourceTable.name + "." + sourceColumn.name + "\n");
              writer.write("-- " + sourceName + ": " + columnDefinition(sourceColumn) + "\n");
              writer.write("-- " + targetName + ": " + columnDefinition(targetColumn) + "\n\n");
            }
          }
        }

        if (forceDestructive) {
          for (ColumnInfo targetColumn : targetTable.columns.values()) {
            if (renamedTargetColumns.contains(targetColumn.name.toLowerCase(Locale.ROOT))) {
              continue;
            }
            if (sourceTable.columns.containsKey(targetColumn.name.toLowerCase(Locale.ROOT))) {
              continue;
            }
            writer.write("-- FORCE drop column absent from " + sourceName + ": "
                + targetTable.name + "." + targetColumn.name + "\n");
            if (archiveDrops) {
              String archiveColumnName = archiveName(targetColumn.name, archiveSuffix);
              writer.write("ALTER TABLE " + quoteIdentifier(targetTable.name)
                  + " RENAME COLUMN " + quoteIdentifier(targetColumn.name)
                  + " AS " + quoteIdentifier(archiveColumnName) + ";\n\n");
            } else {
              writer.write("ALTER TABLE " + quoteIdentifier(targetTable.name)
                  + " DROP COLUMN " + quoteIdentifier(targetColumn.name) + ";\n\n");
            }
            statementCount++;
          }
        }

        for (IndexInfo sourceIndex : sourceTable.indexes.values()) {
          IndexInfo targetIndex = targetTable.indexes.get(sourceIndex.name.toLowerCase(Locale.ROOT));
          if (targetIndex == null) {
            writer.write("-- missing index on " + targetName + ": " + sourceTable.name + "." + sourceIndex.name + "\n");
            writer.write(addIndexStatement(sourceTable.name, sourceIndex) + "\n\n");
            statementCount++;
            continue;
          }
          if (forceDestructive && !sameIndexShape(sourceIndex, targetIndex)) {
            writer.write("-- FORCE replace index differs " + sourceTable.name + "." + sourceIndex.name + "\n");
            writer.write(dropIndexStatement(sourceTable.name, targetIndex) + "\n");
            writer.write(addIndexStatement(sourceTable.name, sourceIndex) + "\n\n");
            statementCount += 2;
          }
        }

        if (forceDestructive) {
          for (IndexInfo targetIndex : targetTable.indexes.values()) {
            if (sourceTable.indexes.containsKey(targetIndex.name.toLowerCase(Locale.ROOT))) {
              continue;
            }
            writer.write("-- FORCE drop index absent from " + sourceName + ": "
                + targetTable.name + "." + targetIndex.name + "\n");
            writer.write(dropIndexStatement(targetTable.name, targetIndex) + "\n\n");
            statementCount++;
          }
        }
      }

      if (forceDestructive) {
        List<TableInfo> extraTargetTables = new ArrayList<>();
        for (TableInfo targetTable : targetTables.values()) {
          if (renamedTargetTables.contains(targetTable.name.toLowerCase(Locale.ROOT))) {
            continue;
          }
          if (!sourceTables.containsKey(targetTable.name.toLowerCase(Locale.ROOT))) {
            extraTargetTables.add(targetTable);
          }
        }
        extraTargetTables.sort((left, right) -> right.name.compareToIgnoreCase(left.name));
        for (TableInfo targetTable : extraTargetTables) {
          writer.write("-- FORCE drop table absent from " + sourceName + ": " + targetTable.name + "\n");
          if (archiveDrops) {
            writer.write("RENAME TABLE " + quoteIdentifier(targetTable.name)
                + " AS " + quoteIdentifier(archiveName(targetTable.name, archiveSuffix)) + ";\n\n");
          } else {
            writer.write("DROP TABLE IF EXISTS " + quoteIdentifier(targetTable.name) + " CASCADE CONSTRAINTS;\n\n");
          }
          statementCount++;
        }
      }

      writer.write("-- statementCount=" + statementCount + "\n");
    }
  }

  private static boolean isTruthy(String value) {
    if (value == null) {
      return false;
    }
    String normalized = value.trim().toLowerCase(Locale.ROOT);
    return "true".equals(normalized) || "1".equals(normalized) || "y".equals(normalized) || "yes".equals(normalized);
  }

  private static String archiveName(String originalName, String suffix) {
    String safe = originalName == null || originalName.isBlank() ? "archived" : originalName.trim();
    int maxBaseLength = Math.max(1, 240 - suffix.length());
    if (safe.length() > maxBaseLength) {
      safe = safe.substring(0, maxBaseLength);
    }
    return safe + suffix;
  }

  private static Map<String, String> detectColumnRenameCandidates(TableInfo sourceTable, TableInfo targetTable) {
    Map<String, String> matches = new LinkedHashMap<>();
    List<ColumnInfo> missingInTarget = new ArrayList<>();
    List<ColumnInfo> extraInTarget = new ArrayList<>();
    for (ColumnInfo sourceColumn : sourceTable.columns.values()) {
      if (!targetTable.columns.containsKey(sourceColumn.name.toLowerCase(Locale.ROOT))) {
        missingInTarget.add(sourceColumn);
      }
    }
    for (ColumnInfo targetColumn : targetTable.columns.values()) {
      if (!sourceTable.columns.containsKey(targetColumn.name.toLowerCase(Locale.ROOT))) {
        extraInTarget.add(targetColumn);
      }
    }

    Set<String> usedTargetColumns = new HashSet<>();
    for (ColumnInfo sourceColumn : missingInTarget) {
      ColumnInfo bestTarget = null;
      int bestScore = 0;
      for (ColumnInfo targetColumn : extraInTarget) {
        String targetKey = targetColumn.name.toLowerCase(Locale.ROOT);
        if (usedTargetColumns.contains(targetKey)) {
          continue;
        }
        int score = renameScore(sourceColumn, targetColumn);
        if (score > bestScore) {
          bestScore = score;
          bestTarget = targetColumn;
        }
      }
      if (bestTarget != null && bestScore >= 80) {
        String sourceKey = sourceColumn.name.toLowerCase(Locale.ROOT);
        String targetKey = bestTarget.name.toLowerCase(Locale.ROOT);
        matches.put(sourceKey, targetKey);
        usedTargetColumns.add(targetKey);
      }
    }
    return matches;
  }

  private static Map<String, String> detectTableRenameCandidates(
      Map<String, TableInfo> sourceTables,
      Map<String, TableInfo> targetTables
  ) {
    Map<String, String> matches = new LinkedHashMap<>();
    List<TableInfo> missingInTarget = new ArrayList<>();
    List<TableInfo> extraInTarget = new ArrayList<>();
    for (Map.Entry<String, TableInfo> sourceEntry : sourceTables.entrySet()) {
      if (!targetTables.containsKey(sourceEntry.getKey())) {
        missingInTarget.add(sourceEntry.getValue());
      }
    }
    for (Map.Entry<String, TableInfo> targetEntry : targetTables.entrySet()) {
      if (!sourceTables.containsKey(targetEntry.getKey())) {
        extraInTarget.add(targetEntry.getValue());
      }
    }

    Set<String> usedTargetTables = new HashSet<>();
    for (TableInfo sourceTable : missingInTarget) {
      TableInfo bestTarget = null;
      int bestScore = 0;
      for (TableInfo targetTable : extraInTarget) {
        String targetKey = targetTable.name.toLowerCase(Locale.ROOT);
        if (usedTargetTables.contains(targetKey)) {
          continue;
        }
        int score = tableRenameScore(sourceTable, targetTable);
        if (score > bestScore) {
          bestScore = score;
          bestTarget = targetTable;
        }
      }
      if (bestTarget != null && bestScore >= 90) {
        String sourceKey = sourceTable.name.toLowerCase(Locale.ROOT);
        String targetKey = bestTarget.name.toLowerCase(Locale.ROOT);
        matches.put(sourceKey, targetKey);
        usedTargetTables.add(targetKey);
      }
    }
    return matches;
  }

  private static int tableRenameScore(TableInfo sourceTable, TableInfo targetTable) {
    int score = nameSimilarityScore(sourceTable.name, targetTable.name);
    int sourceColumnCount = Math.max(1, sourceTable.columns.size());
    int matchedShape = 0;
    int matchedSamples = 0;
    for (ColumnInfo sourceColumn : sourceTable.columns.values()) {
      ColumnInfo targetColumn = targetTable.columns.get(sourceColumn.name.toLowerCase(Locale.ROOT));
      if (targetColumn == null) {
        continue;
      }
      if (sameColumnShape(sourceColumn, targetColumn)) {
        matchedShape++;
      }
      if (sampleSimilarityScore(sourceColumn.sampleValues, targetColumn.sampleValues) >= 25) {
        matchedSamples++;
      }
    }
    score += (int) Math.round(((double) matchedShape / (double) sourceColumnCount) * 55.0d);
    score += (int) Math.round(((double) matchedSamples / (double) sourceColumnCount) * 25.0d);
    return score;
  }

  private static int renameScore(ColumnInfo sourceColumn, ColumnInfo targetColumn) {
    int score = 0;
    if (sameColumnShape(sourceColumn, targetColumn)) {
      score += 45;
    } else if (Objects.equals(normalize(sourceColumn.typeName), normalize(targetColumn.typeName))) {
      score += 25;
    }
    score += nameSimilarityScore(sourceColumn.name, targetColumn.name);
    score += sampleSimilarityScore(sourceColumn.sampleValues, targetColumn.sampleValues);
    return score;
  }

  private static int nameSimilarityScore(String left, String right) {
    String normalizedLeft = normalizeIdentifierForMatch(left);
    String normalizedRight = normalizeIdentifierForMatch(right);
    if (normalizedLeft.equals(normalizedRight)) {
      return 30;
    }
    if (normalizedLeft.contains(normalizedRight) || normalizedRight.contains(normalizedLeft)) {
      return 20;
    }
    int commonPrefix = 0;
    int max = Math.min(normalizedLeft.length(), normalizedRight.length());
    while (commonPrefix < max && normalizedLeft.charAt(commonPrefix) == normalizedRight.charAt(commonPrefix)) {
      commonPrefix++;
    }
    return commonPrefix >= 4 ? 10 : 0;
  }

  private static String normalizeIdentifierForMatch(String value) {
    return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
  }

  private static int sampleSimilarityScore(List<String> left, List<String> right) {
    if (left == null || right == null || left.isEmpty() || right.isEmpty()) {
      return 0;
    }
    Set<String> leftSet = new HashSet<>(left);
    Set<String> rightSet = new HashSet<>(right);
    int intersection = 0;
    for (String value : leftSet) {
      if (rightSet.contains(value)) {
        intersection++;
      }
    }
    int denominator = Math.max(leftSet.size(), rightSet.size());
    if (denominator == 0) {
      return 0;
    }
    double ratio = (double) intersection / (double) denominator;
    if (ratio >= 0.9d) {
      return 35;
    }
    if (ratio >= 0.6d) {
      return 25;
    }
    if (ratio >= 0.3d) {
      return 10;
    }
    return 0;
  }

  private static String columnDefinition(ColumnInfo column) {
    StringBuilder sql = new StringBuilder();
    sql.append(quoteIdentifier(column.name)).append(' ').append(renderColumnType(column));
    if (column.nullable == DatabaseMetaData.columnNoNulls) {
      sql.append(" NOT NULL");
    }
    String normalizedDefault = normalizeDefault(column.defaultValue);
    if (column.defaultValue != null
        && !column.defaultValue.isBlank()
        && !"null".equals(normalizedDefault)) {
      sql.append(" DEFAULT ").append(column.defaultValue.trim());
    }
    return sql.toString();
  }

  private static String renderColumnType(ColumnInfo column) {
    String typeName = column.typeName == null || column.typeName.isBlank() ? "VARCHAR" : column.typeName.trim();
    String lower = typeName.toLowerCase(Locale.ROOT);
    if (lower.contains("char") || lower.contains("bit") || lower.contains("numeric") || lower.contains("decimal")) {
      if (column.size > 0 && column.scale > 0 && (lower.contains("numeric") || lower.contains("decimal"))) {
        return typeName + "(" + column.size + "," + column.scale + ")";
      }
      if (column.size > 0) {
        return typeName + "(" + column.size + ")";
      }
    }
    return typeName;
  }

  private static boolean sameColumnShape(ColumnInfo left, ColumnInfo right) {
    return Objects.equals(normalize(left.typeName), normalize(right.typeName))
        && left.size == right.size
        && left.scale == right.scale
        && left.nullable == right.nullable
        && Objects.equals(normalizeDefault(left.defaultValue), normalizeDefault(right.defaultValue));
  }

  private static boolean sameIndexShape(IndexInfo left, IndexInfo right) {
    return left.unique == right.unique
        && normalizeList(left.columns).equals(normalizeList(right.columns));
  }

  private static boolean isUnsupportedCubridDomainChange(ColumnInfo sourceColumn, ColumnInfo targetColumn) {
    String sourceType = normalize(sourceColumn.typeName);
    String targetType = normalize(targetColumn.typeName);
    if (sourceType.equals(targetType)) {
      return false;
    }
    return (isLobType(sourceType) && isTextualType(targetType))
        || (isLobType(targetType) && isTextualType(sourceType));
  }

  private static boolean isLobType(String typeName) {
    return typeName.contains("clob") || typeName.contains("blob");
  }

  private static boolean isTextualType(String typeName) {
    return typeName.contains("char")
        || typeName.contains("string")
        || typeName.contains("text")
        || typeName.contains("varchar");
  }

  private static List<String> normalizeList(List<String> values) {
    List<String> normalized = new ArrayList<>();
    if (values == null) {
      return normalized;
    }
    for (String value : values) {
      normalized.add(normalize(value));
    }
    return normalized;
  }

  private static String quoteIdentifierList(List<String> values) {
    List<String> quoted = new ArrayList<>();
    if (values != null) {
      for (String value : values) {
        quoted.add(quoteIdentifier(value));
      }
    }
    return String.join(", ", quoted);
  }

  private static String addIndexStatement(String tableName, IndexInfo index) {
    if (index.unique) {
      return "ALTER TABLE " + quoteIdentifier(tableName)
          + " ADD CONSTRAINT " + quoteIdentifier(index.name)
          + " UNIQUE (" + quoteIdentifierList(index.columns) + ");";
    }
    return "ALTER TABLE " + quoteIdentifier(tableName)
        + " ADD INDEX " + quoteIdentifier(index.name)
        + " (" + quoteIdentifierList(index.columns) + ");";
  }

  private static String dropIndexStatement(String tableName, IndexInfo index) {
    if (index.unique) {
      return "ALTER TABLE " + quoteIdentifier(tableName)
          + " DROP CONSTRAINT " + quoteIdentifier(index.name) + ";";
    }
    return "ALTER TABLE " + quoteIdentifier(tableName)
        + " DROP INDEX " + quoteIdentifier(index.name) + ";";
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private static String normalizeDefault(String value) {
    return value == null ? "" : value.trim().replace("'", "").toLowerCase(Locale.ROOT);
  }

  private static final class TableInfo {
    final String name;
    final Map<String, ColumnInfo> columns = new LinkedHashMap<>();
    final Map<String, IndexInfo> indexes = new LinkedHashMap<>();

    TableInfo(String name) {
      this.name = name;
    }
  }

  private static final class ColumnInfo {
    String name;
    String typeName;
    int size;
    int scale;
    int nullable;
    String defaultValue;
    List<String> sampleValues = new ArrayList<>();
  }

  private static final class IndexInfo {
    String name;
    boolean unique;
    List<String> columns = new ArrayList<>();
  }

  private static Map<String, Set<String>> loadDependencies(Connection connection, List<String> tables) throws SQLException {
    DatabaseMetaData meta = connection.getMetaData();
    Set<String> tableSet = new HashSet<>(tables);
    Map<String, Set<String>> dependencies = new LinkedHashMap<>();
    for (String table : tables) {
      dependencies.put(table, new LinkedHashSet<>());
      try (ResultSet rs = meta.getImportedKeys(null, null, table)) {
        while (rs.next()) {
          String parent = rs.getString("PKTABLE_NAME");
          if (parent != null && tableSet.contains(parent) && !Objects.equals(parent, table)) {
            dependencies.get(table).add(parent);
          }
        }
      }
    }
    return dependencies;
  }

  private static List<String> topoSort(List<String> tables, Map<String, Set<String>> dependencies) {
    Map<String, Integer> indegree = new HashMap<>();
    Map<String, Set<String>> reverse = new HashMap<>();
    for (String table : tables) {
      indegree.put(table, 0);
      reverse.put(table, new LinkedHashSet<>());
    }
    for (Map.Entry<String, Set<String>> entry : dependencies.entrySet()) {
      String table = entry.getKey();
      for (String dependency : entry.getValue()) {
        indegree.put(table, indegree.get(table) + 1);
        reverse.get(dependency).add(table);
      }
    }

    ArrayDeque<String> queue = new ArrayDeque<>();
    tables.stream().filter(t -> indegree.get(t) == 0).sorted().forEach(queue::add);

    List<String> ordered = new ArrayList<>();
    while (!queue.isEmpty()) {
      String current = queue.removeFirst();
      ordered.add(current);
      List<String> children = new ArrayList<>(reverse.get(current));
      children.sort(Comparator.naturalOrder());
      for (String child : children) {
        int next = indegree.get(child) - 1;
        indegree.put(child, next);
        if (next == 0) {
          queue.addLast(child);
        }
      }
    }

    if (ordered.size() == tables.size()) {
      return ordered;
    }

    Set<String> unresolved = new LinkedHashSet<>(tables);
    unresolved.removeAll(ordered);
    List<String> remainder = new ArrayList<>(unresolved);
    remainder.sort(Comparator.naturalOrder());
    ordered.addAll(remainder);
    return ordered;
  }

  private static int dumpTable(Connection connection, String table, BufferedWriter writer) throws Exception {
    String sql = "SELECT * FROM " + quoteIdentifier(table);
    try (PreparedStatement ps = connection.prepareStatement(sql);
         ResultSet rs = ps.executeQuery()) {
      ResultSetMetaData md = rs.getMetaData();
      int columnCount = md.getColumnCount();
      List<String> columns = new ArrayList<>();
      for (int index = 1; index <= columnCount; index++) {
        columns.add(md.getColumnLabel(index));
      }

      writer.write("-- table=" + table + "\n");
      int rowCount = 0;
      while (rs.next()) {
        rowCount++;
        writer.write("INSERT INTO " + quoteIdentifier(table) + " (");
        for (int index = 0; index < columns.size(); index++) {
          if (index > 0) {
            writer.write(", ");
          }
          writer.write(quoteIdentifier(columns.get(index)));
        }
        writer.write(") VALUES (");
        for (int index = 1; index <= columnCount; index++) {
          if (index > 1) {
            writer.write(", ");
          }
          writer.write(renderValue(rs.getObject(index)));
        }
        writer.write(");\n");

        if (rowCount % 1000 == 0) {
          System.out.println("[CarbonetJdbcSnapshotTool] dump table progress " + table + " rows=" + rowCount);
        }
      }
      writer.write("-- rows=" + rowCount + "\n\n");
      return rowCount;
    }
  }

  private static String renderValue(Object value) {
    if (value == null) {
      return "NULL";
    }
    if (value instanceof Number && !(value instanceof BigDecimal)) {
      return value.toString();
    }
    if (value instanceof BigDecimal) {
      return ((BigDecimal) value).toPlainString();
    }
    if (value instanceof Boolean) {
      return ((Boolean) value) ? "1" : "0";
    }
    if (value instanceof Timestamp) {
      return "'" + escapeSql(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS").format((Timestamp) value)) + "'";
    }
    if (value instanceof java.sql.Date) {
      return "'" + escapeSql(value.toString()) + "'";
    }
    if (value instanceof Date) {
      return "'" + escapeSql(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format((Date) value)) + "'";
    }
    if (value instanceof byte[]) {
      return "NULL";
    }
    return "'" + escapeSql(String.valueOf(value)) + "'";
  }

  private static String escapeSql(String value) {
    return value
      .replace("\\", "\\\\")
      .replace("'", "''");
  }

  private static String quoteIdentifier(String value) {
    if (value == null) {
      return "\"\"";
    }
    String[] parts = value.split("\\.");
    List<String> quotedParts = new ArrayList<>();
    for (String part : parts) {
      quotedParts.add("\"" + part.replace("\"", "\"\"") + "\"");
    }
    return String.join(".", quotedParts);
  }

  private static void runSqlFile(Connection connection, Path file) throws Exception {
    connection.setAutoCommit(false);
    System.out.println("[CarbonetJdbcSnapshotTool] run start file=" + file);
    try (Statement statement = connection.createStatement()) {
      int index = 0;
      try (BufferedReader reader = Files.newBufferedReader(file)) {
        StringBuilder current = new StringBuilder();
        boolean inString = false;
        String line;
        while ((line = reader.readLine()) != null) {
          String trimmedLine = line.trim();
          if (!inString && (trimmedLine.isEmpty() || trimmedLine.startsWith("--"))) {
            continue;
          }

          current.append(line).append('\n');
          for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            char next = i + 1 < line.length() ? line.charAt(i + 1) : '\0';
            if (ch == '\'') {
              if (next == '\'') {
                i++;
                continue;
              }
              inString = !inString;
            }
          }

          if (!inString && endsWithStatementTerminator(current)) {
            String sql = trimTerminator(current.toString().trim());
            current.setLength(0);
            if (sql.isEmpty()) {
              continue;
            }
            index++;
            if (index <= 20 || index % 1000 == 0) {
              System.out.println("[CarbonetJdbcSnapshotTool] statement " + index);
            }
            boolean hasResult = statement.execute(sql);
            if (hasResult) {
              try (ResultSet rs = statement.getResultSet()) {
                int rowCount = 0;
                while (rs.next()) {
                  rowCount++;
                }
                if (index <= 20 || index % 1000 == 0) {
                  System.out.println("[CarbonetJdbcSnapshotTool] resultRows=" + rowCount);
                }
              }
            } else {
              int updated = statement.getUpdateCount();
              if (updated >= 0 && (index <= 20 || index % 1000 == 0)) {
                System.out.println("[CarbonetJdbcSnapshotTool] updated=" + updated);
              }
            }
          }
        }
        if (current.toString().trim().length() > 0) {
          String sql = trimTerminator(current.toString().trim());
          index++;
          System.out.println("[CarbonetJdbcSnapshotTool] statement " + index);
          boolean hasResult = statement.execute(sql);
          if (hasResult) {
            try (ResultSet rs = statement.getResultSet()) {
              int rowCount = 0;
              while (rs.next()) {
                rowCount++;
              }
              System.out.println("[CarbonetJdbcSnapshotTool] resultRows=" + rowCount);
            }
          } else {
            int updated = statement.getUpdateCount();
            if (updated >= 0) {
              System.out.println("[CarbonetJdbcSnapshotTool] updated=" + updated);
            }
          }
        }
      }
      connection.commit();
      System.out.println("[CarbonetJdbcSnapshotTool] statements total=" + index);
      System.out.println("[CarbonetJdbcSnapshotTool] COMMIT");
    } catch (Exception ex) {
      connection.rollback();
      System.out.println("[CarbonetJdbcSnapshotTool] ROLLBACK due to: " + ex);
      throw ex;
    }
  }

  private static boolean endsWithStatementTerminator(StringBuilder current) {
    int index = current.length() - 1;
    while (index >= 0 && Character.isWhitespace(current.charAt(index))) {
      index--;
    }
    return index >= 0 && current.charAt(index) == ';';
  }

  private static String trimTerminator(String sql) {
    int index = sql.length() - 1;
    while (index >= 0 && Character.isWhitespace(sql.charAt(index))) {
      index--;
    }
    if (index >= 0 && sql.charAt(index) == ';') {
      return sql.substring(0, index).trim();
    }
    return sql;
  }
}
EOF

  javac -cp "$JDBC_JAR" -d "$TMP_DIR" "$JAVA_TOOL_SRC"
}

run_java_tool() {
  local mode="$1"
  local db_url="$2"
  local db_user="$3"
  local db_password="$4"
  local file_path="$5"
  shift 5

  CARBONET_DB_URL="$db_url" \
  CARBONET_DB_USER="$db_user" \
  CARBONET_DB_PASSWORD="$db_password" \
    java -cp "$TMP_DIR:$JDBC_JAR" CarbonetJdbcSnapshotTool "$mode" "$file_path" "$@"
}

ensure_patch_history() {
  local db_url="$1"
  local db_user="$2"
  local db_password="$3"
  run_java_tool ensure-history "$db_url" "$db_user" "$db_password" /dev/null
}

record_patch_history() {
  local db_url="$1"
  local db_user="$2"
  local db_password="$3"
  local sql_file="$4"
  local patch_id="$5"
  local patch_name="$6"
  local source_env="$7"
  local target_env="$8"
  local direction="$9"
  local risk_level="${10}"
  local status="${11}"

  run_java_tool record-patch "$db_url" "$db_user" "$db_password" "$sql_file" \
    "$patch_id" "$patch_name" "$source_env" "$target_env" "$direction" "$risk_level" "$status"
}

verify_patch_history() {
  local db_url="$1"
  local db_user="$2"
  local db_password="$3"
  local patch_id="$4"

  if [[ "$REQUIRE_DB_PATCH_HISTORY" != "true" ]]; then
    log "DB patch history verification skipped by REQUIRE_DB_PATCH_HISTORY=false"
    return 0
  fi

  run_java_tool patch-exists "$db_url" "$db_user" "$db_password" /dev/null "$patch_id" >/dev/null
}

run_java_diff_tool() {
  local local_to_remote_file="$1"
  local remote_to_local_file="$2"
  local remote_url="jdbc:cubrid:127.0.0.1:${REMOTE_DB_TUNNEL_PORT}:${REMOTE_DB_NAME}:::?charset=UTF-8"

  ensure_remote_db_tunnel
  CARBONET_LOCAL_DB_URL="$LOCAL_DB_URL" \
  CARBONET_LOCAL_DB_USER="$LOCAL_DB_USER" \
  CARBONET_LOCAL_DB_PASSWORD="$LOCAL_DB_PASSWORD" \
  CARBONET_REMOTE_DB_URL="$remote_url" \
  CARBONET_REMOTE_DB_USER="$REMOTE_DB_USER" \
  CARBONET_REMOTE_DB_PASSWORD="$REMOTE_DB_PASSWORD" \
  FORCE_DESTRUCTIVE_DB_DIFF="$FORCE_DESTRUCTIVE_DB_DIFF" \
  DB_DIFF_DROP_POLICY="$DB_DIFF_DROP_POLICY" \
  BACKUP_RUN_STAMP="$BACKUP_RUN_STAMP" \
    java -cp "$TMP_DIR:$JDBC_JAR" CarbonetJdbcSnapshotTool diff "$local_to_remote_file" "$remote_to_local_file"
}

remote_db_ssh_cmd() {
  require_env "REMOTE_DB_SSH_USER"
  require_env "REMOTE_DB_SSH_HOST"
  require_env "REMOTE_DB_SSH_PASSWORD"
  sshpass -p "$REMOTE_DB_SSH_PASSWORD" ssh \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -p "$REMOTE_DB_SSH_PORT" \
    "${REMOTE_DB_SSH_USER}@${REMOTE_DB_SSH_HOST}" \
    "$@"
}

remote_db_scp_cmd() {
  require_env "REMOTE_DB_SSH_USER"
  require_env "REMOTE_DB_SSH_HOST"
  require_env "REMOTE_DB_SSH_PASSWORD"
  sshpass -p "$REMOTE_DB_SSH_PASSWORD" scp \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -P "$REMOTE_DB_SSH_PORT" \
    "$@"
}

remote_table_exists_via_csql() {
  local table_name="$1"
  local remote_sql="/tmp/check-table-$$.sql"
  local output=""
  output="$(
    remote_db_ssh_cmd "cat <<'SQL' > '$remote_sql'
SELECT class_name
FROM db_class
WHERE class_name = '${table_name,,}';
SQL
/opt/util/cubrid/11.2/scripts/csql_local.sh -u \"$REMOTE_DB_USER\" \"$REMOTE_DB_NAME\" < '$remote_sql' 2>/dev/null; rm -f '$remote_sql'" || true
  )"
  [[ "$output" == *"'${table_name,,}'"* ]]
}

should_skip_remote_sql_file() {
  local sql_file="$1"
  local base_name=""
  base_name="$(basename "$sql_file")"

  case "$base_name" in
    platform_control_plane_schema.sql)
      if remote_table_exists_via_csql "PROJECT_REGISTRY"; then
        log "remote SQL skipped because PROJECT_REGISTRY already exists: $sql_file"
        return 0
      fi
      ;;
    project_version_governance_schema.sql)
      if remote_table_exists_via_csql "ADAPTER_CHANGE_LOG" && remote_table_exists_via_csql "RELEASE_UNIT_REGISTRY" && remote_table_exists_via_csql "SERVER_DEPLOYMENT_STATE"; then
        log "remote SQL skipped because governance tables already exist: $sql_file"
        return 0
      fi
      ;;
    20260413_fleet_common_upgrade_governance.sql)
      if remote_table_exists_via_csql "ARTIFACT_LOCK" && remote_table_exists_via_csql "PROJECT_COMPATIBILITY_RUN"; then
        log "remote SQL skipped because fleet upgrade governance tables already exist: $sql_file"
        return 0
      fi
      ;;
  esac

  return 1
}

append_artifact_lock_schema_sql() {
  local output_file="$1"
  cat >>"$output_file" <<'SQL'
CREATE TABLE ARTIFACT_LOCK (
    PROJECT_ID       VARCHAR(80) NOT NULL,
    RELEASE_UNIT_ID  VARCHAR(120) NOT NULL,
    GROUP_ID         VARCHAR(160) NOT NULL,
    ARTIFACT_ID      VARCHAR(160) NOT NULL,
    ARTIFACT_VERSION VARCHAR(80) NOT NULL,
    ARTIFACT_SHA256  VARCHAR(128) NOT NULL,
    LOCK_SOURCE      VARCHAR(40),
    CREATED_AT       DATETIME NOT NULL,
    PRIMARY KEY (PROJECT_ID, RELEASE_UNIT_ID, GROUP_ID, ARTIFACT_ID)
);

CREATE INDEX IX_ARTIFACT_LOCK_PROJECT
    ON ARTIFACT_LOCK (PROJECT_ID, CREATED_AT);

SQL
}

append_project_compatibility_run_schema_sql() {
  local output_file="$1"
  cat >>"$output_file" <<'SQL'
CREATE TABLE PROJECT_COMPATIBILITY_RUN (
    RUN_ID                    VARCHAR(120) PRIMARY KEY,
    PROJECT_ID                VARCHAR(80) NOT NULL,
    SOURCE_RELEASE_UNIT_ID    VARCHAR(120),
    TARGET_COMMON_VERSION     VARCHAR(80),
    BUILD_STATUS              VARCHAR(40) NOT NULL,
    ADAPTER_CONTRACT_STATUS   VARCHAR(40) NOT NULL,
    DB_DIFF_STATUS            VARCHAR(40) NOT NULL,
    SMOKE_STATUS              VARCHAR(40) NOT NULL,
    COMPATIBILITY_STATUS      VARCHAR(40) NOT NULL,
    BLOCKING_REASON           VARCHAR(4000),
    ROLLBACK_RELEASE_UNIT_ID  VARCHAR(120),
    TESTED_AT                 DATETIME NOT NULL,
    TESTED_BY                 VARCHAR(80)
);

CREATE INDEX IX_PROJECT_COMPATIBILITY_RUN_PROJECT
    ON PROJECT_COMPATIBILITY_RUN (PROJECT_ID, TESTED_AT);

SQL
}

apply_fleet_governance_schema_to_remote() {
  local generated_sql="$TMP_DIR/fleet-common-upgrade-governance-${BACKUP_RUN_STAMP}.sql"
  local remote_tmp="/tmp/$(basename "$generated_sql")"
  local remote_target="${REMOTE_DB_SSH_USER}@${REMOTE_DB_SSH_HOST}:${remote_tmp}"
  local remote_log="${remote_tmp}.log"

  : >"$generated_sql"
  if ! remote_table_exists_via_csql "ARTIFACT_LOCK"; then
    append_artifact_lock_schema_sql "$generated_sql"
  fi
  if ! remote_table_exists_via_csql "PROJECT_COMPATIBILITY_RUN"; then
    append_project_compatibility_run_schema_sql "$generated_sql"
  fi

  if [[ ! -s "$generated_sql" ]]; then
    log "remote SQL skipped because fleet upgrade governance tables already exist"
    rm -f "$generated_sql"
    return 0
  fi

  log "remote DB apply fleet governance SQL started: $generated_sql"
  remote_db_scp_cmd "$generated_sql" "$remote_target"
  remote_db_ssh_cmd "bash -lc 'set -o pipefail; /opt/util/cubrid/11.2/scripts/csql_local.sh -u \"$REMOTE_DB_USER\" \"$REMOTE_DB_NAME\" < \"$remote_tmp\" 2>&1 | tee \"$remote_log\"; status=\${PIPESTATUS[0]}; if grep -Eq \"SYNTAX ERROR|^ERROR:|Semantic:\" \"$remote_log\"; then exit 1; fi; rm -f \"$remote_tmp\" \"$remote_log\"; exit \$status'"
  rm -f "$generated_sql"
  log "remote DB apply fleet governance SQL completed"
}

backup_local_db() {
  if [[ "$SKIP_LOCAL_DB_SNAPSHOT" == "true" ]]; then
    [[ -f "$SNAPSHOT_FILE" ]] || fail "snapshot file not found for reuse: $SNAPSHOT_FILE"
    log "local DB snapshot skipped; reusing: $SNAPSHOT_FILE"
    publish_snapshot_aliases
    return 0
  fi

  log "local DB snapshot started"
  run_java_tool dump "$LOCAL_DB_URL" "$LOCAL_DB_USER" "$LOCAL_DB_PASSWORD" "$SNAPSHOT_FILE"
  log "local DB snapshot completed: $SNAPSHOT_FILE"
  publish_snapshot_aliases
}

publish_snapshot_aliases() {
  local latest_link="$BACKUP_ROOT_DIR/latest-local-db-snapshot.sql"
  [[ -f "$SNAPSHOT_FILE" ]] || return 0

  ln -sfn "$SNAPSHOT_FILE" "$latest_link"
  log "latest snapshot alias updated: $latest_link -> $SNAPSHOT_FILE"
}

backup_remote_snapshot() {
  local output_file="$1"
  local latest_link="$2"
  local label="$3"
  local remote_url="jdbc:cubrid:127.0.0.1:${REMOTE_DB_TUNNEL_PORT}:${REMOTE_DB_NAME}:::?charset=UTF-8"
  local attempt=1
  local tmp_snapshot=""

  while (( attempt <= REMOTE_DB_SNAPSHOT_ATTEMPTS )); do
    tmp_snapshot="${output_file}.tmp.$$.$attempt"
    rm -f "$tmp_snapshot"
    ensure_remote_db_tunnel
    log "${label} started attempt ${attempt}/${REMOTE_DB_SNAPSHOT_ATTEMPTS}"
    if run_java_tool dump "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$tmp_snapshot"; then
      mv "$tmp_snapshot" "$output_file"
      log "${label} completed: $output_file"
      ln -sfn "$output_file" "$latest_link"
      log "latest ${label} alias updated: $latest_link -> $output_file"
      return 0
    fi
    rm -f "$tmp_snapshot"
    if (( attempt == REMOTE_DB_SNAPSHOT_ATTEMPTS )); then
      fail "${label} failed after ${REMOTE_DB_SNAPSHOT_ATTEMPTS} attempts"
    fi
    log "${label} attempt ${attempt} failed; retrying in ${REMOTE_DB_SNAPSHOT_RETRY_SECONDS}s"
    sleep "$REMOTE_DB_SNAPSHOT_RETRY_SECONDS"
    attempt=$((attempt + 1))
  done
}

backup_remote_db() {
  if [[ "$SKIP_REMOTE_DB_SNAPSHOT" == "true" ]]; then
    log "remote DB snapshot skipped by SKIP_REMOTE_DB_SNAPSHOT=true"
    return 0
  fi

  backup_remote_snapshot \
    "$REMOTE_DB_SNAPSHOT_FILE" \
    "$BACKUP_ROOT_DIR/latest-remote-db-before-deploy.sql" \
    "remote DB snapshot"
}

backup_remote_db_after_sql() {
  if [[ "$SKIP_REMOTE_DB_AFTER_SQL_SNAPSHOT" == "true" ]]; then
    log "remote DB after SQL snapshot skipped by SKIP_REMOTE_DB_AFTER_SQL_SNAPSHOT=true"
    return 0
  fi

  backup_remote_snapshot \
    "$REMOTE_DB_AFTER_SQL_SNAPSHOT_FILE" \
    "$BACKUP_ROOT_DIR/latest-remote-db-after-sql.sql" \
    "remote DB after SQL snapshot"
}

generate_db_schema_diff() {
  if [[ "$SKIP_DB_SCHEMA_DIFF" == "true" ]]; then
    log "DB schema diff skipped by SKIP_DB_SCHEMA_DIFF=true"
    return 0
  fi

  local remote_url="jdbc:cubrid:127.0.0.1:${REMOTE_DB_TUNNEL_PORT}:${REMOTE_DB_NAME}:::?charset=UTF-8"

  log "DB patch history ensure started"
  ensure_patch_history "$LOCAL_DB_URL" "$LOCAL_DB_USER" "$LOCAL_DB_PASSWORD"
  ensure_remote_db_tunnel
  ensure_patch_history "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD"
  log "DB patch history ensure completed"

  log "DB schema diff started"
  run_java_diff_tool "$DB_DIFF_LOCAL_TO_REMOTE_FILE" "$DB_DIFF_REMOTE_TO_LOCAL_FILE"
  log "DB schema diff local->remote file: $DB_DIFF_LOCAL_TO_REMOTE_FILE"
  log "DB schema diff remote->local file: $DB_DIFF_REMOTE_TO_LOCAL_FILE"
}

apply_generated_db_diff_patches() {
  local remote_url="jdbc:cubrid:127.0.0.1:${REMOTE_DB_TUNNEL_PORT}:${REMOTE_DB_NAME}:::?charset=UTF-8"
  local risk_level=""

  if [[ "$APPLY_DB_DIFF_TO_REMOTE" == "true" ]]; then
    ensure_remote_db_tunnel
    [[ -f "$DB_DIFF_LOCAL_TO_REMOTE_FILE" ]] || fail "local->remote DB diff file not found: $DB_DIFF_LOCAL_TO_REMOTE_FILE"
    risk_level="AUTO"
    if has_untracked_destructive_diff "$DB_DIFF_LOCAL_TO_REMOTE_FILE"; then
      risk_level="DESTRUCTIVE"
    fi
    if [[ "$FAIL_ON_UNTRACKED_DESTRUCTIVE_DIFF" == "true" ]] && [[ "$risk_level" == "DESTRUCTIVE" ]]; then
      record_patch_history "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$DB_DIFF_LOCAL_TO_REMOTE_FILE" \
        "dbdiff-${BACKUP_RUN_STAMP}-local-to-remote" "schema diff local to remote" "local" "remote" "LOCAL_TO_REMOTE" "DESTRUCTIVE" "BLOCKED"
      fail "untracked destructive local->remote DB diff detected; review $DB_DIFF_LOCAL_TO_REMOTE_FILE"
    fi
    record_patch_history "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$DB_DIFF_LOCAL_TO_REMOTE_FILE" \
      "dbdiff-${BACKUP_RUN_STAMP}-local-to-remote" "schema diff local to remote" "local" "remote" "LOCAL_TO_REMOTE" "$risk_level" "RUNNING"
    log "DB schema diff local->remote apply started"
    if run_java_tool run "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$DB_DIFF_LOCAL_TO_REMOTE_FILE"; then
      record_patch_history "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$DB_DIFF_LOCAL_TO_REMOTE_FILE" \
        "dbdiff-${BACKUP_RUN_STAMP}-local-to-remote" "schema diff local to remote" "local" "remote" "LOCAL_TO_REMOTE" "$risk_level" "SUCCESS"
    else
      record_patch_history "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$DB_DIFF_LOCAL_TO_REMOTE_FILE" \
        "dbdiff-${BACKUP_RUN_STAMP}-local-to-remote" "schema diff local to remote" "local" "remote" "LOCAL_TO_REMOTE" "$risk_level" "FAILED"
      fail "DB schema diff local->remote apply failed: $DB_DIFF_LOCAL_TO_REMOTE_FILE"
    fi
    log "DB schema diff local->remote apply completed"
  else
    log "DB schema diff local->remote apply skipped by APPLY_DB_DIFF_TO_REMOTE=false"
  fi

  if [[ "$APPLY_DB_DIFF_TO_LOCAL" == "true" ]]; then
    [[ -f "$DB_DIFF_REMOTE_TO_LOCAL_FILE" ]] || fail "remote->local DB diff file not found: $DB_DIFF_REMOTE_TO_LOCAL_FILE"
    risk_level="AUTO"
    if has_untracked_destructive_diff "$DB_DIFF_REMOTE_TO_LOCAL_FILE"; then
      risk_level="DESTRUCTIVE"
    fi
    if [[ "$FAIL_ON_UNTRACKED_DESTRUCTIVE_DIFF" == "true" ]] && [[ "$risk_level" == "DESTRUCTIVE" ]]; then
      record_patch_history "$LOCAL_DB_URL" "$LOCAL_DB_USER" "$LOCAL_DB_PASSWORD" "$DB_DIFF_REMOTE_TO_LOCAL_FILE" \
        "dbdiff-${BACKUP_RUN_STAMP}-remote-to-local" "schema diff remote to local" "remote" "local" "REMOTE_TO_LOCAL" "DESTRUCTIVE" "BLOCKED"
      fail "untracked destructive remote->local DB diff detected; review $DB_DIFF_REMOTE_TO_LOCAL_FILE"
    fi
    record_patch_history "$LOCAL_DB_URL" "$LOCAL_DB_USER" "$LOCAL_DB_PASSWORD" "$DB_DIFF_REMOTE_TO_LOCAL_FILE" \
      "dbdiff-${BACKUP_RUN_STAMP}-remote-to-local" "schema diff remote to local" "remote" "local" "REMOTE_TO_LOCAL" "$risk_level" "RUNNING"
    log "DB schema diff remote->local apply started"
    if run_java_tool run "$LOCAL_DB_URL" "$LOCAL_DB_USER" "$LOCAL_DB_PASSWORD" "$DB_DIFF_REMOTE_TO_LOCAL_FILE"; then
      record_patch_history "$LOCAL_DB_URL" "$LOCAL_DB_USER" "$LOCAL_DB_PASSWORD" "$DB_DIFF_REMOTE_TO_LOCAL_FILE" \
        "dbdiff-${BACKUP_RUN_STAMP}-remote-to-local" "schema diff remote to local" "remote" "local" "REMOTE_TO_LOCAL" "$risk_level" "SUCCESS"
    else
      record_patch_history "$LOCAL_DB_URL" "$LOCAL_DB_USER" "$LOCAL_DB_PASSWORD" "$DB_DIFF_REMOTE_TO_LOCAL_FILE" \
        "dbdiff-${BACKUP_RUN_STAMP}-remote-to-local" "schema diff remote to local" "remote" "local" "REMOTE_TO_LOCAL" "$risk_level" "FAILED"
      fail "DB schema diff remote->local apply failed: $DB_DIFF_REMOTE_TO_LOCAL_FILE"
    fi
    log "DB schema diff remote->local apply completed"
  else
    log "DB schema diff remote->local apply skipped by APPLY_DB_DIFF_TO_LOCAL=false"
  fi
}

count_executable_sql_statements() {
  local sql_file="$1"
  [[ -f "$sql_file" ]] || {
    printf '0'
    return 0
  }
  awk '
    /^[[:space:]]*--/ { next }
    /^[[:space:]]*$/ { next }
    /;[[:space:]]*$/ { count++ }
    END { print count + 0 }
  ' "$sql_file"
}

has_untracked_destructive_diff() {
  local sql_file="$1"
  [[ -f "$sql_file" ]] || return 1
  grep -Eq '^[[:space:]]*(DROP|RENAME|ALTER[[:space:]]+TABLE[[:space:]].*(DROP|MODIFY|RENAME))' "$sql_file"
}

verify_db_schema_diff_closed() {
  if [[ "$FAIL_ON_DB_DIFF_REMAINS" != "true" ]]; then
    log "DB schema diff closure verification skipped by FAIL_ON_DB_DIFF_REMAINS=false"
    return 0
  fi
  if [[ "$SKIP_DB_SCHEMA_DIFF" == "true" ]]; then
    log "DB schema diff closure verification skipped by SKIP_DB_SCHEMA_DIFF=true"
    return 0
  fi

  log "DB schema diff closure verification started"
  run_java_diff_tool "$DB_DIFF_VERIFY_LOCAL_TO_REMOTE_FILE" "$DB_DIFF_VERIFY_REMOTE_TO_LOCAL_FILE"

  local local_to_remote_count=""
  local remote_to_local_count=""
  local_to_remote_count="$(count_executable_sql_statements "$DB_DIFF_VERIFY_LOCAL_TO_REMOTE_FILE")"
  remote_to_local_count="$(count_executable_sql_statements "$DB_DIFF_VERIFY_REMOTE_TO_LOCAL_FILE")"

  log "DB schema diff closure local->remote remaining statements: $local_to_remote_count"
  log "DB schema diff closure remote->local remaining statements: $remote_to_local_count"

  if [[ "$local_to_remote_count" != "0" || "$remote_to_local_count" != "0" ]]; then
    fail "DB schema diff remains after auto patch; review $DB_DIFF_VERIFY_LOCAL_TO_REMOTE_FILE and $DB_DIFF_VERIFY_REMOTE_TO_LOCAL_FILE"
  fi
}

open_remote_db_tunnel() {
  if [[ -n "${REMOTE_DB_SSH_PID:-}" ]] && kill -0 "$REMOTE_DB_SSH_PID" 2>/dev/null; then
    if local_port_accepts_tcp "$REMOTE_DB_TUNNEL_PORT"; then
      return 0
    fi
    log "remote DB tunnel process exists but local port ${REMOTE_DB_TUNNEL_PORT} is closed; reopening tunnel"
    close_remote_db_tunnel
  fi

  require_env "REMOTE_DB_SSH_USER"
  require_env "REMOTE_DB_SSH_HOST"
  require_env "REMOTE_DB_SSH_PASSWORD"

  log "remote DB tunnel started: 127.0.0.1:${REMOTE_DB_TUNNEL_PORT} -> ${REMOTE_DB_HOST}:${REMOTE_DB_PORT}"
  sshpass -p "$REMOTE_DB_SSH_PASSWORD" ssh \
    -N \
    -L "${REMOTE_DB_TUNNEL_PORT}:${REMOTE_DB_HOST}:${REMOTE_DB_PORT}" \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=10 \
    -o ServerAliveCountMax=3 \
    -o TCPKeepAlive=yes \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -p "$REMOTE_DB_SSH_PORT" \
    "${REMOTE_DB_SSH_USER}@${REMOTE_DB_SSH_HOST}" &
  REMOTE_DB_SSH_PID=$!
  sleep 3
  kill -0 "$REMOTE_DB_SSH_PID" 2>/dev/null || fail "remote DB tunnel failed"
  for _ in $(seq 1 10); do
    if local_port_accepts_tcp "$REMOTE_DB_TUNNEL_PORT"; then
      return 0
    fi
    sleep 1
  done
  fail "remote DB tunnel did not open local port 127.0.0.1:${REMOTE_DB_TUNNEL_PORT}; check SSH reachability to ${REMOTE_DB_SSH_HOST}:${REMOTE_DB_SSH_PORT} and remote broker ${REMOTE_DB_HOST}:${REMOTE_DB_PORT}"
}

ensure_remote_db_tunnel() {
  if [[ -n "${REMOTE_DB_SSH_PID:-}" ]] && kill -0 "$REMOTE_DB_SSH_PID" 2>/dev/null; then
    if local_port_accepts_tcp "$REMOTE_DB_TUNNEL_PORT"; then
      return 0
    fi
    log "remote DB tunnel port ${REMOTE_DB_TUNNEL_PORT} is closed; reopening tunnel"
  else
    log "remote DB tunnel process is not running; reopening tunnel"
  fi
  close_remote_db_tunnel
  open_remote_db_tunnel
}

apply_snapshot_to_remote_db() {
  local remote_url="jdbc:cubrid:127.0.0.1:${REMOTE_DB_TUNNEL_PORT}:${REMOTE_DB_NAME}:::?charset=UTF-8"
  ensure_remote_db_tunnel
  log "remote DB apply started"
  run_java_tool run "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$SNAPSHOT_FILE"
  log "remote DB apply completed"
}

remote_table_exists() {
  local table_name="$1"
  local remote_url="jdbc:cubrid:127.0.0.1:${REMOTE_DB_TUNNEL_PORT}:${REMOTE_DB_NAME}:::?charset=UTF-8"
  ensure_remote_db_tunnel
  if run_java_tool table-exists "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" /dev/null "$table_name" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

bootstrap_remote_schema_if_needed() {
  local remote_url="jdbc:cubrid:127.0.0.1:${REMOTE_DB_TUNNEL_PORT}:${REMOTE_DB_NAME}:::?charset=UTF-8"
  local schema_file="$ROOT_DIR/docs/sql/20260328_ip_whitelist_persistence.sql"

  if remote_table_exists "COMTNIPWHITELISTRULE"; then
    log "remote schema already has COMTNIPWHITELISTRULE"
    return 0
  fi

  [[ -f "$schema_file" ]] || fail "missing schema bootstrap file: $schema_file"
  log "remote schema missing COMTNIPWHITELISTRULE; applying bootstrap schema"
  run_java_tool run "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$schema_file"
  log "remote schema bootstrap completed"
}

parse_sql_file_list() {
  IFS=':' read -r -a SQL_FILES <<< "$SQL_FILE_LIST"
  if [[ "${#SQL_FILES[@]}" -eq 0 ]]; then
    fail "no SQL files configured"
  fi
}

apply_configured_sql_files_to_remote_db() {
  local sql_file=""
  local remote_tmp=""
  local remote_target=""
  local remote_log=""
  local remote_url="jdbc:cubrid:127.0.0.1:${REMOTE_DB_TUNNEL_PORT}:${REMOTE_DB_NAME}:::?charset=UTF-8"
  local patch_id=""
  local patch_name=""

  ensure_remote_db_tunnel
  parse_sql_file_list
  for sql_file in "${SQL_FILES[@]}"; do
    [[ -f "$sql_file" ]] || fail "SQL file not found: $sql_file"
    if [[ "$(basename "$sql_file")" == "20260413_fleet_common_upgrade_governance.sql" ]]; then
      apply_fleet_governance_schema_to_remote
      continue
    fi
    if should_skip_remote_sql_file "$sql_file"; then
      continue
    fi
    patch_id="$DB_PATCH_ID"
    if [[ -z "$patch_id" ]]; then
      patch_id="sqlpatch-${BACKUP_RUN_STAMP}-$(basename "$sql_file" | tr -cs 'A-Za-z0-9' '-')"
    elif [[ "${#SQL_FILES[@]}" -gt 1 ]]; then
      patch_id="${patch_id}-$(basename "$sql_file" | tr -cs 'A-Za-z0-9' '-')"
    fi
    patch_name="$DB_PATCH_NAME"
    if [[ -z "$patch_name" ]]; then
      patch_name="configured sql $(basename "$sql_file")"
    elif [[ "${#SQL_FILES[@]}" -gt 1 ]]; then
      patch_name="${patch_name} / $(basename "$sql_file")"
    fi
    record_patch_history "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$sql_file" \
      "$patch_id" "$patch_name" "$DB_PATCH_SOURCE_ENV" "$DB_PATCH_TARGET_ENV" "$DB_PATCH_DIRECTION" "$DB_PATCH_RISK_LEVEL" "RUNNING"
    log "remote DB apply SQL started: $sql_file"
    remote_tmp="/tmp/$(basename "$sql_file")"
    remote_log="/tmp/$(basename "$sql_file").log"
    remote_target="${REMOTE_DB_SSH_USER}@${REMOTE_DB_SSH_HOST}:${remote_tmp}"
    remote_db_scp_cmd "$sql_file" "$remote_target"
    if remote_db_ssh_cmd "bash -lc 'set -o pipefail; /opt/util/cubrid/11.2/scripts/csql_local.sh -u \"$REMOTE_DB_USER\" \"$REMOTE_DB_NAME\" < \"$remote_tmp\" 2>&1 | tee \"$remote_log\"; status=\${PIPESTATUS[0]}; if grep -Eq \"SYNTAX ERROR|^ERROR:|Semantic:\" \"$remote_log\"; then exit 1; fi; rm -f \"$remote_tmp\" \"$remote_log\"; exit \$status'"; then
      record_patch_history "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$sql_file" \
        "$patch_id" "$patch_name" "$DB_PATCH_SOURCE_ENV" "$DB_PATCH_TARGET_ENV" "$DB_PATCH_DIRECTION" "$DB_PATCH_RISK_LEVEL" "SUCCESS"
      verify_patch_history "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$patch_id"
    else
      record_patch_history "$remote_url" "$REMOTE_DB_USER" "$REMOTE_DB_PASSWORD" "$sql_file" \
        "$patch_id" "$patch_name" "$DB_PATCH_SOURCE_ENV" "$DB_PATCH_TARGET_ENV" "$DB_PATCH_DIRECTION" "$DB_PATCH_RISK_LEVEL" "FAILED"
      fail "remote DB apply SQL failed with no successful DB patch history evidence: $sql_file"
    fi
    log "remote DB apply SQL completed: $sql_file"
  done
}

build_package_and_archive_local_jar() {
  if [[ "$SKIP_LOCAL_BUILD_PACKAGE" == "true" ]]; then
    log "local build/package skipped by SKIP_LOCAL_BUILD_PACKAGE=true"
    return 0
  fi

  require_command npm
  require_command mvn

  log "local frontend build started"
  (cd "$ROOT_DIR/frontend" && npm run build)
  log "local frontend build completed"

  log "local backend package started"
  mvn -q -DskipTests package
  log "local backend package completed"

  local target_jar="$ROOT_DIR/apps/carbonet-app/target/carbonet.jar"
  [[ -f "$target_jar" ]] || fail "packaged jar not found: $target_jar"
  cp "$target_jar" "$LOCAL_JAR_ARCHIVE_FILE"
  sha256sum "$LOCAL_JAR_ARCHIVE_FILE" >"${LOCAL_JAR_ARCHIVE_FILE}.sha256"
  git -C "$ROOT_DIR" rev-parse HEAD >"$RELEASE_RUN_DIR/git-commit.txt"
  ln -sfn "$RELEASE_RUN_DIR" "$RELEASE_ROOT_DIR/latest"
  log "local packaged jar archived: $LOCAL_JAR_ARCHIVE_FILE"
}

commit_and_push_all() {
  if [[ "$SKIP_GIT_PUSH" == "true" ]]; then
    log "git add/commit/push skipped by SKIP_GIT_PUSH=true"
    return 0
  fi

  local push_url=""

  log "git add started"
  git -C "$ROOT_DIR" add -A -- . \
    ':(exclude).codex/config.toml' \
    ':(exclude)apps/carbonet-app/target'

  if git -C "$ROOT_DIR" diff --cached --quiet; then
    log "no staged changes; commit skipped"
  else
    log "git commit started"
    git -C "$ROOT_DIR" commit -m "$COMMIT_MESSAGE"
  fi

  push_url="$(build_authenticated_repo_url "$REPO_URL")"
  if [[ "$push_url" != "$REPO_URL" ]]; then
    log "git push started with token url auth"
    git -C "$ROOT_DIR" push "$push_url" "$GIT_BRANCH"
    return 0
  fi

  log "git push started without token override"
  git -C "$ROOT_DIR" push "$GIT_REMOTE_NAME" "$GIT_BRANCH"
}

run_remote_clone_and_restart() {
  if [[ "$SKIP_REMOTE_DEPLOY" == "true" ]]; then
    log "221 remote deploy skipped by SKIP_REMOTE_DEPLOY=true"
    return 0
  fi

  local clone_url=""
  local remote_script=""
  local batch_transport="${REMOTE_BATCH_TRANSPORT:-auto}"
  local mosh_ssh=""
  local mosh_server_cmd=""
  local remote_mode="${REMOTE_DEPLOY_MODE:-pull}"
  local remote_tmp_dir="/tmp/carbonet-jar-mosh-${BACKUP_RUN_STAMP}"
  local remote_scripts=(
    "ops/scripts/build-restart-18000.sh"
    "ops/scripts/restart-18000.sh"
    "ops/scripts/restart-18000-runtime.sh"
    "ops/scripts/stop-18000.sh"
    "ops/scripts/start-18000.sh"
    "ops/scripts/run-18000-supervised.sh"
    "ops/scripts/codex-verify-18000-freshness.sh"
    "ops/scripts/runtime-url-common.sh"
    "ops/scripts/apply-carbonet-duckdns-nginx-backend-tls.sh"
  )

  require_env "MAIN_REMOTE_PASSWORD"

  clone_url="$(build_authenticated_repo_url "$REPO_URL")"
  if [[ "$batch_transport" == "auto" ]]; then
    batch_transport="ssh"
  fi
  case "$batch_transport" in
    ssh|mosh)
      ;;
    *)
      fail "unsupported REMOTE_BATCH_TRANSPORT: $batch_transport (supported: auto, ssh, mosh)"
      ;;
  esac
  mosh_ssh="sshpass -p '$MAIN_REMOTE_PASSWORD' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p $MAIN_REMOTE_PORT"
  if [[ "$remote_mode" == "fresh-clone" ]]; then
    remote_script=$(cat <<EOF
set -euo pipefail
REMOTE_ROOT='$MAIN_REMOTE_ROOT'
BACKUP_ROOT="/tmp/carbonet-preclone-backup-\$(date '+%Y%m%d-%H%M%S')"
mkdir -p "\$BACKUP_ROOT/ops-config"
if [ -d "\$REMOTE_ROOT/ops/config" ]; then
  find "\$REMOTE_ROOT/ops/config" -maxdepth 1 -type f -name '*.env' -exec cp {} "\$BACKUP_ROOT/ops-config/" \;
  if [ -d "\$REMOTE_ROOT/ops/config/certs" ]; then
    cp -a "\$REMOTE_ROOT/ops/config/certs" "\$BACKUP_ROOT/ops-config/"
  fi
fi
rm -rf "\$REMOTE_ROOT"
mkdir -p "\$(dirname "\$REMOTE_ROOT")"
EOF
)

    remote_script+=$'\n'
    remote_script+="git clone --branch '$GIT_BRANCH' --single-branch '$clone_url' \"\$REMOTE_ROOT\""

    remote_script+=$'\n'
    remote_script+=$(cat <<EOF
mkdir -p "\$REMOTE_ROOT/ops/config"
if [ -d "\$BACKUP_ROOT/ops-config" ]; then
  cp -a "\$BACKUP_ROOT/ops-config/." "\$REMOTE_ROOT/ops/config/"
fi
cd "\$REMOTE_ROOT"
if [[ "\${REMOTE_APPLY_NGINX_BACKEND_TLS:-true}" == "true" ]]; then
  bash ops/scripts/apply-carbonet-duckdns-nginx-backend-tls.sh
fi
if command -v npm >/dev/null 2>&1; then
  bash ops/scripts/build-restart-18000.sh
else
  echo "[windows-db-sync-push-and-fresh-deploy-221] npm not found on remote; running backend package + runtime restart"
  mvn -q -pl apps/carbonet-app -am -DskipTests package
  bash ops/scripts/restart-18000-runtime.sh
fi
VERIFY_WAIT_SECONDS="${VERIFY_WAIT_SECONDS:-180}" bash ops/scripts/codex-verify-18000-freshness.sh
EOF
)
  elif [[ "$remote_mode" == "pull" ]]; then
    remote_script=$(cat <<EOF
set -euo pipefail
REMOTE_ROOT='$MAIN_REMOTE_ROOT'
REPO_URL='$clone_url'
BRANCH='$GIT_BRANCH'
if [ ! -d "\$REMOTE_ROOT/.git" ]; then
  echo "[windows-db-sync-push-and-fresh-deploy-221] remote repo missing; falling back to fresh clone"
  BACKUP_ROOT="/tmp/carbonet-preclone-backup-\$(date '+%Y%m%d-%H%M%S')"
  mkdir -p "\$BACKUP_ROOT/ops-config"
  if [ -d "\$REMOTE_ROOT/ops/config" ]; then
    find "\$REMOTE_ROOT/ops/config" -maxdepth 1 -type f -name '*.env' -exec cp {} "\$BACKUP_ROOT/ops-config/" \;
    if [ -d "\$REMOTE_ROOT/ops/config/certs" ]; then
      cp -a "\$REMOTE_ROOT/ops/config/certs" "\$BACKUP_ROOT/ops-config/"
    fi
  fi
  rm -rf "\$REMOTE_ROOT"
  mkdir -p "\$(dirname "\$REMOTE_ROOT")"
  git clone --branch "\$BRANCH" --single-branch "\$REPO_URL" "\$REMOTE_ROOT"
  mkdir -p "\$REMOTE_ROOT/ops/config"
  if [ -d "\$BACKUP_ROOT/ops-config" ]; then
    cp -a "\$BACKUP_ROOT/ops-config/." "\$REMOTE_ROOT/ops/config/"
  fi
else
  cd "\$REMOTE_ROOT"
  git remote set-url origin "\$REPO_URL"
  git fetch origin "\$BRANCH"
  git checkout "\$BRANCH"
  git reset --hard "origin/\$BRANCH"
fi
cd "\$REMOTE_ROOT"
if [[ "\${REMOTE_APPLY_NGINX_BACKEND_TLS:-true}" == "true" ]]; then
  bash ops/scripts/apply-carbonet-duckdns-nginx-backend-tls.sh
fi
if command -v npm >/dev/null 2>&1; then
  bash ops/scripts/build-restart-18000.sh
else
  echo "[windows-db-sync-push-and-fresh-deploy-221] npm not found on remote; running backend package + runtime restart"
  mvn -q -pl apps/carbonet-app -am -DskipTests package
  bash ops/scripts/restart-18000-runtime.sh
fi
VERIFY_WAIT_SECONDS="${VERIFY_WAIT_SECONDS:-180}" bash ops/scripts/codex-verify-18000-freshness.sh
EOF
)
  elif [[ "$remote_mode" == "jar-mosh" ]]; then
    local local_target_jar="$ROOT_DIR/apps/carbonet-app/target/carbonet.jar"
    [[ -f "$local_target_jar" ]] || fail "jar-mosh requires local packaged jar: $local_target_jar"

    log "221 jar-mosh upload started"
    sshpass -p "$MAIN_REMOTE_PASSWORD" ssh \
      -o StrictHostKeyChecking=no \
      -o UserKnownHostsFile=/dev/null \
      -p "$MAIN_REMOTE_PORT" \
      "$MAIN_TARGET" \
      "mkdir -p '$MAIN_REMOTE_ROOT/apps/carbonet-app/target' '$MAIN_REMOTE_ROOT/ops/scripts' '$MAIN_REMOTE_ROOT/ops/config' '$remote_tmp_dir'"
    sshpass -p "$MAIN_REMOTE_PASSWORD" scp \
      -o StrictHostKeyChecking=no \
      -o UserKnownHostsFile=/dev/null \
      -P "$MAIN_REMOTE_PORT" \
      "$local_target_jar" \
      "$MAIN_TARGET:$MAIN_REMOTE_ROOT/apps/carbonet-app/target/carbonet.jar"
    local script_path=""
    for script_path in "${remote_scripts[@]}"; do
      sshpass -p "$MAIN_REMOTE_PASSWORD" scp \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -P "$MAIN_REMOTE_PORT" \
        "$ROOT_DIR/$script_path" \
        "$MAIN_TARGET:$MAIN_REMOTE_ROOT/$script_path"
    done
    if [[ -f "$CONFIG_DIR/deploy-automation.env" ]]; then
      sshpass -p "$MAIN_REMOTE_PASSWORD" scp \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -P "$MAIN_REMOTE_PORT" \
        "$CONFIG_DIR/deploy-automation.env" \
        "$MAIN_TARGET:$MAIN_REMOTE_ROOT/ops/config/deploy-automation.env"
    fi
    remote_script=$(cat <<EOF
set -euo pipefail
cd '$MAIN_REMOTE_ROOT'
if [ -f ops/config/deploy-automation.env ]; then
  chmod 600 ops/config/deploy-automation.env
fi
if [[ "\${REMOTE_APPLY_NGINX_BACKEND_TLS:-true}" == "true" ]]; then
  bash ops/scripts/apply-carbonet-duckdns-nginx-backend-tls.sh
fi
bash ops/scripts/restart-18000-runtime.sh
VERIFY_WAIT_SECONDS="${VERIFY_WAIT_SECONDS:-180}" bash ops/scripts/codex-verify-18000-freshness.sh
EOF
)
  else
    fail "unsupported REMOTE_DEPLOY_MODE: $remote_mode (supported: pull, fresh-clone, jar-mosh)"
  fi

  log "221 remote deploy started mode=$remote_mode"
  if [[ "$batch_transport" == "ssh" ]]; then
    log "221 remote deploy transport=ssh"
    sshpass -p "$MAIN_REMOTE_PASSWORD" ssh \
      -o StrictHostKeyChecking=no \
      -o UserKnownHostsFile=/dev/null \
      -p "$MAIN_REMOTE_PORT" \
      "$MAIN_TARGET" \
      "bash -lc $(printf '%q' "$remote_script")"
    log "221 deploy completed over ssh mode=$remote_mode"
    return 0
  fi

  log "221 remote deploy transport=mosh"
  mosh_server_cmd="bash -lc $(printf '%q' "$remote_script")"
  if MOSH_SSH="$mosh_ssh" mosh --no-init "$MAIN_TARGET" --server="$mosh_server_cmd"; then
    log "221 deploy completed over mosh mode=$remote_mode"
    return 0
  fi

  log "mosh batch execution failed; falling back to ssh mode=$remote_mode"
  sshpass -p "$MAIN_REMOTE_PASSWORD" ssh \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -p "$MAIN_REMOTE_PORT" \
    "$MAIN_TARGET" \
    "bash -lc $(printf '%q' "$remote_script")"
  log "221 deploy completed over ssh fallback mode=$remote_mode"
}

main() {
  log "started at $(date '+%Y-%m-%d %H:%M:%S')"
  require_command git
  require_command javac
  require_command java
  require_command sshpass
  require_command ssh
  require_command mosh

  [[ -n "$GIT_BRANCH" ]] || fail "could not resolve current git branch"

  enforce_execution_contract
  ensure_java_tool
  if [[ "$APPLY_MODE" == "snapshot" ]]; then
    backup_local_db
    open_remote_db_tunnel
    backup_remote_db
    generate_db_schema_diff
    apply_generated_db_diff_patches
    verify_db_schema_diff_closed
    bootstrap_remote_schema_if_needed
    apply_snapshot_to_remote_db
    backup_remote_db_after_sql
  else
    backup_local_db
    open_remote_db_tunnel
    backup_remote_db
    generate_db_schema_diff
    apply_generated_db_diff_patches
    verify_db_schema_diff_closed
    apply_configured_sql_files_to_remote_db
    backup_remote_db_after_sql
  fi
  build_package_and_archive_local_jar
  commit_and_push_all
  run_remote_clone_and_restart

  log "completed at $(date '+%Y-%m-%d %H:%M:%S')"
  log "backup folder: $BACKUP_DIR"
  log "db snapshot file: $SNAPSHOT_FILE"
  log "remote db snapshot file: $REMOTE_DB_SNAPSHOT_FILE"
  log "remote db after SQL snapshot file: $REMOTE_DB_AFTER_SQL_SNAPSHOT_FILE"
  log "db schema diff local->remote file: $DB_DIFF_LOCAL_TO_REMOTE_FILE"
  log "db schema diff remote->local file: $DB_DIFF_REMOTE_TO_LOCAL_FILE"
  log "db schema diff verify local->remote file: $DB_DIFF_VERIFY_LOCAL_TO_REMOTE_FILE"
  log "db schema diff verify remote->local file: $DB_DIFF_VERIFY_REMOTE_TO_LOCAL_FILE"
  log "release folder: $RELEASE_RUN_DIR"
  log "local jar archive file: $LOCAL_JAR_ARCHIVE_FILE"
  log "full log file: $LOG_FILE"
}

main "$@"
