UPDATE framework_step_execution_spec
SET persistence_contract = coalesce(persistence_contract, '{}'::jsonb) || jsonb_build_object(
      'transactional', true,
      'migrationRequired', true,
      'autoGenerateMigration', true,
      'contractSource', 'DESIGN_SCHEMA_V1',
      'primaryEntities', jsonb_build_array('emission_project_portfolio_preference'),
      'schemaChanges', jsonb_build_array(jsonb_build_object(
        'operation', 'CREATE_TABLE',
        'tableName', 'emission_project_portfolio_preference',
        'columns', jsonb_build_array(
          jsonb_build_object('name','preference_id','type','uuid','primaryKey',true,'nullable',false,'default','gen_random_uuid()'),
          jsonb_build_object('name','tenant_id','type','varchar(64)','nullable',false),
          jsonb_build_object('name','account_id','type','varchar(100)','nullable',false),
          jsonb_build_object('name','selected_project_id','type','varchar(80)','nullable',true,'references',jsonb_build_object('table','emission_project_registry','column','project_id','onDelete','SET NULL')),
          jsonb_build_object('name','keyword','type','varchar(200)','nullable',false,'default',''''''),
          jsonb_build_object('name','status_filter','type','varchar(40)','nullable',false,'default',''''''),
          jsonb_build_object('name','site_filter','type','varchar(200)','nullable',false,'default',''''''),
          jsonb_build_object('name','sort_code','type','varchar(40)','nullable',false,'default','''UPDATED_DESC'''),
          jsonb_build_object('name','next_task_code','type','varchar(120)','nullable',true),
          jsonb_build_object('name','preference_version','type','bigint','nullable',false,'default','1'),
          jsonb_build_object('name','updated_at','type','timestamptz','nullable',false,'default','CURRENT_TIMESTAMP')
        ),
        'uniqueConstraints', jsonb_build_array(jsonb_build_array('tenant_id','account_id')),
        'indexes', jsonb_build_array(
          jsonb_build_object('name','idx_emission_portfolio_preference_project','columns',jsonb_build_array('tenant_id','selected_project_id'))
        )
      )),
      'fieldMappings', jsonb_build_array(
        jsonb_build_object('contextKey','tenantId','entity','emission_project_portfolio_preference','column','tenant_id'),
        jsonb_build_object('contextKey','accountId','entity','emission_project_portfolio_preference','column','account_id'),
        jsonb_build_object('contextKey','projectId','entity','emission_project_portfolio_preference','column','selected_project_id'),
        jsonb_build_object('contextKey','rowVersion','entity','emission_project_portfolio_preference','column','preference_version')
      )
    ),
    generation_status='READY',
    source_hash=md5(coalesce(source_hash,'')||':PORTFOLIO_PREFERENCE_SCHEMA_V1'),
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST';

UPDATE framework_professional_screen_contract
SET api_contract=(framework_try_jsonb(api_contract) || jsonb_build_array(
      'GET /home/api/emission-project-portfolio/preference',
      'PUT /home/api/emission-project-portfolio/preference'
    ))::text,
    data_contract=(framework_try_jsonb(data_contract) || jsonb_build_array(jsonb_build_object(
      'version','1.0.0','entity','emission_project_portfolio_preference',
      'tenant','tenant_id','account','account_id','optimisticLock','preference_version'
    )))::text,
    api_verified=false,
    database_verified=false,
    contract_status='IMPLEMENTATION_PENDING',
    updated_by='DESIGN_SCHEMA_GENERATOR_V1',
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM framework_step_execution_spec
    WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
      AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
      AND persistence_contract->>'autoGenerateMigration'='true'
      AND jsonb_array_length(persistence_contract->'schemaChanges')=1
  ) THEN
    RAISE EXCEPTION 'portfolio preference schema design was not registered';
  END IF;
END $$;
