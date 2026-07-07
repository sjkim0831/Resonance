/**
 * Query Builder Script
 * 동적 Query 생성 로직 - 빌드 없이 수정 가능
 */
package carbonet.scripts

class QueryBuilder {
    
    static String buildSelectQuery(Map params) {
        def table = params.table ?: 'unknown_table'
        def columns = params.columns ?: ['*']
        def conditions = params.conditions ?: []
        def orders = params.orderBy ?: []
        def limit = params.limit ?: 100
        
        def query = new StringBuilder()
        query << "SELECT ${columns.join(', ')} FROM ${table}"
        
        if (!conditions.isEmpty()) {
            query << " WHERE "
            query << conditions.collect { cond -> 
                "${cond.column} ${cond.operator ?: '='} ${formatValue(cond.value)}"
            }.join(' AND ')
        }
        
        if (!orders.isEmpty()) {
            query << " ORDER BY "
            query << orders.collect { it.column + ' ' + (it.direction ?: 'ASC') }.join(', ')
        }
        
        query << " LIMIT ${limit}"
        return query.toString()
    }
    
    static String buildCountQuery(Map params) {
        def table = params.table ?: 'unknown_table'
        def conditions = params.conditions ?: []
        
        def query = new StringBuilder()
        query << "SELECT COUNT(*) FROM ${table}"
        
        if (!conditions.isEmpty()) {
            query << " WHERE "
            query << conditions.collect { cond ->
                "${cond.column} ${cond.operator ?: '='} ${formatValue(cond.value)}"
            }.join(' AND ')
        }
        return query.toString()
    }
    
    private static String formatValue(value) {
        if (value == null) return 'NULL'
        if (value instanceof String) return "'${value.replace("'", "''")}'"
        return value.toString()
    }
    
    static Map buildPagination(Map params) {
        def page = params.page ?: 1
        def pageSize = params.pageSize ?: 10
        def offset = (page - 1) * pageSize
        
        return [
            offset: offset,
            limit: pageSize,
            page: page,
            pageSize: pageSize
        ]
    }
}
