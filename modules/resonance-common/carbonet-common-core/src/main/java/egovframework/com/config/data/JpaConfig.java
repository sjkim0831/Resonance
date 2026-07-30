package egovframework.com.config.data;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.PlatformTransactionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.persistence.EntityManagerFactory;
import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;
import java.util.Arrays;

@Configuration
@EnableJpaAuditing
@RequiredArgsConstructor
public class JpaConfig {

    private static final Logger log = LoggerFactory.getLogger(JpaConfig.class);

    // Keep startup scanning bounded; the deployment closure guard rejects any
    // new @Entity package until it is explicitly added to this contract.
    private static final String[] DEFAULT_ENTITY_PACKAGES = {
            "egovframework.com.feature.auth.domain.entity",
            "egovframework.com.feature.emission.domain.entity"
    };

    private final DataSource dataSource;

    @Value("${spring.jpa.hibernate.ddl-auto:none}")
    private String ddlAuto;

    @Value("${spring.jpa.database-platform:}")
    private String databasePlatform;

    @Value("${spring.jpa.show-sql:false}")
    private boolean showSql;

    @Value("${spring.jpa.properties.hibernate.format_sql:false}")
    private boolean formatSql;

    @Value("${carbonet.jpa.entity-packages:}")
    private String configuredEntityPackages;

    @Bean
    @Primary
    public LocalContainerEntityManagerFactoryBean entityManagerFactory(EntityManagerFactoryBuilder builder) {
        Map<String, Object> properties = new HashMap<>();
        properties.put("hibernate.hbm2ddl.auto", ddlAuto);
        properties.put("hibernate.dialect", databasePlatform);
        properties.put("hibernate.show_sql", showSql);
        properties.put("hibernate.format_sql", formatSql);
        // The dialect is already fixed, so skip extra JDBC metadata work during startup.
        properties.put("hibernate.temp.use_jdbc_metadata_defaults", false);
        properties.put("hibernate.boot.allow_jdbc_metadata_access", false);

        LocalContainerEntityManagerFactoryBean factoryBean = new LocalContainerEntityManagerFactoryBean();
        factoryBean.setDataSource(dataSource);
        String[] entityPackages = configuredEntityPackages == null || configuredEntityPackages.isBlank()
                ? DEFAULT_ENTITY_PACKAGES
                : Arrays.stream(configuredEntityPackages.split(","))
                        .map(String::trim)
                        .filter(value -> !value.isEmpty())
                        .toArray(String[]::new);
        log.info("JPA entity package closure active. packageCount={}", entityPackages.length);
        factoryBean.setPackagesToScan(entityPackages);
        factoryBean.setPersistenceUnitName("default");
        factoryBean.setEntityManagerFactoryInterface(EntityManagerFactory.class);
        factoryBean.setJpaPropertyMap(properties);

        // JPA 구현체로 Hibernate 사용
        HibernateJpaVendorAdapter vendorAdapter = new HibernateJpaVendorAdapter();
        factoryBean.setJpaVendorAdapter(vendorAdapter);

        return factoryBean;
    }

    @Bean
    @Primary
    public PlatformTransactionManager transactionManager(EntityManagerFactory entityManagerFactory) {
        return new JpaTransactionManager(entityManagerFactory);
    }

    @Bean
    public EntityManagerFactoryBuilder entityManagerFactoryBuilder() {
        return new EntityManagerFactoryBuilder(
                new HibernateJpaVendorAdapter(),
                new HashMap<>(), // 기본 JPA 속성
                null
        );
    }

}
