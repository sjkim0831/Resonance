/**
 * Data Processing Scripts
 * 데이터 처리, 변환, 집계를 위한 스크립트
 */
package carbonet.scripts

class DataProcessing {
    
    /**
     * CSV 데이터 파싱
     */
    static List<Map> parseCSV(String csvContent, Map options = [:]) {
        def delimiter = options.delimiter ?: ','
        def hasHeader = options.hasHeader ?: true
        def skipEmptyRows = options.skipEmptyRows ?: true
        
        def lines = csvContent.split('\n')
        def result = []
        def headers = []
        
        lines.eachWithIndex { line, idx ->
            if (skipEmptyRows && line.trim().isEmpty()) return
            
            def values = line.split(delimiter).collect { it.trim() }
            
            if (hasHeader && idx == 0) {
                headers = values
            } else {
                def row = [:]
                if (hasHeader) {
                    headers.eachWithIndex { h, i ->
                        row[h] = values[i]
                    }
                } else {
                    values.eachWithIndex { v, i ->
                        row["col${i}"] = v
                    }
                }
                result << row
            }
        }
        
        return result
    }
    
    /**
     * 데이터 집계 (aggregation)
     */
    static Map aggregate(List<Map> data, String groupByField, String sumField) {
        def groups = [:]
        
        data.each { row ->
            def key = row[groupByField]
            if (!groups[key]) {
                groups[key] = [count: 0, sum: 0, items: []]
            }
            groups[key].count++
            groups[key].sum += (row[sumField] as Number ?: 0)
            groups[key].items << row
        }
        
        return groups.collectEntries { key, value ->
            [key, [
                count: value.count,
                sum: value.sum,
                average: value.count > 0 ? value.sum / value.count : 0,
                items: value.items
            ]]
        }
    }
    
    /**
     * 데이터 필터링
     */
    static List<Map> filter(List<Map> data, Map<String, Object> criteria) {
        data.findAll { row ->
            criteria.every { field, expected ->
                def actual = row[field]
                if (expected instanceof String && expected.contains('%')) {
                    // LIKE 패턴
                    def pattern = expected.replace('%', '.*')
                    actual?.toString() ==~ pattern
                } else if (expected instanceof Collection) {
                    // IN 조건
                    expected.contains(actual)
                } else {
                    // equality
                    actual == expected
                }
            }
        }
    }
    
    /**
     * 데이터 정렬
     */
    static List<Map> sort(List<Map> data, String sortBy, String direction = 'asc') {
        def sorted = data.sort { a, b ->
            def aVal = a[sortBy]
            def bVal = b[sortBy]
            
            def cmp
            if (aVal == null && bVal == null) {
                cmp = 0
            } else if (aVal == null) {
                cmp = -1
            } else if (bVal == null) {
                cmp = 1
            } else if (aVal instanceof Number && bVal instanceof Number) {
                cmp = aVal <=> bVal
            } else {
                cmp = aVal.toString() <=> bVal.toString()
            }
            
            direction == 'desc' ? -cmp : cmp
        }
        sorted
    }
    
    /**
     * 데이터 변환 (pivot)
     */
    static List<Map> pivot(List<Map> data, String rowField, String colField, String valueField, String aggFunc = 'sum') {
        def pivotData = [:]
        
        data.each { row ->
            def rowKey = row[rowField]
            def colKey = row[colField]
            def value = row[valueField] as Number ?: 0
            
            if (!pivotData[rowKey]) {
                pivotData[rowKey] = [:]
            }
            
            if (!pivotData[rowKey][colKey]) {
                pivotData[rowKey][colKey] = []
            }
            pivotData[rowKey][colKey] << value
        }
        
        // 집계를 적용하여 최종 pivot 결과 생성
        def result = pivotData.collectEntries { rowKey, cols ->
            def aggregated = cols.collectEntries { colKey, values ->
                def aggValue = values.with {
                    switch (aggFunc) {
                        case 'sum': return it.sum()
                        case 'avg': return it.average()
                        case 'min': return it.min()
                        case 'max': return it.max()
                        case 'count': return it.size()
                        default: return it.sum()
                    }
                }
                [colKey, aggValue]
            }
            [rowKey, aggregated + [(total): aggregated.values().with { switch (aggFunc) { case 'sum': return it.sum(); case 'avg': return it.average(); case 'count': return it.size(); default: return it.sum() } }]]
        }
        
        return result
    }
}
