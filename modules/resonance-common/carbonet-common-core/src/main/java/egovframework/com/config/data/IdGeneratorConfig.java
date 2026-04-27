package egovframework.com.config.data;

import org.egovframe.rte.fdl.idgnr.impl.EgovTableIdGnrServiceImpl;
import org.egovframe.rte.fdl.idgnr.impl.strategy.EgovIdGnrStrategyImpl;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Configuration
public class IdGeneratorConfig {

    @Bean(name = "usrCnfrmIdStrategy")
    public EgovIdGnrStrategyImpl usrCnfrmIdStrategy() {
        EgovIdGnrStrategyImpl egovIdGnrStrategyImpl = new EgovIdGnrStrategyImpl();
        egovIdGnrStrategyImpl.setPrefix("USRCNFRM_");
        // ESNTL_ID column is CHAR(20): 9(prefix) + 11(number) = 20
        egovIdGnrStrategyImpl.setCipers(11);
        egovIdGnrStrategyImpl.setFillChar('0');
        return egovIdGnrStrategyImpl;
    }

    @Bean(name = "egovUsrCnfrmIdGnrService", destroyMethod = "destroy")
    public EgovTableIdGnrServiceImpl egovUsrCnfrmIdGnrService(DataSource dataSource) {
        EgovTableIdGnrServiceImpl egovTableIdGnrServiceImpl = new EgovTableIdGnrServiceImpl();
        egovTableIdGnrServiceImpl.setDataSource(dataSource);
        egovTableIdGnrServiceImpl.setStrategy(usrCnfrmIdStrategy());
        egovTableIdGnrServiceImpl.setBlockSize(10);
        egovTableIdGnrServiceImpl.setTable("COMTECOPSEQ");
        egovTableIdGnrServiceImpl.setTableName("USRCNFRM_ID");
        return egovTableIdGnrServiceImpl;
    }
}
