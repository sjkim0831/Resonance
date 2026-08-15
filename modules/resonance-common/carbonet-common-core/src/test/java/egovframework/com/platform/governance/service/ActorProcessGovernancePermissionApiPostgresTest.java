package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ActorProcessGovernancePermissionApiPostgresTest {
    private static final String NARROW_API_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260815121500__expose_narrow_step_permission_api.sql";
    private static final String PROFESSIONAL_PERMISSION_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260815121700__bind_professional_screen_permissions.sql";

    private Connection connection;
    private JdbcTemplate jdbc;
    private boolean roleCreated;

    @BeforeAll
    void installNarrowApi() throws Exception {
        String url=System.getenv("DIRECT_CODEGEN_PG_URL");
        assumeTrue(url!=null&&!url.isBlank(),"DIRECT_CODEGEN_PG_URL is required for the PostgreSQL ACL suite");
        connection=DriverManager.getConnection(url,
            System.getenv().getOrDefault("DIRECT_CODEGEN_PG_USER","postgres"),
            System.getenv().getOrDefault("DIRECT_CODEGEN_PG_PASSWORD",""));
        jdbc=new JdbcTemplate(new SingleConnectionDataSource(connection,true));
        Integer roles=jdbc.queryForObject(
            "select count(*) from pg_roles where rolname='carbonet_app'",Integer.class);
        roleCreated=roles!=null&&roles==0;
        if(roleCreated)jdbc.execute("create role carbonet_app noinherit nologin");
        jdbc.execute("""
            create table public.framework_permission_requirement_v1(
              process_code text not null,step_code text not null,permission_code text not null,
              scope_type text not null,resource_contract jsonb not null,guard_contract jsonb not null,
              use_at char(1) not null default 'Y')
            """);
        jdbc.execute("""
            create table public.framework_permission_grant_v1(
              actor_code text not null,permission_code text not null,scope_type text not null,
              effect text not null,use_at char(1) not null default 'Y',
              primary key(actor_code,permission_code,scope_type))
            """);
        jdbc.execute("""
            create table public.framework_professional_screen_contract(
              contract_id bigserial primary key,process_code text not null,step_code text not null,
              audience text not null,route_path text not null,actor_code text not null,
              permission_codes jsonb not null default '[]')
            """);
        jdbc.execute("""
            create function public.framework_design_causality_json_set(value jsonb)
            returns jsonb language sql immutable as $$
              select coalesce(jsonb_agg(code order by code),'[]'::jsonb)
                from (select distinct upper(btrim(member#>>'{}')) code
                        from jsonb_array_elements(value) member) normalized
            $$
            """);
        jdbc.execute("""
            create function public.framework_canonical_blueprint_authority(
              process_code varchar,step_code varchar,audience varchar,route_path varchar,
              contract_id bigint) returns bigint language sql stable as $$ select 1::bigint $$
            """);
        jdbc.execute("""
            create function public.framework_canonical_screen_design_exact(
              blueprint_id bigint,contract_id bigint,proposed jsonb)
            returns jsonb language sql stable as $$
              select jsonb_build_object('identity',jsonb_build_object('screenKey','PROC|STEP|USER|/screen'),
                'process','{}'::jsonb,'step','{}'::jsonb,
                'lanes',jsonb_build_object('DESIGN_CARD','{}'::jsonb,'FRONTEND','{}'::jsonb))
            $$
            """);
        jdbc.execute(Files.readString(findMigration(NARROW_API_MIGRATION)));
        jdbc.execute(Files.readString(findMigration(PROFESSIONAL_PERMISSION_MIGRATION)));
    }

    @BeforeEach
    void seedNormalizedRequirements(){
        jdbc.execute("reset role");
        jdbc.update("delete from public.framework_permission_grant_v1");
        jdbc.update("delete from public.framework_permission_requirement_v1");
        jdbc.update("delete from public.framework_professional_screen_contract");
        jdbc.update("""
            insert into public.framework_permission_requirement_v1(
              process_code,step_code,permission_code,scope_type,resource_contract,guard_contract,use_at)
            values('PROC','STEP','Z_WRITE','PROJECT','{}','{}','Y'),
                  ('PROC','STEP','A_READ','PROJECT','{}','{}','Y')
            """);
    }

    @AfterAll
    void cleanup() throws Exception {
        if(jdbc!=null){
            try{jdbc.execute("reset role");}catch(Exception ignored){}
            jdbc.execute("drop function if exists public.framework_canonical_screen_design(varchar,varchar,varchar,varchar,jsonb)");
            jdbc.execute("drop function if exists public.framework_canonical_screen_design_exact(bigint,bigint,jsonb)");
            jdbc.execute("drop function if exists public.framework_canonical_blueprint_authority(varchar,varchar,varchar,varchar,bigint)");
            jdbc.execute("drop function if exists public.framework_design_causality_json_set(jsonb)");
            jdbc.execute("drop function if exists public.framework_authorize_step_permissions(text,text,text,text,text)");
            jdbc.execute("drop function if exists public.framework_authorize_step_permissions(text,text,text)");
            jdbc.execute("drop function if exists public.framework_step_permission_requirements(text,text)");
            jdbc.execute("drop table if exists public.framework_professional_screen_contract");
            jdbc.execute("drop table if exists public.framework_permission_grant_v1");
            jdbc.execute("drop table if exists public.framework_permission_requirement_v1");
            if(roleCreated)jdbc.execute("drop role if exists carbonet_app");
        }
        if(connection!=null)connection.close();
    }

    @Test
    void appRoleHasOnlyOrderedReadAndExactRuntimeAuthorization() {
        jdbc.execute("set role carbonet_app");
        assertThrows(DataAccessException.class,()->jdbc.queryForObject(
            "select count(*) from public.framework_permission_requirement_v1",Integer.class));
        assertThrows(DataAccessException.class,()->jdbc.queryForObject(
            "select count(*) from public.framework_permission_grant_v1",Integer.class));
        assertEquals("A_READ",jdbc.queryForObject(
            "select public.framework_step_permission_requirements('PROC','STEP')->0->>'permissionCode'",
            String.class));
        assertEquals("Z_WRITE",jdbc.queryForObject(
            "select public.framework_step_permission_requirements('PROC','STEP')->1->>'permissionCode'",
            String.class));
        assertFalse(Boolean.TRUE.equals(authorize("ACTOR")));
        assertThrows(DataAccessException.class,()->jdbc.queryForObject(
            "select public.framework_authorize_step_permissions('proc','STEP','ACTOR')",Boolean.class));
        jdbc.execute("reset role");

        jdbc.update("""
            insert into public.framework_permission_grant_v1(
              actor_code,permission_code,scope_type,effect,use_at)
            values('OTHER_ACTOR','A_READ','PROJECT','ALLOW','Y'),
                  ('OTHER_ACTOR','Z_WRITE','PROJECT','ALLOW','Y')
            """);
        jdbc.execute("set role carbonet_app");
        assertFalse(Boolean.TRUE.equals(authorize("ACTOR")));
        jdbc.execute("reset role");

        jdbc.update("""
            insert into public.framework_permission_grant_v1(
              actor_code,permission_code,scope_type,effect,use_at)
            values('ACTOR','A_READ','PROJECT','ALLOW','Y')
            """);
        jdbc.execute("set role carbonet_app");
        assertFalse(Boolean.TRUE.equals(authorize("ACTOR")),"every active requirement needs ALLOW");
        jdbc.execute("reset role");

        jdbc.update("""
            insert into public.framework_permission_grant_v1(
              actor_code,permission_code,scope_type,effect,use_at)
            values('ACTOR','Z_WRITE','PROJECT','ALLOW','Y')
            """);
        jdbc.execute("set role carbonet_app");
        assertTrue(Boolean.TRUE.equals(authorize("ACTOR")));
        jdbc.execute("reset role");

        jdbc.update("""
            update public.framework_permission_grant_v1 set effect='DENY'
             where actor_code='ACTOR' and permission_code='Z_WRITE' and scope_type='PROJECT'
            """);
        jdbc.execute("set role carbonet_app");
        assertFalse(Boolean.TRUE.equals(authorize("ACTOR")),"active DENY takes precedence");
        jdbc.execute("reset role");

        jdbc.update("delete from public.framework_permission_requirement_v1");
        jdbc.execute("set role carbonet_app");
        assertTrue(Boolean.TRUE.equals(authorize("ACTOR")),"zero requirements preserves existing behavior");
        jdbc.execute("reset role");

        assertFalse(Boolean.TRUE.equals(jdbc.queryForObject(
            "select has_table_privilege('carbonet_app','public.framework_permission_requirement_v1','SELECT')",
            Boolean.class)));
        assertFalse(Boolean.TRUE.equals(jdbc.queryForObject(
            "select has_table_privilege('carbonet_app','public.framework_permission_grant_v1','SELECT')",
            Boolean.class)));
    }

    @Test
    void professionalScreenPermissionsAreAudienceScopedAndChangeCanonicalHash() {
        jdbc.update("delete from public.framework_permission_requirement_v1");
        jdbc.update("delete from public.framework_permission_grant_v1");
        jdbc.update("""
            insert into public.framework_professional_screen_contract(
              process_code,step_code,audience,route_path,actor_code,permission_codes)
            values('PROC','STEP','USER','/screen','ACTOR','[]'),
                  ('PROC','STEP','ADMIN','/admin/screen','ADMIN_ACTOR','["ADMIN_SCREEN"]')
            """);
        String beforeHash=canonicalHash("USER","/screen");

        jdbc.update("""
            update public.framework_professional_screen_contract
               set permission_codes='["SCREEN_WRITE"]'
             where audience='USER'
            """);
        String afterHash=canonicalHash("USER","/screen");

        assertNotEquals(beforeHash,afterHash);
        assertEquals("SCREEN_WRITE",jdbc.queryForObject("""
            select requirement->>'permissionCode'
              from jsonb_array_elements(
                public.framework_step_permission_requirements('PROC','STEP')) requirement
             where requirement->'resource'->>'routePath'='/screen'
            """,String.class));
        assertEquals("/screen",jdbc.queryForObject("""
            select requirement->'resource'->>'routePath'
              from jsonb_array_elements(
                public.framework_step_permission_requirements('PROC','STEP')) requirement
             where requirement->>'permissionCode'='SCREEN_WRITE'
            """,String.class));
        jdbc.update("""
            insert into public.framework_permission_requirement_v1(
              process_code,step_code,permission_code,scope_type,
              resource_contract,guard_contract,use_at)
            values('PROC','STEP','SCREEN_WRITE','PROJECT',
              '{"normalized":true}','{"normalized":true}','Y')
            """);
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from jsonb_array_elements(
              public.framework_step_permission_requirements('PROC','STEP')) requirement
             where requirement->>'permissionCode'='SCREEN_WRITE'
               and requirement->'resource'->>'normalized'='true'
            """,Integer.class),"normalized requirement wins an overlapping professional code");
        jdbc.update("""
            delete from public.framework_permission_requirement_v1
             where permission_code='SCREEN_WRITE'
            """);
        assertTrue(Boolean.TRUE.equals(authorize("ACTOR","/screen","USER")),
            "the exact bound contract actor has designed allow");
        assertTrue(Boolean.TRUE.equals(authorize("ADMIN_ACTOR","/admin/screen","ADMIN")),
            "the admin actor is not blocked by the USER permission union");
        assertFalse(Boolean.TRUE.equals(authorize("OTHER_ACTOR","/screen","USER")));

        jdbc.update("""
            insert into public.framework_permission_grant_v1(
              actor_code,permission_code,scope_type,effect,use_at)
            values('OTHER_ACTOR','SCREEN_WRITE','PROJECT','ALLOW','Y')
            """);
        assertTrue(Boolean.TRUE.equals(authorize("OTHER_ACTOR","/screen","USER")));
        jdbc.update("""
            update public.framework_permission_grant_v1 set effect='DENY'
             where actor_code='OTHER_ACTOR' and permission_code='SCREEN_WRITE'
            """);
        assertFalse(Boolean.TRUE.equals(authorize("OTHER_ACTOR","/screen","USER")),
            "active DENY overrides explicit ALLOW/design authority");

        jdbc.update("delete from public.framework_permission_grant_v1");
        jdbc.update("""
            update public.framework_professional_screen_contract set permission_codes='[]'
            """);
        assertTrue(Boolean.TRUE.equals(authorize("OTHER_ACTOR","/screen","USER")),
            "removing professional codes restores the zero-requirement behavior");
        assertThrows(DataAccessException.class,()->authorize("ACTOR","/screen","user"));
        assertThrows(DataAccessException.class,()->authorize("ACTOR","","USER"));

        jdbc.update("""
            update public.framework_professional_screen_contract
               set permission_codes='["lower_case"]' where audience='USER'
            """);
        assertThrows(DataAccessException.class,()->jdbc.queryForObject(
            "select public.framework_step_permission_requirements('PROC','STEP')",
            String.class));
        assertThrows(DataAccessException.class,()->authorize("ACTOR","/screen","USER"));
        jdbc.update("""
            update public.framework_professional_screen_contract
               set permission_codes='{"code":"SCREEN_WRITE"}' where audience='USER'
            """);
        assertThrows(DataAccessException.class,()->jdbc.queryForObject(
            "select public.framework_step_permission_requirements('PROC','STEP')",
            String.class));
    }

    private Boolean authorize(String actor){
        return jdbc.queryForObject(
            "select public.framework_authorize_step_permissions('PROC','STEP',?)",Boolean.class,actor);
    }

    private Boolean authorize(String actor,String route,String audience){
        jdbc.execute("set role carbonet_app");
        try{
            return jdbc.queryForObject(
                "select public.framework_authorize_step_permissions('PROC','STEP',?,?,?)",
                Boolean.class,actor,route,audience);
        }finally{
            jdbc.execute("reset role");
        }
    }

    private String canonicalHash(String audience,String route){
        return jdbc.queryForObject("""
            select encode(sha256(convert_to(
              public.framework_canonical_screen_design('PROC','STEP',?,?, '{}'::jsonb)::text,
              'UTF8')),'hex')
            """,String.class,audience,route);
    }

    private static Path findMigration(String migration){
        Path cursor=Path.of("").toAbsolutePath();
        for(int depth=0;cursor!=null&&depth<8;depth++,cursor=cursor.getParent()){
            Path candidate=cursor.resolve(migration);
            if(Files.isRegularFile(candidate))return candidate;
        }
        throw new IllegalStateException("permission API migration not found: "+migration);
    }
}
