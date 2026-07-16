param(
  [string]$HostName = "172.16.1.232",
  [string]$UserName = "sjkim",
  [string]$OutputPath = "docs/architecture/executable-webapp/generated/runtime-db-inventory.json"
)
$ErrorActionPreference = "Stop"
$password=$env:RESONANCE_SSH_PASSWORD
if([string]::IsNullOrWhiteSpace($password)){throw "Set RESONANCE_SSH_PASSWORD for this invocation."}
$sql=@'
select json_build_object(
 'collectedAt',current_timestamp,
 'menus',(select coalesce(json_agg(json_build_object('code',menu_code,'name',menu_nm,'url',menu_url,'useAt',use_at,'exposureAt',expsr_at) order by menu_code),'[]'::json) from comtnmenuinfo),
 'menuOrders',(select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select menu_code,sort_ordr from comtnmenuorder order by sort_ordr,menu_code)x),
 'menuProcessBindings',(select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select menu_code,process_code,step_code,actor_code,audience,binding_source,binding_status from framework_process_menu_binding order by menu_code)x),
 'actors',(select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select actor_code,actor_name,actor_type,purpose,use_at from framework_actor_definition order by actor_code)x),
 'processes',(select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select process_code,process_name,domain_code,owner_actor_code,process_status,lifecycle_status from framework_process_definition order by process_code)x),
 'steps',(select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select process_code,step_code,step_order,step_name,actor_code,user_path,admin_path,api_contract from framework_process_step order by process_code,step_order)x),
 'cases',(select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select case_code,process_code,case_type,case_status,automated from framework_simulation_case order by process_code,case_code)x),
 'screenBlueprints',(select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,route_path,screen_type,validation_status,transition_status from framework_screen_blueprint order by blueprint_code)x),
 'tables',(select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select table_schema,table_name,table_type from information_schema.tables where table_schema not in ('pg_catalog','information_schema') order by table_schema,table_name)x),
 'columns',(select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select table_schema,table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema not in ('pg_catalog','information_schema') order by table_schema,table_name,ordinal_position)x),
 'routines',(select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select routine_schema,routine_name,routine_type,data_type from information_schema.routines where routine_schema not in ('pg_catalog','information_schema') order by routine_schema,routine_name)x)
)::text;
'@
$target=Join-Path (Get-Location) $OutputPath
New-Item -ItemType Directory -Force -Path (Split-Path $target)|Out-Null
$sql | sshpass -p $password ssh -o StrictHostKeyChecking=no "$UserName@$HostName" "kubectl exec -i -n carbonet-prod postgres-patroni-0 -- psql -h 127.0.0.1 -U postgres -d carbonet -At" | Set-Content -Encoding utf8 $target
if($LASTEXITCODE -ne 0){throw "Runtime DB inventory failed: $LASTEXITCODE"}
Write-Output $target
