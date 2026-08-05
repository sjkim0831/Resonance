create table if not exists framework_process_chain (
    chain_code varchar(100) not null,
    process_code varchar(100) not null,
    process_order integer not null,
    next_process_code varchar(100),
    auto_start_yn char(1) not null default 'Y',
    use_at char(1) not null default 'Y',
    created_at timestamp not null default current_timestamp,
    updated_at timestamp not null default current_timestamp,
    primary key (chain_code, process_code),
    unique (chain_code, process_order)
);

insert into framework_process_chain(
    chain_code, process_code, process_order, next_process_code, auto_start_yn, use_at
) values
    ('EMISSION_TWENTY_STEP_RELAY','EMISSION_PROJECT_PORTFOLIO',1,'EMISSION_PROJECT','Y','Y'),
    ('EMISSION_TWENTY_STEP_RELAY','EMISSION_PROJECT',2,'ORGANIZATIONAL_BOUNDARY','Y','Y'),
    ('EMISSION_TWENTY_STEP_RELAY','ORGANIZATIONAL_BOUNDARY',3,'ACTIVITY_DATA','Y','Y'),
    ('EMISSION_TWENTY_STEP_RELAY','ACTIVITY_DATA',4,'EMISSION_CALCULATION','Y','Y'),
    ('EMISSION_TWENTY_STEP_RELAY','EMISSION_CALCULATION',5,null,'N','Y')
on conflict (chain_code, process_code) do update set
    process_order=excluded.process_order,
    next_process_code=excluded.next_process_code,
    auto_start_yn=excluded.auto_start_yn,
    use_at=excluded.use_at,
    updated_at=current_timestamp;

create index if not exists idx_framework_process_chain_next
    on framework_process_chain(next_process_code)
    where use_at='Y';

comment on table framework_process_chain is
    'DB-managed cross-process relay order. Completing one process may start the next process without UI hardcoding.';
