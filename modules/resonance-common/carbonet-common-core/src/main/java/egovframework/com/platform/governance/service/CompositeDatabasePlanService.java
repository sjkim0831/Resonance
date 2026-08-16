package egovframework.com.platform.governance.service;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Strict PostgreSQL catalog proof for executable database design plans. */
final class CompositeDatabasePlanService {
    private static final String SCHEMA_MARKER="design-schema-hash:";
    private final JdbcTemplate jdbc;

    CompositeDatabasePlanService(JdbcTemplate jdbc){this.jdbc=jdbc;}

    void validate(CompositeExecutableDesignAuthorityCompiler.Compilation compilation){
        Map<String,Object> database=map(compilation.executableDesign().get("DATABASE"),"DATABASE");
        String mode=String.valueOf(database.get("migrationMode"));
        String fingerprint=String.valueOf(database.get("schemaFingerprint"));
        for(Object raw:list(database.get("schemaChanges"),"DATABASE.schemaChanges")){
            Map<String,Object> change=map(raw,"DATABASE.schemaChanges[]");
            String table=String.valueOf(change.get("tableName"));
            if("SAFE_CREATE_TABLE".equals(mode)){
                String existing=jdbc.queryForObject(
                    "select to_regclass(format('%I.%I',current_schema(),?))::text",String.class,table);
                if(existing!=null){
                    validateRegisteredTable(table,change);
                    String comment=jdbc.queryForObject(
                        "select obj_description(to_regclass(format('%I.%I',current_schema(),?)),'pg_class')",
                        String.class,table);
                    if(!(SCHEMA_MARKER+fingerprint).equals(comment))throw new IllegalStateException(
                        "DATABASE_SAFE_CREATE_SCHEMA_MARKER_NOT_EXACT: "+table);
                }
            }else validateRegisteredTable(table,change);
        }
    }

    private void validateRegisteredTable(String table,Map<String,Object> change){
        List<Map<String,Object>> actual=jdbc.queryForList("""
            select attribute.attname as "name",
                   case when format_type(attribute.atttypid,attribute.atttypmod)='timestamp without time zone'
                     then 'timestamp' when format_type(attribute.atttypid,attribute.atttypmod)=
                     'timestamp with time zone' then 'timestamptz' else replace(
                     format_type(attribute.atttypid,attribute.atttypmod),'character varying','varchar') end as "type",
                   not attribute.attnotnull as "nullable",
                   coalesce(index.indisprimary and attribute.attnum=any(index.indkey),false) as "primaryKey",
                   pg_get_expr(default_value.adbin,default_value.adrelid) as "default"
              from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
              join pg_attribute attribute on attribute.attrelid=relation.oid and attribute.attnum>0
                 and not attribute.attisdropped
              left join pg_attrdef default_value on default_value.adrelid=relation.oid
                 and default_value.adnum=attribute.attnum
              left join pg_index index on index.indrelid=relation.oid and index.indisprimary
             where namespace.nspname=current_schema() and relation.relname=? order by attribute.attnum
            """,table);
        List<?> declared=list(change.get("columns"),"DATABASE.columns");
        if(actual.size()!=declared.size()||actual.isEmpty())throw new IllegalStateException(
            "DATABASE_REGISTERED_COLUMN_COUNT_NOT_EXACT: "+table);
        Map<String,Map<String,Object>> byName=new LinkedHashMap<>();
        for(Map<String,Object> column:actual)byName.put(String.valueOf(column.get("name")),column);
        int references=0;
        for(Object raw:declared){Map<String,Object> expected=map(raw,"DATABASE.columns[]");
            Map<String,Object> found=byName.get(String.valueOf(expected.get("name")));
            if(found==null||!String.valueOf(expected.get("type")).equals(found.get("type"))
                    ||!expected.get("nullable").equals(found.get("nullable"))
                    ||!expected.get("primaryKey").equals(found.get("primaryKey")))throw new IllegalStateException(
                "DATABASE_REGISTERED_COLUMN_NOT_EXACT: "+table+"."+expected.get("name"));
            String expectedDefault=String.valueOf(expected.getOrDefault("default",""));
            String actualDefault=found.get("default")==null?"":String.valueOf(found.get("default"));
            if(!expectedDefault.equals(actualDefault))throw new IllegalStateException(
                "DATABASE_REGISTERED_DEFAULT_NOT_EXACT: "+table+"."+expected.get("name"));
            if(expected.containsKey("references")){references++;
                validateReference(table,expected,map(expected.get("references"),"DATABASE.references"));}
        }
        Integer actualReferences=jdbc.queryForObject("""
            select count(*) from information_schema.key_column_usage usage
             join information_schema.table_constraints table_constraint
               using(constraint_schema,constraint_name)
             where usage.table_schema=current_schema() and usage.table_name=?
               and table_constraint.constraint_type='FOREIGN KEY'
            """,Integer.class,table);
        if(actualReferences==null||actualReferences!=references)throw new IllegalStateException(
            "DATABASE_REGISTERED_REFERENCE_COUNT_NOT_EXACT: "+table);
        validateRegisteredIndexes(table,change);
    }

