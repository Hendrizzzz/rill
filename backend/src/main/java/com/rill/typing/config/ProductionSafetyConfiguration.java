package com.rill.typing.config;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

@Configuration(proxyBeanMethods = false)
@Profile("prod")
class ProductionSafetyConfiguration {

    private static final String JDBC_POSTGRESQL = "jdbc:postgresql://";
    private static final String DEFAULT_JAVA_SSL_FACTORY =
            "org.postgresql.ssl.DefaultJavaSSLFactory";

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
                || !url.startsWith(JDBC_POSTGRESQL)
                || !hasSingleParameter(url, "sslmode", "verify-full")
                || !hasSingleParameter(url, "channelBinding", "require")
                || !hasSingleParameter(url, "sslfactory", DEFAULT_JAVA_SSL_FACTORY)) {
            throw new IllegalStateException(
                    "Production "
                            + connection
                            + " database connections require sslmode=verify-full, "
                            + "channelBinding=require, and "
                            + "sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory");
        }
    }

    private static boolean hasSingleParameter(String url, String name, String expectedValue) {
        int queryStart = url.indexOf('?');
        if (queryStart < 0 || queryStart == url.length() - 1) {
            return false;
        }

        int matches = 0;
        for (String part : url.substring(queryStart + 1).split("&", -1)) {
            int separator = part.indexOf('=');
            String rawName = separator < 0 ? part : part.substring(0, separator);
            String rawValue = separator < 0 ? "" : part.substring(separator + 1);
            try {
                String decodedName = URLDecoder.decode(rawName, StandardCharsets.UTF_8);
                if (!decodedName.equalsIgnoreCase(name)) {
                    continue;
                }
                matches++;
                if (matches > 1
                        || !decodedName.equals(name)
                        || !URLDecoder.decode(rawValue, StandardCharsets.UTF_8)
                                .equals(expectedValue)) {
                    return false;
                }
            } catch (IllegalArgumentException invalidEncoding) {
                return false;
            }
        }
        return matches == 1;
    }
}
