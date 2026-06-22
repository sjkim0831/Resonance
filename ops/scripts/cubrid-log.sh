#!/bin/bash
# ============================================
# CUBRID Operations Logging System
# SQLite-based operation tracking and error recovery
# ============================================

DB_PATH="/opt/Resonance/var/lib/cubrid_operations.db"

init_db() {
    mkdir -p "$(dirname "$DB_PATH")"
    chmod 755 "$(dirname "$DB_PATH")"

    sqlite3 "$DB_PATH" << 'EOF'
CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now', 'localtime')),
    operation TEXT NOT NULL,
    status TEXT CHECK(status IN ('started', 'success', 'failed', 'warning')),
    duration_ms INTEGER,
    details TEXT,
    pod_name TEXT,
    database_name TEXT
);

CREATE TABLE IF NOT EXISTS errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now', 'localtime')),
    operation_id INTEGER,
    error_code TEXT,
    error_message TEXT,
    stack_trace TEXT,
    resolved INTEGER DEFAULT 0,
    resolution TEXT,
    FOREIGN KEY (operation_id) REFERENCES operations(id)
);

CREATE TABLE IF NOT EXISTS server_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now', 'localtime')),
    pod_name TEXT,
    server_status TEXT,
    database_name TEXT,
    table_count INTEGER,
    row_counts TEXT,
    volume_size_mb INTEGER,
    is_healthy INTEGER
);

CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now', 'localtime')),
    backup_type TEXT,
    source_path TEXT,
    destination_path TEXT,
    size_mb INTEGER,
    table_count INTEGER,
    status TEXT,
    checksum TEXT
);

CREATE TABLE IF NOT EXISTS databases_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now', 'localtime')),
    database_name TEXT,
    db_path TEXT,
    log_path TEXT,
    lob_path TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON errors(timestamp);
CREATE INDEX IF NOT EXISTS idx_errors_resolved ON errors(resolved);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
CREATE INDEX IF NOT EXISTS idx_server_status_timestamp ON server_status(timestamp);
EOF

    chmod 644 "$DB_PATH"
    echo "Database initialized: $DB_PATH"
}

log_operation() {
    local operation="$1"
    local status="$2"
    local details="${3:-}"
    local pod="${4:-cubrid-carbonet-0}"
    local db="${5:-carbonet}"

    sqlite3 "$DB_PATH" << EOF
INSERT INTO operations (operation, status, details, pod_name, database_name)
VALUES ('$operation', '$status', '$details', '$pod', '$db');
SELECT last_insert_rowid();
EOF
}

log_error() {
    local operation_id="$1"
    local error_code="$2"
    local error_message="$3"
    local stack_trace="${4:-}"

    sqlite3 "$DB_PATH" << EOF
INSERT INTO errors (operation_id, error_code, error_message, stack_trace)
VALUES ($operation_id, '$error_code', '$error_message', '$stack_trace');
EOF
}

update_operation_duration() {
    local op_id="$1"
    local duration="$2"
    sqlite3 "$DB_PATH" "UPDATE operations SET duration_ms=$duration WHERE id=$op_id;"
}

mark_error_resolved() {
    local error_id="$1"
    local resolution="$2"
    sqlite3 "$DB_PATH" "UPDATE errors SET resolved=1, resolution='$resolution' WHERE id=$error_id;"
}

log_server_status() {
    local pod="$1"
    local server_status="$2"
    local db_name="$3"
    local table_count="$4"
    local row_counts="$5"
    local volume_size="$6"
    local is_healthy="$7"

    sqlite3 "$DB_PATH" << EOF
INSERT INTO server_status (pod_name, server_status, database_name, table_count, row_counts, volume_size_mb, is_healthy)
VALUES ('$pod', '$server_status', '$db_name', $table_count, '$row_counts', $volume_size, $is_healthy);
EOF
}

get_recent_errors() {
    sqlite3 "$DB_PATH" << EOF
SELECT e.timestamp, e.error_code, e.error_message, o.operation, e.resolved
FROM errors e
LEFT JOIN operations o ON e.operation_id = o.id
WHERE e.resolved = 0
ORDER BY e.timestamp DESC
LIMIT 10;
EOF
}

get_last_operation() {
    sqlite3 "$DB_PATH" "SELECT * FROM operations ORDER BY id DESC LIMIT 1;"
}

case "${1:-init}" in
    init)
        init_db
        ;;
    log)
        log_operation "$2" "$3" "$4"
        ;;
    errors)
        get_recent_errors
        ;;
    last)
        get_last_operation
        ;;
    *)
        echo "Usage: $0 {init|log|errors|last}"
        ;;
esac