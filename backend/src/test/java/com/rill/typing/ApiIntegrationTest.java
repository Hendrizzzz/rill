package com.rill.typing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rill.typing.auth.AuthService;
import com.rill.typing.auth.AuthSessionRepository;
import com.rill.typing.auth.RillPrincipal;
import com.rill.typing.auth.SessionService;
import com.rill.typing.auth.UserAccount;
import com.rill.typing.common.ApiException;
import com.rill.typing.result.ResultDtos;
import com.rill.typing.result.TestMode;
import com.rill.typing.result.TypingResultRepository;
import com.rill.typing.result.TypingResultService;
import jakarta.servlet.http.Cookie;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
        properties = {
            "rill.max-results-per-account=2",
            "rill.max-result-requests-per-minute=20"
        })
@AutoConfigureMockMvc
@Testcontainers
class ApiIntegrationTest {

    @Container @ServiceConnection
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:18-alpine");

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired AuthService authService;
    @Autowired SessionService sessionService;
    @Autowired AuthSessionRepository sessionRepository;
    @Autowired TypingResultService resultService;
    @Autowired TypingResultRepository resultRepository;

    @Test
    void sessionBootstrapCreatesCsrfCookieAndRejectsMissingCsrf() throws Exception {
        mvc.perform(get("/api/auth/session"))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("XSRF-TOKEN"))
                .andExpect(cookie().httpOnly("XSRF-TOKEN", false))
                .andExpect(jsonPath("$.authenticated").value(false))
                .andExpect(jsonPath("$.csrfToken").isNotEmpty())
                .andExpect(header().string("Cache-Control", "no-store"));