    private void validateReference(String table,Map<String,Object> column,Map<String,Object> reference){
        Integer matches=jdbc.queryForObject("""
            select count(*) from information_schema.referential_constraints relation
            join information_schema.key_column_usage source
              on source.constraint_schema=relation.constraint_schema
             and source.constraint_name=relation.constraint_name
            join information_schema.constraint_column_usage target
              on target.constraint_schema=relation.unique_constraint_schema
             and target.constraint_name=relation.unique_constraint_name
           where source.table_schema=current_schema() and source.table_name=? and source.column_name=?
             and target.table_name=? and target.column_name=? and relation.delete_rule=?
            """,Integer.class,table,column.get("name"),reference.get("table"),
            reference.get("column"),reference.get("onDelete"));
        if(matches==null||matches!=1)throw new IllegalStateException(
            "DATABASE_REGISTERED_REFERENCE_NOT_EXACT: "+table+"."+column.get("name"));
    }

    private void validateRegisteredIndexes(String table,Map<String,Object> change){
        List<String> actualUnique=jdbc.queryForList("""
            select array_agg(usage.column_name order by usage.ordinal_position)::text
              from information_schema.table_constraints table_constraint
              join information_schema.key_column_usage usage
                using(constraint_schema,constraint_name,table_schema,table_name)
             where table_constraint.table_schema=current_schema() and table_constraint.table_name=?
               and table_constraint.constraint_type='UNIQUE'
             group by table_constraint.constraint_name order by table_constraint.constraint_name
            """,String.class,table);
        List<String> declaredUnique=list(change.get("uniqueConstraints"),"DATABASE.uniqueConstraints")
            .stream().map(raw->"{"+String.join(",",list(raw,"uniqueConstraint").stream()
                .map(String::valueOf).toList())+"}").sorted().toList();
        if(!actualUnique.stream().sorted().toList().equals(declaredUnique))throw new IllegalStateException(
            "DATABASE_REGISTERED_UNIQUE_CONSTRAINT_NOT_EXACT: "+table);
        List<Map<String,Object>> actual=jdbc.queryForList("""
            select index_class.relname as "name",index.indisunique as "unique",
                   array_agg(attribute.attname order by key.ordinality)::text as "columns"
              from pg_class table_class join pg_namespace namespace on namespace.oid=table_class.relnamespace
              join pg_index index on index.indrelid=table_class.oid and not index.indisprimary
              join pg_class index_class on index_class.oid=index.indexrelid
              cross join lateral unnest(index.indkey) with ordinality key(attnum,ordinality)
              join pg_attribute attribute on attribute.attrelid=table_class.oid and attribute.attnum=key.attnum
             where namespace.nspname=current_schema() and table_class.relname=?
               and not exists(select 1 from pg_constraint table_constraint
                 where table_constraint.conindid=index.indexrelid)
             group by index_class.relname,index.indisunique order by index_class.relname
            """,table);
        List<?> declared=list(change.get("indexes"),"DATABASE.indexes");
        if(actual.size()!=declared.size())throw new IllegalStateException(
            "DATABASE_REGISTERED_INDEX_COUNT_NOT_EXACT: "+table);
        for(Object raw:declared){Map<String,Object> expected=map(raw,"DATABASE.indexes[]");
            String columns="{"+String.join(",",list(expected.get("columns"),"columns").stream()
                .map(String::valueOf).toList())+"}";
            if(actual.stream().noneMatch(index->expected.get("name").equals(index.get("name"))
                    &&expected.get("unique").equals(index.get("unique"))
                    &&columns.equals(index.get("columns"))))throw new IllegalStateException(
                "DATABASE_REGISTERED_INDEX_NOT_EXACT: "+table+"."+expected.get("name"));}
    }

    @SuppressWarnings("unchecked") private static Map<String,Object> map(Object value,String label){
        if(!(value instanceof Map<?,?>))throw new IllegalStateException(label+" must be an object");
        return (Map<String,Object>)value;
    }
    private static List<?> list(Object value,String label){
        if(!(value instanceof List<?> rows))throw new IllegalStateException(label+" must be an array");
        return rows;
    }
}
