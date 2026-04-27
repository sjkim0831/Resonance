package egovframework.com.config.data;

import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import javax.sql.DataSource;

@Configuration
public class MyBatisConfig {

    @Bean(name = "egov.sqlSession")
    public SqlSessionFactory sqlSessionFactory(DataSource dataSource) throws Exception {
        SqlSessionFactoryBean sessionFactory = new SqlSessionFactoryBean();
        sessionFactory.setDataSource(dataSource);

        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        sessionFactory.setMapperLocations(resolver.getResources("classpath*:/egovframework/mapper/com/**/*.xml"));

        sessionFactory.setTypeAliasesPackage(
                "egovframework.com.common.model,egovframework.com.feature.member.model.vo,egovframework.com.feature.admin.model.vo");
        sessionFactory.setTypeAliases(new Class[] { org.egovframe.rte.psl.dataaccess.util.EgovMap.class });
        sessionFactory.setTypeHandlersPackage("egovframework.com.config.data");

        org.apache.ibatis.session.Configuration configuration = new org.apache.ibatis.session.Configuration();
        configuration.setMapUnderscoreToCamelCase(true);
        sessionFactory.setConfiguration(configuration);

        return sessionFactory.getObject();
    }
}
