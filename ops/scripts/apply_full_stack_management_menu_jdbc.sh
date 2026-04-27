#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SQL_FILE="${1:-$ROOT_DIR/docs/sql/20260315_admin_full_stack_management_menu.sql}"
JAVA_FILE="/tmp/ApplyFullStackManagementSql.java"
CLASS_FILE="/tmp/ApplyFullStackManagementSql.class"
JDBC_JAR="${JDBC_JAR:-/root/.m2/repository/cubrid/cubrid-jdbc/11.2.0.0035/cubrid-jdbc-11.2.0.0035.jar}"
DB_URL="${CARBONET_DB_URL:-jdbc:cubrid:localhost:33000:carbonet:::?charset=UTF-8}"
DB_USER="${CARBONET_DB_USER:-dba}"
DB_PASSWORD="${CARBONET_DB_PASSWORD:-}"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "SQL file not found: $SQL_FILE" >&2
  exit 1
fi

if [[ ! -f "$JDBC_JAR" ]]; then
  echo "CUBRID JDBC jar not found: $JDBC_JAR" >&2
  exit 1
fi

cat > "$JAVA_FILE" <<'EOF'
import java.nio.file.*;
import java.sql.*;
import java.util.*;

public class ApplyFullStackManagementSql {
  public static void main(String[] args) throws Exception {
    String url = System.getenv().getOrDefault("CARBONET_DB_URL", "jdbc:cubrid:localhost:33000:carbonet:::?charset=UTF-8");
    String user = System.getenv().getOrDefault("CARBONET_DB_USER", "dba");
    String pass = System.getenv().getOrDefault("CARBONET_DB_PASSWORD", "");
    String sql = Files.readString(Path.of(args[0]));

    List<String> statements = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    for (String line : sql.split("\\R")) {
      String trimmed = line.trim();
      if (trimmed.isEmpty() || trimmed.startsWith("--")) {
        continue;
      }
      current.append(line).append('\n');
      if (trimmed.endsWith(";")) {
        statements.add(current.toString());
        current.setLength(0);
      }
    }

    Class.forName("cubrid.jdbc.driver.CUBRIDDriver");
    try (Connection conn = DriverManager.getConnection(url, user, pass)) {
      conn.setAutoCommit(false);
      try (Statement st = conn.createStatement()) {
        int index = 1;
        for (String statement : statements) {
          String run = statement.trim();
          if (run.endsWith(";")) {
            run = run.substring(0, run.length() - 1);
          }
          if (run.isEmpty()) {
            continue;
          }
          System.out.println("--- statement " + index + " ---");
          boolean hasResult = st.execute(run);
          while (true) {
            if (hasResult) {
              try (ResultSet rs = st.getResultSet()) {
                ResultSetMetaData md = rs.getMetaData();
                int cols = md.getColumnCount();
                int rows = 0;
                while (rs.next()) {
                  rows++;
                  StringBuilder line = new StringBuilder();
                  for (int i = 1; i <= cols; i++) {
                    if (i > 1) line.append(" | ");
                    line.append(md.getColumnLabel(i)).append('=').append(String.valueOf(rs.getObject(i)));
                  }
                  System.out.println(line);
                }
                if (rows == 0) {
                  System.out.println("(no rows)");
                }
              }
            } else {
              int updated = st.getUpdateCount();
              if (updated == -1) {
                break;
              }
              System.out.println("updated=" + updated);
            }
            if (!st.getMoreResults() && st.getUpdateCount() == -1) {
              break;
            }
            hasResult = true;
          }
          index++;
        }
      }
      conn.commit();
      System.out.println("COMMIT");
    }
  }
}
EOF

javac -cp "$JDBC_JAR" "$JAVA_FILE"
CARBONET_DB_URL="$DB_URL" CARBONET_DB_USER="$DB_USER" CARBONET_DB_PASSWORD="$DB_PASSWORD" \
  java -cp "/tmp:$JDBC_JAR" ApplyFullStackManagementSql "$SQL_FILE"

rm -f "$JAVA_FILE" "$CLASS_FILE"