        mvc.perform(
                        post("/api/auth/register")
                                .header(HttpHeaders.ORIGIN, "http://127.0.0.1:8080")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {"username":"no_csrf","password":"long-enough-password"}
                                        """))
                .andExpect(status().isForbidden())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("CSRF_REJECTED"));
    }

    @Test
    void registrationSessionAndLogoutRoundTrip() throws Exception {
        Client client = bootstrap();
        String username = uniqueUsername("river");

        MvcResult registered =
                client.perform(
                                post("/api/auth/register")
                                        .header(
                                                HttpHeaders.ORIGIN,
                                                "http://127.0.0.1:8080")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                json.writeValueAsString(
                                                        new Credentials(
                                                                username,
                                                                "correct-horse-battery"))))
                        .andExpect(status().isCreated())
                        .andExpect(cookie().exists("RILL_SESSION"))
                        .andExpect(cookie().httpOnly("RILL_SESSION", true))
                        .andExpect(jsonPath("$.authenticated").value(true))
                        .andExpect(jsonPath("$.user.username").value(username))
                        .andReturn();
        String registeredCreatedAt =
                json.readTree(registered.getResponse().getContentAsString())
                        .get("user")
                        .get("createdAt")
                        .stringValue();
        client.accept(registered);

        MvcResult current =
                client.perform(get("/api/auth/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.user.username").value(username))
                .andReturn();
        assertThat(
                        json.readTree(current.getResponse().getContentAsString())
                                .get("user")
                                .get("createdAt")
                                .stringValue())
                .isEqualTo(registeredCreatedAt);

        client.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge("RILL_SESSION", 0))
                .andExpect(cookie().maxAge("XSRF-TOKEN", 0));
    }

    @Test
    void invalidLoginDoesNotRevealWhetherUsernameExists() throws Exception {
        Client client = bootstrap();
        String username = uniqueUsername("equal");
        MvcResult registered =
                client.perform(
                                post("/api/auth/register")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                json.writeValueAsString(
                                                        new Credentials(
                                                                username,
                                                                "correct-horse-battery"))))
                        .andReturn();
        client.accept(registered);
        client.perform(post("/api/auth/logout")).andExpect(status().isNoContent());

        Client fresh = bootstrap();
        String known =
                fresh.perform(
                                post("/api/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                json.writeValueAsString(
                                                        new Credentials(
                                                                username,
                                                                "wrong-password-here"))))
                        .andExpect(status().isUnauthorized())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String unknown =
                fresh.perform(
                                post("/api/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                json.writeValueAsString(
                                                        new Credentials(
                                                                uniqueUsername("missing"),
                                                                "wrong-password-here"))))
                        .andExpect(status().isUnauthorized())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        assertThat(json.readTree(known).get("code").stringValue())
                .isEqualTo(json.readTree(unknown).get("code").stringValue())
                .isEqualTo("INVALID_CREDENTIALS");
        assertThat(json.readTree(known).get("detail").stringValue())
                .isEqualTo(json.readTree(unknown).get("detail").stringValue());
    }

    @Test
    void resultCreationIsDerivedIdempotentAndQueryable() throws Exception {
        Client client = registeredClient("typist");
        UUID clientResultId = UUID.randomUUID();
        String body = resultJson(clientResultId, 7, 6, 1);

        MvcResult created =
                client.perform(
                                post("/api/results")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body))
                        .andExpect(status().isCreated())
                        .andExpect(cookie().doesNotExist("XSRF-TOKEN"))
                        .andExpect(jsonPath("$.clientResultId").value(clientResultId.toString()))
                        .andExpect(jsonPath("$.wpm").value(12.0))
                        .andExpect(jsonPath("$.rawWpm").value(16.8))
                        .andExpect(jsonPath("$.accuracy").value(66.67))
                        .andExpect(jsonPath("$.consistency").value(0.0))
                        .andReturn();
        client.accept(created);

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.oldestResultsPruned").value(0));

        client.perform(get("/api/results").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].clientResultId")
                        .value(clientResultId.toString()));

        client.perform(get("/api/results/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRuns").value(1))
                .andExpect(jsonPath("$.totalPracticeMs").value(5000))
                .andExpect(jsonPath("$.records.length()").value(1));
    }

    @Test
    void tinyTerminalPaceWindowIsCombinedForConsistencyAnalysis() throws Exception {
        Client client = registeredClient("pace_window");
        UUID clientResultId = UUID.randomUUID();

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {
                                          "clientResultId":"%s",
                                          "mode":"WORDS",
                                          "modeValue":10,
                                          "punctuation":false,
                                          "numbers":false,
                                          "durationMs":2024,
                                          "typedCharacters":15,
                                          "correctAttempts":15,
                                          "incorrectAttempts":0,
                                          "correctCharacters":15,
                                          "missingCharacters":0,
                                          "extraAttempts":0,
                                          "correctedErrors":0,
                                          "paceBuckets":[
                                            {"durationMs":1000,"typedCharacters":7},
                                            {"durationMs":1000,"typedCharacters":7},
                                            {"durationMs":24,"typedCharacters":1}
                                          ]
                                        }
                                        """
                                                .formatted(clientResultId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rawWpm").value(88.93))
                .andExpect(jsonPath("$.consistency").value(94.51))
                .andExpect(jsonPath("$.paceBuckets.length()").value(3))
                .andExpect(jsonPath("$.paceBuckets[2].durationMs").value(24))
                .andExpect(jsonPath("$.paceBuckets[2].typedCharacters").value(1));

        client.perform(get("/api/results").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].consistency").value(94.51));
    }

    @Test
    void conflictingRetryAndInvalidCursorReturnStableProblemCodes() throws Exception {
        Client client = registeredClient("conflict");
        UUID id = UUID.randomUUID();
        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(resultJson(id, 7, 6, 1)))
                .andExpect(status().isCreated());

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(resultJson(id, 7, 5, 2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESULT_IDEMPOTENCY_CONFLICT"));

        client.perform(get("/api/results").param("cursor", "not-valid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURSOR"));
    }

    @Test
    void accountExportAndDeletionAreScopedAndDestructive() throws Exception {
        Client client = registeredClient("export");
        client.perform(get("/api/account/export"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        "Content-Disposition",
                        org.hamcrest.Matchers.startsWith("attachment;")))
                .andExpect(jsonPath("$.schemaVersion").value(1))
                .andExpect(jsonPath("$.results.length()").value(0));

        client.perform(
                        delete("/api/account")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"password\":\"wrong-password-here\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CONFIRMATION_FAILED"));

        client.perform(
                        delete("/api/account")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"password\":\"correct-horse-battery\"}"))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge("RILL_SESSION", 0));

