package com.rill.typing.config;

import java.util.regex.Pattern;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

@Configuration(proxyBeanMethods = false)
@Profile("prod")
class ProductionSafetyConfiguration {

    private static final Pattern VERIFIED_TLS =
            Pattern.compile("(?i)(?:[?&])sslmode=verify-full(?:&|$)");
    private static final Pattern REQUIRED_CHANNEL_BINDING =
            Pattern.compile("(?i)(?:[?&])channelbinding=require(?:&|$)");

    @Bean
    static BeanFactoryPostProcessor verifiedDatabaseTransport(Environment environment) {
        return beanFactory -> {
            if (environment.getProperty(
                    "rill.deployment.require-verified-database-tls",
                    Boolean.class,
                    false)) {
                validateDatabaseTransport(
                        environment.getProperty("spring.datasource.url"),
                        environment.getProperty("spring.flyway.url"));
            }
        };
    }

    @Bean
    ApplicationRunner productionSafety(RillProperties properties) {
        return arguments -> validate(properties);
    }

    static void validate(RillProperties properties) {
        if (!properties.cookie().secure()) {
            throw new IllegalStateException(
                    "Production requires Secure session and CSRF cookies");
        }
        if (!properties.allowedOrigins().isEmpty()) {
            throw new IllegalStateException(
                    "Production is same-origin; rill.allowed-origins must be empty");
        }
    }

    static void validateDatabaseTransport(String datasourceUrl, String flywayUrl) {
        requireAuthenticatedTls("application", datasourceUrl);
        requireAuthenticatedTls("migration", flywayUrl);
    }

    private static void requireAuthenticatedTls(String connection, String url) {
        if (url == null
                || !url.startsWith("jdbc:postgresql://")
                || !VERIFIED_TLS.matcher(url).find()
                || !REQUIRED_CHANNEL_BINDING.matcher(url).find()) {
            throw new IllegalStateException(
                    "Production "
                            + connection
                            + " database connections require sslmode=verify-full and channelBinding=require");
        }
    }
}
