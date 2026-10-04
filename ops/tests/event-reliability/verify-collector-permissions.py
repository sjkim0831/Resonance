import importlib.util
s=importlib.util.spec_from_file_location('collector','/tmp/ccus-runtime-alert-collector.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with m.connect_runtime() as conn:
 with conn.cursor() as cur:
  for table in ['process_preview_recording_audit','process_preview_recording_audit_transition']:
   cur.execute('SELECT has_table_privilege(current_user,%s,\'INSERT\'),has_table_privilege(current_user,%s,\'SELECT\'),has_sequence_privilege(current_user,pg_get_serial_sequence(%s,\'id\'),\'USAGE\')',(table,table,table))
   ok=all(cur.fetchone());print(table+': '+str(ok));assert ok
