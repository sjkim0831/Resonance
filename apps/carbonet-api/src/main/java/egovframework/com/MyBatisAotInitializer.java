package egovframework.com;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;

public class MyBatisAotInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        System.out.println("[MyBatisAotInitializer] Initializing Application Context - Forcing SLF4J for MyBatis");
        try {
            org.apache.ibatis.logging.LogFactory.useSlf4jLogging();
            System.out.println("[MyBatisAotInitializer] SUCCESS: Forced SLF4J binding completed");
        } catch (Throwable t) {
            System.err.println("[MyBatisAotInitializer] FAILED to force SLF4J: " + t.getMessage());
            t.printStackTrace(System.err);
        }
    }
}
