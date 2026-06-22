#!/bin/bash
set -e

CUBRID=/home/cubrid/CUBRID
export PATH=$CUBRID/bin:$PATH

BACKUP_DIR="/opt/Resonance/db/data/latest"
mkdir -p $BACKUP_DIR

echo "=== Starting CUBRID GitOps Backup ==="
date

# Get list of tables
TABLES=$(csql -u dba carbonet -c "SHOW TABLES;" 2>/dev/null | grep -v "Tables_in" | grep -v "^==" | grep -v "row selected" | sed "s/'//g" | sed 's/^[ \t]*//')

TOTAL_TABLES=0
TOTAL_ROWS=0

for TABLE in $TABLES; do
    TABLE=$(echo $TABLE | tr -d '[:space:]')
    if [ -z "$TABLE" ]; then
        continue
    fi

    echo "Exporting $TABLE..."

    # Get column information
    COLUMNS=$(csql -u dba carbonet -c "SELECT COLUMN_NAME FROM DB_COLUMN WHERE CLASS_NAME = '$TABLE' ORDER BY COLUMN_ORDER;" 2>/dev/null | grep -v "COLUMN_NAME" | grep -v "^==" | grep -v "row selected" | sed "s/'//g" | tr -d '[:space:]')

    if [ -z "$COLUMNS" ]; then
        echo "  No columns found, skipping"
        continue
    fi

    # Get row count
    ROW_COUNT=$(csql -u dba carbonet -c "SELECT COUNT(*) FROM $TABLE;" 2>/dev/null | grep -E "^[0-9]+" | tr -d '[:space:]')

    # Export data using JSON format
    JSON_FILE="$BACKUP_DIR/$TABLE.json"

    {
        echo "{"
        echo "  \"table\": \"$TABLE\","
        echo "  \"exportedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)\","
        echo "  \"columns\": ["

        # Output columns as JSON array
        COL_ARRAY=$(echo $COLUMNS | tr ' ' '\n' | sed "s/^/    \"/" | sed "s/$/\",/" | head -n -1 | sed "s/,$//")
        if [ -n "$COL_ARRAY" ]; then
            echo "$COL_ARRAY"
        else
            # Single column case
            echo "    \"$COLUMNS\""
        fi

        echo "  ],"
        echo "  \"count\": $ROW_COUNT,"
        echo "  \"rows\": ["

        # Export rows
        if [ "$ROW_COUNT" -gt 0 ]; then
            csql -u dba carbonet -c "SELECT * FROM $TABLE;" 2>/dev/null | tail -n +4 | head -n -2 | while read line; do
                echo "    { \"_row\": $(echo "$line" | sed "s/'/\\'/g" | tr -s ' ' | sed "s/^ *//") },"
            done | head -n -1
        fi

        echo "  ]"
        echo "}"
    } > $JSON_FILE

    TOTAL_TABLES=$((TOTAL_TABLES + 1))
    TOTAL_ROWS=$((TOTAL_ROWS + ROW_COUNT))

done

# Create manifest
cat > $BACKUP_DIR/manifest.json << EOF
{
  "exportedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)",
  "database": "carbonet",
  "tables": $TOTAL_TABLES,
  "totalRows": $TOTAL_ROWS
}
EOF

echo "=== Backup Complete ==="
echo "Tables: $TOTAL_TABLES, Rows: $TOTAL_ROWS"

# Calculate backup size
BACKUP_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
echo "Backup size: $BACKUP_SIZE"