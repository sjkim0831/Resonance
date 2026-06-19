#!/usr/bin/env python3
#===========================================
# Generate Flyway SQL + Liquibase XML from exported data
#===========================================

import json
import os
from datetime import datetime

data_dir = "/opt/Resonance/db/data/latest"
output_sql = "/opt/Resonance/db/migrations/flyway/V1__baseline_schema.sql"
output_xml = "/opt/Resonance/db/changelog/liquibase/db.changelog-master.xml"

# Get all table files
table_files = [f for f in os.listdir(data_dir) if f.endswith('.json') and f != 'manifest.json']

tables_info = []

# First pass: collect table structures
for tf in sorted(table_files):
    with open(os.path.join(data_dir, tf), 'r') as f:
        data = json.load(f)

    table_name = data.get('table', tf.replace('.json', ''))
    columns = data.get('columns', [])

    # Infer column types from data
    col_defs = []
    if columns:
        for col in columns:
            col_defs.append({'name': col, 'type': 'VARCHAR(255)'})
    else:
        # Infer from first row
        rows = data.get('rows', [])
        if rows:
            for k, v in rows[0].items():
                if isinstance(v, int):
                    col_type = 'INTEGER'
                elif isinstance(v, float):
                    col_type = 'DOUBLE'
                else:
                    col_type = 'VARCHAR(255)'
                col_defs.append({'name': k, 'type': col_type})

    tables_info.append({
        'name': table_name,
        'columns': col_defs,
        'count': data.get('count', 0)
    })

# Generate Flyway SQL
with open(output_sql, 'w') as f:
    f.write("-- ============================================\n")
    f.write("-- Flyway Migration: V1__baseline_schema.sql\n")
    f.write("-- Generated: " + datetime.now().isoformat() + "\n")
    f.write("-- Tables: " + str(len(tables_info)) + "\n")
    f.write("-- ============================================\n\n")

    for table in tables_info:
        f.write(f"-- Table: {table['name']}\n")
        f.write(f"-- Rows: {table['count']}\n")

        # Generate CUBRID-style CREATE TABLE
        f.write(f"CREATE TABLE [{table['name']}] (\n")

        col_lines = []
        for col in table['columns']:
            col_lines.append(f"    [{col['name']}] {col['type']}")

        f.write(",\n".join(col_lines))
        f.write("\n);\nGO\n\n")

# Generate Liquibase XML
with open(output_xml, 'w') as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
    f.write('<databaseChangeLog\n')
    f.write('    xmlns="http://www.liquibase.org/xml/ns/dbchangelog"\n')
    f.write('    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n')
    f.write('    xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog\n')
    f.write('        http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd">\n')
    f.write('\n')
    f.write('    <!-- Generated: ' + datetime.now().isoformat() + ' -->\n')
    f.write('    <!-- Tables: ' + str(len(tables_info)) + ' -->\n')
    f.write('\n')

    for table in tables_info:
        f.write(f'    <changeSet id="create-{table["name"]}" author="db-gitops">\n')
        f.write(f'        <createTable tableName="{table["name"]}">\n')

        for col in table['columns']:
            f.write(f'            <column name="{col["name"]}" type="{col["type"]}"/>\n')

        f.write('        </createTable>\n')
        f.write('    </changeSet>\n')
        f.write('\n')

    f.write('</databaseChangeLog>\n')

print(f"Generated Flyway SQL: {output_sql}")
print(f"Generated Liquibase XML: {output_xml}")
print(f"Tables: {len(tables_info)}")