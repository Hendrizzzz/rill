package com.rill.typing.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class DeploymentManifestTest {

    private static final Set<String> SECRET_ENVIRONMENT_KEYS =
            Set.of(
                    "RILL_DATABASE_URL",
                    "RILL_DATABASE_USERNAME",
                    "RILL_DATABASE_PASSWORD",
                    "RILL_FLYWAY_URL",
                    "RILL_FLYWAY_USERNAME",
                    "RILL_FLYWAY_PASSWORD");

    @Test
    void freeTierManifestsPreserveTheSameOriginSecurityBoundary() throws IOException {
        Path repository = repositoryRoot();
        Map<String, Object> render = loadYaml(repository.resolve("render.yaml"));
        List<Map<String, Object>> services = maps(render.get("services"));

        assertThat(services).hasSize(1);
        Map<String, Object> service = services.getFirst();
        assertThat(service)
                .containsEntry("name", "rill-typewriting-api")
                .containsEntry("type", "web")
                .containsEntry("runtime", "docker")
                .containsEntry("plan", "free")
                .containsEntry("region", "singapore")
                .containsEntry("dockerfilePath", "./backend/Dockerfile")
                .containsEntry("dockerContext", ".")
                .containsEntry("healthCheckPath", "/actuator/health/readiness")
                .containsEntry("autoDeployTrigger", "off");
        Map<String, Object> buildFilter = map(service.get("buildFilter"));
        assertThat(values(buildFilter.get("paths")))
                .contains("backend/**", ".dockerignore", "render.yaml");

        List<Map<String, Object>> environment = maps(service.get("envVars"));
        for (String key : SECRET_ENVIRONMENT_KEYS) {
            assertThat(environment)
                    .anySatisfy(
                            variable -> {
                                assertThat(variable).containsEntry("key", key);
                                assertThat(variable).containsEntry("sync", false);
                                assertThat(variable).doesNotContainKey("value");
                            });
        }
        assertThat(environment)
                .anySatisfy(
                        variable ->
                                assertThat(variable)
                                        .containsEntry("key", "SPRING_PROFILES_ACTIVE")
                                        .containsEntry("value", "prod"))
                .anySatisfy(
                        variable ->
                                assertThat(variable)
                                        .containsEntry("key", "RILL_COOKIE_SECURE")
                                        .containsEntry("value", "true"))
                .anySatisfy(
                        variable ->
                                assertThat(variable)
                                        .containsEntry(
                                                "key",
                                                "RILL_REQUIRE_VERIFIED_DATABASE_TLS")
                                        .containsEntry("value", "true"))
                .anySatisfy(
                        variable ->
                                assertThat(variable)
                                        .containsEntry("key", "RILL_MAX_RESULTS_PER_ACCOUNT")
                                        .containsEntry("value", "100"));

        JsonNode vercel =
                JsonMapper.builder()
                        .build()
                        .readTree(repository.resolve("frontend/vercel.json").toFile());
        assertThat(vercel.get("git").get("deploymentEnabled").booleanValue()).isFalse();
        JsonNode rewrites = vercel.get("rewrites");
        assertThat(rewrites).isNotNull();
        assertThat(rewrites.size()).isEqualTo(2);
        assertThat(rewrites.get(0).get("source").stringValue()).isEqualTo("/api/:path*");
        assertThat(rewrites.get(0).get("destination").stringValue())
                .isEqualTo(
                        "https://"
                                + service.get("name")
                                + ".onrender.com/api/:path*");
        assertThat(rewrites.get(1).get("source").stringValue()).isEqualTo("/:path*");
        assertThat(rewrites.get(1).get("destination").stringValue()).isEqualTo("/index.html");

        JsonNode headers = vercel.get("headers");
        JsonNode apiHeaders = findRule(headers, "/api/:path*").get("headers");
        assertThat(headerValue(apiHeaders, "Cache-Control")).isEqualTo("no-store");
        assertThat(headerValue(apiHeaders, "x-vercel-enable-rewrite-caching")).isEqualTo("0");

        JsonNode browserHeaders = findRule(headers, "/:path*").get("headers");
        assertThat(headerValue(browserHeaders, "Content-Security-Policy"))
                .contains("default-src 'self'")
                .contains("connect-src 'self'")
                .contains("frame-ancestors 'none'");
        assertThat(headerValue(browserHeaders, "Strict-Transport-Security"))
                .isEqualTo("max-age=31536000");
        assertThat(headerValue(browserHeaders, "X-Frame-Options")).isEqualTo("DENY");
    }

    private static Path repositoryRoot() {
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        if (Files.isRegularFile(current.resolve("render.yaml"))) {
            return current;
        }
        Path parent = current.getParent();
        if (parent != null && Files.isRegularFile(parent.resolve("render.yaml"))) {
            return parent;
        }
        throw new IllegalStateException("Could not locate the repository root");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> loadYaml(Path path) throws IOException {
        LoaderOptions options = new LoaderOptions();
        options.setAllowDuplicateKeys(false);
        Object value =
                new Yaml(new SafeConstructor(options))
                        .load(Files.readString(path));
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> maps(Object value) {
        return (List<Map<String, Object>>) value;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> values(Object value) {
        return (List<Object>) value;
    }

    private static JsonNode findRule(JsonNode rules, String source) {
        for (JsonNode rule : rules) {
            if (source.equals(rule.get("source").stringValue())) {
                return rule;
            }
        }
        throw new AssertionError("Missing Vercel rule for " + source);
    }

    private static String headerValue(JsonNode headers, String key) {
        for (JsonNode header : headers) {
            if (key.equalsIgnoreCase(header.get("key").stringValue())) {
                return header.get("value").stringValue();
            }
        }
        throw new AssertionError("Missing header " + key);
    }
}
