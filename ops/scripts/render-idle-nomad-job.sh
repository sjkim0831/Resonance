#!/usr/bin/env bash
set -euo pipefail

JOB_NAME="${JOB_NAME:-carbonet-idle}"
DATACENTER="${DATACENTER:-dc1}"
GROUP_NAME="${GROUP_NAME:-carbonet-idle}"
TASK_NAME="${TASK_NAME:-carbonet-idle-app}"
TARGET_HOST="${TARGET_HOST:-}"
TARGET_PORT="${TARGET_PORT:-18000}"
REPO_ROOT="${REPO_ROOT:-/opt/Resonance}"
JAR_PATH="${JAR_PATH:-$REPO_ROOT/apps/carbonet-app/target/carbonet.jar}"
LOG_DIR="${LOG_DIR:-$REPO_ROOT/var/logs}"
JAVA_BIN="${JAVA_BIN:-/usr/bin/java}"
JAVA_OPTS="${JAVA_OPTS:--Xms128m -Xmx384m -XX:MaxMetaspaceSize=160m -XX:MaxDirectMemorySize=32m -XX:ReservedCodeCacheSize=64m -XX:ActiveProcessorCount=1 -XX:+UseG1GC -Djava.security.egd=file:/dev/urandom -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Seoul -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/opt/Resonance/var/logs}"
DB_HOST="${DB_HOST:-34.82.141.193}"
DB_PORT="${DB_PORT:-33000}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
DB_PASSWORD="${DB_PASSWORD:-}"
HEALTH_PATH="${HEALTH_PATH:-/actuator/health}"

if [[ -z "$TARGET_HOST" ]]; then
  echo "TARGET_HOST is required" >&2
  exit 1
fi

cat <<EOF
job "${JOB_NAME}" {
  datacenters = ["${DATACENTER}"]
  type = "service"

  group "${GROUP_NAME}" {
    count = 1

    constraint {
      attribute = "\${node.unique.network.ip-address}"
      operator  = "="
      value     = "${TARGET_HOST}"
    }

    network {
      port "http" {
        static = ${TARGET_PORT}
      }
    }

    task "${TASK_NAME}" {
      driver = "exec"

      config {
        command = "/bin/bash"
        args = [
          "-lc",
          "exec ${JAVA_BIN} ${JAVA_OPTS} -jar ${JAR_PATH} --server.port=${TARGET_PORT} --spring.datasource.url=jdbc:cubrid:${DB_HOST}:${DB_PORT}:${DB_NAME}:::?charset=UTF-8 --spring.datasource.username=${DB_USER} --spring.datasource.password=${DB_PASSWORD}"
        ]
      }

      resources {
        cpu    = 500
        memory = 512
      }

      service {
        name = "${JOB_NAME}"
        port = "http"

        check {
          name     = "carbonet-idle-health"
          type     = "http"
          path     = "${HEALTH_PATH}"
          interval = "15s"
          timeout  = "5s"
        }
      }

      logs {
        max_files     = 5
        max_file_size = 10
      }
    }
  }
}
EOF
