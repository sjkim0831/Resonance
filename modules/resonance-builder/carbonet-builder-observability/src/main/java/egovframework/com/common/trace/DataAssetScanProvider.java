package egovframework.com.common.trace;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class DataAssetScanProvider implements AssetScanProvider {

    private final JdbcTemplate jdbcTemplate;

    public DataAssetScanProvider(DataSource dataSource) {
        this.jdbcTemplate = new JdbcTemplate(dataSource);
    }

    @Override
    public List<SystemAssetInventoryVO> scan() {
        List<SystemAssetInventoryVO> assets = new ArrayList<>();
        
        // PostgreSQL query for user tables
        String sql = "SELECT table_name AS class_name, table_schema AS owner_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'";
        List<Map<String, Object>> tables = jdbcTemplate.queryForList(sql);

        for (Map<String, Object> table : tables) {
            String tableName = String.valueOf(table.get("class_name"));
            String ownerName = String.valueOf(table.get("owner_name"));

            SystemAssetInventoryVO asset = new SystemAssetInventoryVO();
            asset.setAssetId("TABLE-" + tableName);
            asset.setAssetType("TABLE");
            asset.setAssetName(tableName);
            asset.setSourcePath("POSTGRESQL/" + ownerName);
            asset.setSourceSymbol(tableName);
            asset.setOwnerDomain(inferDomain(tableName));
            asset.setContentHash(generateTableHash(tableName));
            asset.setActiveYn("Y");
            asset.setCreatedAt(LocalDateTime.now());
            asset.setUpdatedAt(LocalDateTime.now());
            
            assets.add(asset);
        }

        return assets;
    }

    @Override
    public List<SystemAssetCompositionVO> traceDependencies(List<SystemAssetInventoryVO> assets) {
        return new ArrayList<>();
    }

    private String generateTableHash(String tableName) {
        // Hash the column structure
        String sql = "SELECT attr_name, data_type FROM information_schema.columns WHERE class_name = ?";
        List<Map<String, Object>> columns = jdbcTemplate.queryForList(sql, tableName);
        return Integer.toHexString(columns.toString().hashCode());
    }

    private String inferDomain(String tableName) {
        if (tableName.startsWith("COMTN")) return "shared"; // eGovFrame tables
        if (tableName.startsWith("UI_") || tableName.startsWith("SYSTEM_")) return "platform";
        return "business";
    }
}
