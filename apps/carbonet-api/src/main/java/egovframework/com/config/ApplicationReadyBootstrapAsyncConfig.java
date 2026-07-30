package egovframework.com.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Runs idempotent menu/page reconciliation after readiness without extending
 * the Kubernetes rollout critical path. A single worker preserves bounded DB
 * load and deterministic ordering; critical baseline and GWP integrity checks
 * intentionally remain synchronous.
 */
@Configuration
@EnableAsync
public class ApplicationReadyBootstrapAsyncConfig {

    @Bean(name = "applicationReadyBootstrapExecutor")
    public Executor applicationReadyBootstrapExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(64);
        executor.setThreadNamePrefix("ready-bootstrap-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        executor.initialize();
        return executor;
    }
}