        client.perform(get("/api/results"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void accountDeletionPasswordConfirmationIsRateLimited() throws Exception {
        Client client = registeredClient("delete_limit");
        for (int attempt = 0; attempt < 5; attempt++) {
            client.perform(
                            delete("/api/account")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"password\":\"wrong-password-here\"}"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("PASSWORD_CONFIRMATION_FAILED"));
        }

        client.perform(
                        delete("/api/account")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"password\":\"wrong-password-here\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void malformedOversizedAndUtf8BoundedCredentialsAreRejected() throws Exception {
        Client client = bootstrap();

        client.perform(
                        post("/api/auth/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {
                                          "username":"unknown_field",
                                          "password":"correct-horse-battery",
                                          "administrator":true
                                        }
                                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));

        client.perform(
                        post("/api/auth/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        json.writeValueAsString(
                                                new Credentials(
                                                        uniqueUsername("bytes"),
                                                        "🙂".repeat(19)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        client.perform(
                        post("/api/auth/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"username\":\"large_body\",\"password\":\""
                                                + "a".repeat(66_000)
                                                + "\"}"))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
    }

    @Test
    void derivedSpeedOutsideThePersistenceRangeIsRejected() throws Exception {
        Client client = registeredClient("speed_bound");
        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {
                                          "clientResultId":"%s",
                                          "mode":"WORDS",
                                          "modeValue":10,
                                          "punctuation":false,
                                          "numbers":false,
                                          "durationMs":250,
                                          "typedCharacters":50000,
                                          "correctAttempts":50000,
                                          "incorrectAttempts":0,
                                          "correctCharacters":50000,
                                          "missingCharacters":0,
                                          "extraAttempts":0,
                                          "correctedErrors":0,
                                          "paceBuckets":[
                                            {"durationMs":250,"typedCharacters":50000}
                                          ]
                                        }
                                        """
                                                .formatted(UUID.randomUUID())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void historyIsOwnedByTheAuthenticatedAccount() throws Exception {
        Client first = registeredClient("owner_a");
        Client second = registeredClient("owner_b");
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();

        first.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(resultJson(firstId, 7, 6, 1)))
                .andExpect(status().isCreated());
        second.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(resultJson(secondId, 7, 6, 1)))
                .andExpect(status().isCreated());

        first.perform(get("/api/results"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].clientResultId").value(firstId.toString()));
        second.perform(get("/api/results"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].clientResultId").value(secondId.toString()));
    }

    @Test
    void resultRetentionReportsAndRemovesTheOldestRow() throws Exception {
        Client client = registeredClient("retention");
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        UUID third = UUID.randomUUID();

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(resultJson(first, 7, 6, 1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.oldestResultsPruned").value(0));
        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(resultJson(second, 7, 6, 1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.oldestResultsPruned").value(0));
        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(resultJson(third, 7, 6, 1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.oldestResultsPruned").value(1));

        client.perform(get("/api/results"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(
                        jsonPath(
                                "$.items[?(@.clientResultId == '%s')]"
                                        .formatted(first))
                                .isEmpty());
    }

    @Test
    void concurrentIdenticalResultsReturnOneCanonicalResult() throws Exception {
        RillPrincipal principal = newPrincipal("concurrent_same");
        UUID clientResultId = UUID.randomUUID();
        ResultDtos.CreateResultRequest request = resultRequest(clientResultId, 6, 1);
        int workers = 8;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<TypingResultService.CreateOutcome> outcomes = new ArrayList<>();

        try (var executor = Executors.newFixedThreadPool(workers)) {
            List<Future<TypingResultService.CreateOutcome>> futures = new ArrayList<>();
            for (int index = 0; index < workers; index++) {
                futures.add(
                        executor.submit(
                                () -> {
                                    ready.countDown();
                                    start.await();
                                    return resultService.create(principal, request);
                                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<TypingResultService.CreateOutcome> future : futures) {
                outcomes.add(future.get(20, TimeUnit.SECONDS));
            }
        }

        assertThat(outcomes).filteredOn(TypingResultService.CreateOutcome::created).hasSize(1);
        assertThat(outcomes.stream().map(TypingResultService.CreateOutcome::response).distinct())
                .hasSize(1);
        assertThat(resultRepository.countByUserId(principal.id())).isEqualTo(1);
    }

    @Test
    void concurrentConflictingResultsKeepOneWinnerAndRejectOtherPayload() throws Exception {
        RillPrincipal principal = newPrincipal("concurrent_conflict");
        UUID clientResultId = UUID.randomUUID();
        int workers = 8;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<ConcurrentCall> calls = new ArrayList<>();

        try (var executor = Executors.newFixedThreadPool(workers)) {
            List<Future<ConcurrentCall>> futures = new ArrayList<>();
            for (int index = 0; index < workers; index++) {
                ResultDtos.CreateResultRequest request =
                        index % 2 == 0
                                ? resultRequest(clientResultId, 6, 1)
                                : resultRequest(clientResultId, 5, 2);
                futures.add(
                        executor.submit(
                                () -> {
                                    ready.countDown();
                                    start.await();
                                    try {
                                        return new ConcurrentCall(
                                                resultService.create(principal, request), null);
                                    } catch (ApiException exception) {
                                        return new ConcurrentCall(null, exception.getCode());
                                    }
                                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<ConcurrentCall> future : futures) {
                calls.add(future.get(20, TimeUnit.SECONDS));
            }
        }

        assertThat(calls).filteredOn(call -> call.outcome() != null).hasSize(4);
        assertThat(calls)
                .filteredOn(
                        call -> call.outcome() != null && call.outcome().created())
                .hasSize(1);
        assertThat(calls)
                .filteredOn(
                        call -> "RESULT_IDEMPOTENCY_CONFLICT".equals(call.errorCode()))
                .hasSize(4);
        assertThat(resultRepository.countByUserId(principal.id())).isEqualTo(1);
    }

    @Test
    void concurrentSessionCreationKeepsThePerAccountCap() throws Exception {
        UserAccount user =
                authService.register(
                        uniqueUsername("session_cap"), "correct-horse-battery");
        int workers = 24;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(workers)) {
            List<Future<SessionService.IssuedSession>> futures = new ArrayList<>();
            for (int index = 0; index < workers; index++) {
                futures.add(
                        executor.submit(
                                () -> {
                                    ready.countDown();
                                    start.await();
                                    return sessionService.create(user);
                                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<SessionService.IssuedSession> future : futures) {
                assertThat(future.get(20, TimeUnit.SECONDS).token()).isNotBlank();
            }
        }

        assertThat(sessionRepository.countByUserId(user.getId())).isEqualTo(10);
    }

    @Test
    void identicalResultRequestsAreBoundedBeforeDatabaseWork() {
        RillPrincipal principal = newPrincipal("request_limit");
        ResultDtos.CreateResultRequest request = resultRequest(UUID.randomUUID(), 6, 1);
        for (int attempt = 0; attempt < 20; attempt++) {
            resultService.create(principal, request);
        }

        assertThatThrownBy(() -> resultService.create(principal, request))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        exception -> {
                            assertThat(exception.getStatus()).isEqualTo(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS);
                            assertThat(exception.getCode()).isEqualTo("RATE_LIMITED");
                        });
    }

    @Test
    void accountExportsAreRateLimited() throws Exception {
        Client client = registeredClient("export_limit");
        for (int attempt = 0; attempt < 3; attempt++) {
            client.perform(get("/api/account/export")).andExpect(status().isOk());
        }
        client.perform(get("/api/account/export"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    private Client registeredClient(String prefix) throws Exception {
        Client client = bootstrap();
        MvcResult result =
                client.perform(
                                post("/api/auth/register")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                json.writeValueAsString(
                                                        new Credentials(
                                                                uniqueUsername(prefix),
                                                                "correct-horse-battery"))))
                        .andExpect(status().isCreated())
                        .andReturn();
        client.accept(result);
        return client;
    }

    private RillPrincipal newPrincipal(String prefix) {
        UserAccount user =
                authService.register(
                        uniqueUsername(prefix), "correct-horse-battery");
        return new RillPrincipal(user.getId(), user.getUsername(), user.getCreatedAt());
    }

    private static ResultDtos.CreateResultRequest resultRequest(
            UUID clientResultId, int correct, int incorrect) {
        return new ResultDtos.CreateResultRequest(
                clientResultId,
                TestMode.WORDS,
                10,
                false,
                false,
                5_000,
                7,
                correct,
                incorrect,
                5,
                2,
                0,
                1,
                List.of(
                        new ResultDtos.PaceBucket(1_000, 7),
                        new ResultDtos.PaceBucket(1_000, 0),
                        new ResultDtos.PaceBucket(1_000, 0),
                        new ResultDtos.PaceBucket(1_000, 0),
                        new ResultDtos.PaceBucket(1_000, 0)));
    }

    private Client bootstrap() throws Exception {
        Client client = new Client();
        MvcResult result =
                mvc.perform(get("/api/auth/session"))
                        .andExpect(status().isOk())
                        .andReturn();
        client.accept(result);
        return client;
    }

    private static String uniqueUsername(String prefix) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        return (prefix + "_" + suffix).substring(0, Math.min(24, prefix.length() + 9));
    }

    private String resultJson(UUID clientResultId, int typed, int correct, int incorrect) {
        return """
                {
                  "clientResultId": "%s",
                  "mode": "WORDS",
                  "modeValue": 10,
                  "punctuation": false,
                  "numbers": false,
                  "durationMs": 5000,
                  "typedCharacters": %d,
                  "correctAttempts": %d,
                  "incorrectAttempts": %d,
                  "correctCharacters": 5,
                  "missingCharacters": 2,
                  "extraAttempts": 0,
                  "correctedErrors": 1,
                  "paceBuckets": [
                    {"durationMs": 1000, "typedCharacters": %d},
                    {"durationMs": 1000, "typedCharacters": 0},
                    {"durationMs": 1000, "typedCharacters": 0},
                    {"durationMs": 1000, "typedCharacters": 0},
                    {"durationMs": 1000, "typedCharacters": 0}
                  ]
                }
                """
                .formatted(clientResultId, typed, correct, incorrect, typed);
    }

    private record Credentials(String username, String password) {}

    private record ConcurrentCall(
            TypingResultService.CreateOutcome outcome, String errorCode) {}

    private final class Client {
        private Cookie csrf;
        private Cookie session;
        private String csrfToken;

        org.springframework.test.web.servlet.ResultActions perform(
                org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request)
                throws Exception {
            if (csrf != null) {
                request.cookie(csrf);
                request.header("X-XSRF-TOKEN", csrfToken);
            }
            if (session != null) {
                request.cookie(session);
            }
            return mvc.perform(request);
        }

        void accept(MvcResult result) throws Exception {
            Cookie nextCsrf = result.getResponse().getCookie("XSRF-TOKEN");
            Cookie nextSession = result.getResponse().getCookie("RILL_SESSION");
            if (nextCsrf != null) {
                if (nextCsrf.getMaxAge() == 0) {
                    csrf = null;
                    csrfToken = null;
                } else {
                    csrf = nextCsrf;
                }
            }
            if (nextSession != null) {
                session = nextSession.getMaxAge() == 0 ? null : nextSession;
            }
            JsonNode body =
                    result.getResponse().getContentAsString().isBlank()
                            ? null
                            : json.readTree(result.getResponse().getContentAsString());
            if (body != null && body.has("csrfToken")) {
                csrfToken = body.get("csrfToken").stringValue();
            }
        }
    }
}
