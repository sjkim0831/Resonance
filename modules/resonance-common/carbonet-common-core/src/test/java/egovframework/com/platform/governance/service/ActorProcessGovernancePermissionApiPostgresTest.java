package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ActorProcessGovernancePermissionApiPostgresTest {
    private static final String MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260815121500__expose_narrow_step_permission_api.sql";

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
        jdbc.execute(Files.readString(findMigration()));
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
            jdbc.execute("drop function if exists public.framework_authorize_step_permissions(text,text,text)");
            jdbc.execute("drop function if exists public.framework_step_permission_requirements(text,text)");
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

    private Boolean authorize(String actor){
        return jdbc.queryForObject(
            "select public.framework_authorize_step_permissions('PROC','STEP',?)",Boolean.class,actor);
    }

    private static Path findMigration(){
        Path cursor=Path.of("").toAbsolutePath();
        for(int depth=0;cursor!=null&&depth<8;depth++,cursor=cursor.getParent()){
            Path candidate=cursor.resolve(MIGRATION);
            if(Files.isRegularFile(candidate))return candidate;
        }
        throw new IllegalStateException("permission API migration not found: "+MIGRATION);
    }
}
