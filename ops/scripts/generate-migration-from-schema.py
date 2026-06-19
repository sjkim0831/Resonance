#!/usr/bin/env python3
#===========================================
# Generate Flyway SQL from Schema JSON
#===========================================

import json
import sys

schema_file = "/opt/Resonance/db/schema/schema.json"
output_file = "/opt/Resonance/db/migrations/flyway/V1__baseline_schema.sql"

with open(schema_file, 'r') as f:
    schema = json.load(f)

tables = schema.get('tables', [])

with open(output_file, 'w') as f:
    f.write("-- ============================================\n")
    f.write("-- Flyway Migration: V1__baseline_schema.sql\n")
    f.write("-- Generated: " + __import__('datetime').datetime.now().isoformat() + "\n")
    f.write("-- Tables: " + str(len(tables)) + "\n")
    f.write("-- ============================================\n\n")

    for table in tables:
        table_name = table['name']
        columns = table.get('columns', [])

        f.write(f"-- Table: {table_name}\n")
        f.write(f"CREATE TABLE [{table_name}] (\n")

        col_defs = []
        for col in columns:
            col_name = col.get('name', '')
            col_type = col.get('type', 'VARCHAR(255)')

            col_def = f"    [{col_name}] {col_type}"

            # Check for primary key in type
            if 'PRIMARY' in col_type.upper():
                col_def = f"    [{col_name}] {col_type.replace('PRIMARY', '').strip()} PRIMARY KEY"

            col_defs.append(col_def)

        f.write(",\n".join(col_defs))
        f.write("\n);\nGO\n\n")

print(f"Generated: {output_file}")
print(f"Tables: {len(tables)}")