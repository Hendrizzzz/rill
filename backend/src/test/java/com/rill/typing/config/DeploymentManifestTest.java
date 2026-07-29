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
        assertThat(service).doesNotContainKey("maxShutdownDelaySeconds");
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
                                        .containsEntry("value", "100"))
                .anySatisfy(
                        variable ->
                                assertThat(variable)
                                        .containsEntry(
                                                "key",
                                                "RILL_MAX_AUTH_ATTEMPTS_PER_MINUTE")
                                        .containsEntry("value", "30"))
                .anySatisfy(
                        variable ->
                                assertThat(variable)
                                        .containsEntry(
                                                "key",
                                                "RILL_MAX_REGISTRATIONS_PER_HOUR")
                                        .containsEntry("value", "60"));

        Map<String, Object> production =
                loadYaml(
                        repository.resolve(
                                "backend/src/main/resources/application-prod.yml"));
        Map<String, Object> deployment =
                map(map(production.get("rill")).get("deployment"));
        assertThat(deployment)
                .containsEntry(
                        "require-verified-database-tls",
                        "${RILL_REQUIRE_VERIFIED_DATABASE_TLS:true}");

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

    @Test
    void dependencyCheckIsAnIsolatedCachedRequiredGate() throws IOException {
        Map<String, Object> workflow =
                loadYaml(repositoryRoot().resolve(".github/workflows/verify.yml"));
        Map<String, Object> jobs = map(workflow.get("jobs"));
        Map<String, Object> backend = map(jobs.get("backend"));
        Map<String, Object> dependencyCheck = map(jobs.get("dependency-check"));

        assertThat(stepNames(backend)).doesNotContain("Scan backend dependencies");
        assertThat(dependencyCheck)
                .containsEntry("runs-on", "ubuntu-latest")
                .containsEntry("timeout-minutes", 180)
                .doesNotContainKey("continue-on-error");
        assertThat(map(dependencyCheck.get("env")))
                .containsEntry("NVD_API_KEY", "${{ secrets.NVD_API_KEY }}");

        Map<String, Object> cache =
                stepByName(dependencyCheck, "Restore OWASP Dependency-Check data");
        assertThat(cache)
                .containsEntry("id", "odc-cache")
                .containsEntry("uses", "actions/cache/restore@v6");
        Map<String, Object> cacheConfiguration = map(cache.get("with"));
        assertThat(cacheConfiguration)
                .containsEntry("path", "${{ runner.temp }}/dependency-check-data")
                .containsEntry(
                        "key",
                        "odc-data-${{ runner.os }}-${{ runner.arch }}-12.2.2-v1-${{ steps.odc-week.outputs.week }}")
                .containsEntry(
                        "restore-keys",
                        "odc-data-${{ runner.os }}-${{ runner.arch }}-12.2.2-v1-\n");

        Map<String, Object> update =
                stepByName(dependencyCheck, "Update vulnerability data");
        assertThat(update.get("run").toString())
                .contains("org.owasp:dependency-check-maven:12.2.2:update-only")
                .contains("-DdataDirectory=\"$RUNNER_TEMP/dependency-check-data\"")
                .contains("-DnvdApiKeyEnvironmentVariable=NVD_API_KEY");

        Map<String, Object> save =
                stepByName(dependencyCheck, "Save updated OWASP Dependency-Check data");
        assertThat(save)
                .containsEntry(
                        "if",
                        "github.event_name != 'pull_request' && steps.odc-cache.outputs.cache-hit != 'true'")
                .containsEntry("uses", "actions/cache/save@v6");
        assertThat(map(save.get("with")))
                .containsEntry("path", "${{ runner.temp }}/dependency-check-data")
                .containsEntry(
                        "key",
                        "${{ steps.odc-cache.outputs.cache-primary-key }}");

        Map<String, Object> scan = stepByName(dependencyCheck, "Scan backend dependencies");
        assertThat(scan).doesNotContainKey("continue-on-error");
        assertThat(scan.get("run").toString())
                .contains("org.owasp:dependency-check-maven:12.2.2:check")
                .contains("-DautoUpdate=false")
                .contains("-DfailBuildOnCVSS=7")
                .contains("-DdataDirectory=\"$RUNNER_TEMP/dependency-check-data\"")
                .contains("-DossindexAnalyzerEnabled=false");

        Map<String, Object> upload =
                maps(dependencyCheck.get("steps")).stream()
                        .filter(step -> "actions/upload-artifact@v4".equals(step.get("uses")))
                        .findFirst()
                        .orElseThrow();
        assertThat(upload).containsEntry("if", "always()");
        assertThat(map(upload.get("with")))
                .containsEntry("name", "backend-dependency-check")
                .containsEntry("path", "backend/target/dependency-check-report.*");
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

    private static List<String> stepNames(Map<String, Object> job) {
        return maps(job.get("steps")).stream()
                .map(step -> step.get("name"))
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .toList();
    }

    private static Map<String, Object> stepByName(Map<String, Object> job, String name) {
        return maps(job.get("steps")).stream()
                .filter(step -> name.equals(step.get("name")))
                .findFirst()
                .orElseThrow();
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
