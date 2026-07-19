-- Keep the executable API registry synchronized with the workflow notification
-- endpoint used by the actor task hand-off UI and the design validator.
INSERT INTO framework_api_endpoint_registry
  (endpoint_key, http_method, route_path, implementation_ref)
VALUES
  ('EMISSION:TASK:NOTIFICATION:READ',
   'POST',
   '/home/api/emission-task-notifications/{notificationId}/read',
   'EmissionProjectRegistryController#readTaskNotification')
ON CONFLICT (endpoint_key) DO UPDATE SET
  http_method = excluded.http_method,
  route_path = excluded.route_path,
  implementation_ref = excluded.implementation_ref,
  active_yn = 'Y',
  verified_at = current_timestamp;
