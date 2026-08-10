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
import com.rill.typing.result.CompletionReason;
import com.rill.typing.result.ContentType;
import com.rill.typing.result.CodeLanguage;
import com.rill.typing.result.ErrorPolicy;
import com.rill.typing.result.ResultDtos;
import com.rill.typing.result.TestMode;
import com.rill.typing.result.TypingLanguage;
import com.rill.typing.result.TypingResultRepository;
import com.rill.typing.result.TypingResultService;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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
            "rill.max-result-requests-per-minute=20",
            "rill.max-auth-attempts-per-minute=10000",
            "rill.max-registrations-per-hour=10000"
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
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;

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
                .andExpect(jsonPath("$.accuracy").value(85.71))
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
    void tinyTerminalPaceWindowIsOmittedFromTheChart() throws Exception {
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
                                          "contentType":"WORDS",
                                          "language":"EN",
                                          "errorPolicy":"NORMAL",
                                          "durationMs":2020,
                                          "typedCharacters":15,
                                          "correctAttempts":15,
                                          "incorrectAttempts":0,
                                          "correctCharacters":15,
                                          "incorrectCharacters":0,
                                          "missingCharacters":0,
                                          "extraAttempts":0,
                                          "correctedErrors":0,
                                          "paceBuckets":[
                                            {
                                              "durationMs":1000,
                                              "typedCharacters":7,
                                              "correctCharacters":7,
                                              "rawCharacters":7,
                                              "errors":0
                                            },
                                            {
                                              "durationMs":1000,
                                              "typedCharacters":7,
                                              "correctCharacters":14,
                                              "rawCharacters":14,
                                              "errors":0
                                            }
                                          ]
                                        }
                                        """
                                                .formatted(clientResultId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rawWpm").value(89.11))
                .andExpect(jsonPath("$.consistency").value(100.0))
                .andExpect(jsonPath("$.paceBuckets.length()").value(2));

        client.perform(get("/api/results").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].consistency").value(100.0));
    }

    @Test
    void canonicalRolloverBucketRetainsTheTerminalCharacter() throws Exception {
        Client client = registeredClient("rollover_terminal");

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
                                          "contentType":"WORDS",
                                          "language":"EN",
                                          "errorPolicy":"NORMAL",
                                          "durationMs":2000,
                                          "typedCharacters":3,
                                          "correctAttempts":3,
                                          "incorrectAttempts":0,
                                          "correctCharacters":3,
                                          "incorrectCharacters":0,
                                          "missingCharacters":0,
                                          "extraAttempts":0,
                                          "correctedErrors":0,
                                          "paceBuckets":[
                                            {
                                              "durationMs":1000,
                                              "typedCharacters":2,
                                              "correctCharacters":2,
                                              "rawCharacters":2,
                                              "errors":0
                                            },
                                            {
                                              "durationMs":1000,
                                              "typedCharacters":1,
                                              "correctCharacters":3,
                                              "rawCharacters":3,
                                              "errors":0
                                            }
                                          ]
                                        }
                                        """
                                                .formatted(UUID.randomUUID())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.typedCharacters").value(3))
                .andExpect(jsonPath("$.paceBuckets.length()").value(2))
                .andExpect(jsonPath("$.paceBuckets[1].typedCharacters").value(1))
                .andExpect(jsonPath("$.paceBuckets[1].correctCharacters").value(3));
    }

    @Test
    void correctedInputPersistsWithMoreAttemptsThanRetainedCharacters() throws Exception {
        Client client = registeredClient("corrected_input");

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
                                          "contentType":"WORDS",
                                          "language":"EN",
                                          "errorPolicy":"NORMAL",
                                          "durationMs":2000,
                                          "typedCharacters":3,
                                          "correctAttempts":3,
                                          "incorrectAttempts":1,
                                          "correctCharacters":3,
                                          "incorrectCharacters":0,
                                          "missingCharacters":0,
                                          "extraAttempts":0,
                                          "correctedErrors":1,
                                          "paceBuckets":[
                                            {
                                              "durationMs":1000,
                                              "typedCharacters":1,
                                              "correctCharacters":0,
                                              "rawCharacters":1,
                                              "errors":1
                                            },
                                            {
                                              "durationMs":1000,
                                              "typedCharacters":3,
                                              "correctCharacters":3,
                                              "rawCharacters":3,
                                              "errors":0
                                            }
                                          ]
                                        }
                                        """
                                                .formatted(UUID.randomUUID())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.typedCharacters").value(3))
                .andExpect(jsonPath("$.incorrectAttempts").value(1))
                .andExpect(jsonPath("$.correctedErrors").value(1))
                .andExpect(jsonPath("$.accuracy").value(75.0));
    }

    @Test
    void completionReasonRoundTripsThroughAccountHistory() throws Exception {
        Client client = registeredClient("completion_reason");
        List<CompletionCase> cases =
                List.of(
                        new CompletionCase(TestMode.WORDS, 10, 2000, CompletionReason.FINISHED),
                        new CompletionCase(
                                TestMode.WORDS,
                                10,
                                2000,
                                CompletionReason.PROMPT_EXHAUSTED),
                        new CompletionCase(TestMode.TIME, 15, 15_000, CompletionReason.TIME),
                        new CompletionCase(
                                TestMode.WORDS, 10, 600_000, CompletionReason.LIMIT));

        for (CompletionCase completion : cases) {
            client.perform(
                            post("/api/results")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(completionResultJson(UUID.randomUUID(), completion)))
                    .andExpect(status().isCreated())
                    .andExpect(
                            jsonPath("$.completionReason")
                                    .value(completion.reason().name()));

            client.perform(get("/api/results").param("limit", "1"))
                    .andExpect(status().isOk())
                    .andExpect(
                            jsonPath("$.items[0].completionReason")
                                    .value(completion.reason().name()));
        }
    }

    @Test
    void fractionalWordGraphTailRoundTrips() throws Exception {
        Client client = registeredClient("fractional_tail");
        CompletionCase completion =
                new CompletionCase(TestMode.WORDS, 10, 1_500, CompletionReason.FINISHED);
        String payload = completionResultJson(UUID.randomUUID(), completion, 500.49);

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.durationMs").value(1_500))
                .andExpect(jsonPath("$.paceBuckets[1].durationMs").value(500.49));

        client.perform(get("/api/results").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].paceBuckets[1].durationMs").value(500.49));

        CompletionCase afterWholeSecond =
                new CompletionCase(TestMode.WORDS, 10, 1_530, CompletionReason.FINISHED);
        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        completionResultJson(
                                                UUID.randomUUID(),
                                                afterWholeSecond,
                                                534.56)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.paceBuckets[1].durationMs").value(534.56));

        client.perform(get("/api/results").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].paceBuckets[1].durationMs").value(534.56));
    }

    @Test
    void paceBucketDurationBeyondHundredthPrecisionIsRejected() throws Exception {
        Client client = registeredClient("fractional_precision");
        CompletionCase completion =
                new CompletionCase(TestMode.WORDS, 10, 1_500, CompletionReason.FINISHED);

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        completionResultJson(
                                                UUID.randomUUID(), completion, 500.491)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void rawGraphDurationAtNextAggregateBoundaryIsRejected() throws Exception {
        Client client = registeredClient("aggregate_boundary");
        CompletionCase completion =
                new CompletionCase(TestMode.WORDS, 10, 1_500, CompletionReason.FINISHED);

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        completionResultJson(
                                                UUID.randomUUID(), completion, 505.0)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void impossibleCompletionReasonCombinationsAreRejected() throws Exception {
        Client client = registeredClient("completion_invalid");
        List<CompletionCase> invalid =
                List.of(
                        new CompletionCase(
                                TestMode.TIME, 15, 15_000, CompletionReason.FINISHED),
                        new CompletionCase(TestMode.WORDS, 10, 2000, CompletionReason.TIME),
                        new CompletionCase(TestMode.WORDS, 10, 2000, CompletionReason.LIMIT));

        for (CompletionCase completion : invalid) {
            client.perform(
                            post("/api/results")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(completionResultJson(UUID.randomUUID(), completion)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
    }

    @Test
    void subsecondAndNonCanonicalWordDurationsAreRejected() throws Exception {
        Client client = registeredClient("duration_grid");
        for (int durationMs : List.of(1, 10, 990, 999, 1_001, 4_999)) {
            CompletionCase completion =
                    new CompletionCase(
                            TestMode.WORDS,
                            10,
                            durationMs,
                            CompletionReason.FINISHED);

            client.perform(
                            post("/api/results")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            completionResultJson(
                                                    UUID.randomUUID(), completion)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
    }

    @Test
    void minimumPersistableWordDurationRoundTrips() throws Exception {
        Client client = registeredClient("duration_minimum");
        CompletionCase completion =
                new CompletionCase(
                        TestMode.WORDS, 10, 1_000, CompletionReason.FINISHED);

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        completionResultJson(
                                                UUID.randomUUID(), completion)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.durationMs").value(1_000))
                .andExpect(jsonPath("$.wpm").value(36.0))
                .andExpect(jsonPath("$.paceBuckets.length()").value(1));

        client.perform(get("/api/results").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test
    void correctedErrorsCannotExceedIncorrectAttempts() throws Exception {
        Client client = registeredClient("corrected_bound");

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
                                          "contentType":"WORDS",
                                          "language":"EN",
                                          "errorPolicy":"NORMAL",
                                          "durationMs":2000,
                                          "typedCharacters":3,
                                          "correctAttempts":3,
                                          "incorrectAttempts":0,
                                          "correctCharacters":3,
                                          "incorrectCharacters":0,
                                          "missingCharacters":0,
                                          "extraAttempts":0,
                                          "correctedErrors":1,
                                          "completionReason":"FINISHED",
                                          "paceBuckets":[
                                            {
                                              "durationMs":1000,
                                              "typedCharacters":3,
                                              "correctCharacters":3,
                                              "rawCharacters":3,
                                              "errors":0
                                            },
                                            {
                                              "durationMs":1000,
                                              "typedCharacters":0,
                                              "correctCharacters":3,
                                              "rawCharacters":3,
                                              "errors":0
                                            }
                                          ]
                                        }
                                        """
                                                .formatted(UUID.randomUUID())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void burstHalfValuesUseJavascriptCompatibleRounding() throws Exception {
        Client client = registeredClient("burst_rounding");

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
                                          "contentType":"WORDS",
                                          "language":"EN",
                                          "errorPolicy":"NORMAL",
                                          "durationMs":1960,
                                          "typedCharacters":2,
                                          "correctAttempts":2,
                                          "incorrectAttempts":0,
                                          "correctCharacters":2,
                                          "incorrectCharacters":0,
                                          "missingCharacters":0,
                                          "extraAttempts":0,
                                          "correctedErrors":0,
                                          "paceBuckets":[
                                            {
                                              "durationMs":1000,
                                              "typedCharacters":1,
                                              "correctCharacters":1,
                                              "rawCharacters":1,
                                              "errors":0
                                            },
                                            {
                                              "durationMs":960,
                                              "typedCharacters":1,
                                              "correctCharacters":2,
                                              "rawCharacters":2,
                                              "errors":0
                                            }
                                          ]
                                        }
                                        """
                                                .formatted(UUID.randomUUID())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.consistency").value(96.0));
    }

    @Test
    void sourceArithmeticOrderAndJavascriptRoundingArePreserved() throws Exception {
        Client client = registeredClient("metric_order");

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        metricResultJson(
                                                UUID.randomUUID(),
                                                3_840,
                                                33,
                                                33,
                                                0,
                                                33,
                                                0,
                                                List.of(
                                                        new ResultDtos.PaceBucket(
                                                                1_000, 8, 8, 8, 0),
                                                        new ResultDtos.PaceBucket(
                                                                1_000, 8, 16, 16, 0),
                                                        new ResultDtos.PaceBucket(
                                                                1_000, 8, 24, 24, 0),
                                                        new ResultDtos.PaceBucket(
                                                                840, 9, 33, 33, 0)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.wpm").value(103.12))
                .andExpect(jsonPath("$.rawWpm").value(103.12));

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        metricResultJson(
                                                UUID.randomUUID(),
                                                1_000,
                                                160,
                                                23,
                                                137,
                                                23,
                                                137,
                                                List.of(
                                                        new ResultDtos.PaceBucket(
                                                                1_000, 160, 23, 160, 137)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accuracy").value(14.37));

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        metricResultJson(
                                                UUID.randomUUID(),
                                                1_000,
                                                800,
                                                29,
                                                771,
                                                29,
                                                771,
                                                List.of(
                                                        new ResultDtos.PaceBucket(
                                                                1_000, 800, 29, 800, 771)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accuracy").value(3.63));

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        metricResultJson(
                                                UUID.randomUUID(),
                                                1_770,
                                                28,
                                                28,
                                                0,
                                                28,
                                                0,
                                                List.of(
                                                        new ResultDtos.PaceBucket(
                                                                1_000, 16, 16, 16, 0),
                                                        new ResultDtos.PaceBucket(
                                                                768, 12, 28, 28, 0)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.consistency").value(98.68));
    }

    @Test
    void contentLanguageAndErrorPolicyRoundTripAndPartitionRecords()
            throws Exception {
        Client client = registeredClient("test_dimensions");

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        dimensionedResultJson(
                                                UUID.randomUUID(),
                                                ContentType.QUOTE,
                                                TypingLanguage.EN,
                                                ErrorPolicy.STRICT)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.contentType").value("QUOTE"))
                .andExpect(jsonPath("$.language").value("EN"))
                .andExpect(jsonPath("$.wordListVersion").value("quote-v3"))
                .andExpect(jsonPath("$.errorPolicy").value("STRICT"));

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        dimensionedResultJson(
                                                UUID.randomUUID(),
                                                ContentType.CUSTOM,
                                                TypingLanguage.ES,
                                                ErrorPolicy.NORMAL)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.contentType").value("CUSTOM"))
                .andExpect(jsonPath("$.language").value("ES"))
                .andExpect(jsonPath("$.wordListVersion").value("custom-v1"));

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        dimensionedResultJson(
                                                UUID.randomUUID(),
                                                ContentType.CODE,
                                                TypingLanguage.EN,
                                                CodeLanguage.PYTHON3,
                                                ErrorPolicy.NORMAL)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.contentType").value("CODE"))
                .andExpect(jsonPath("$.language").value("EN"))
                .andExpect(jsonPath("$.codeLanguage").value("PYTHON3"))
                .andExpect(jsonPath("$.wordListVersion").value("code-v4"))
                .andExpect(jsonPath("$.oldestResultsPruned").value(1));

        MvcResult summary =
                client.perform(get("/api/results/summary"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.records.length()").value(2))
                        .andReturn();
        int matchingCodeRecords = 0;
        for (JsonNode record :
                json.readTree(summary.getResponse().getContentAsString()).get("records")) {
            JsonNode key = record.get("key");
            if ("CODE".equals(key.get("contentType").stringValue())
                    && "PYTHON3".equals(key.get("codeLanguage").stringValue())
                    && "code-v4".equals(key.get("wordListVersion").stringValue())) {
                matchingCodeRecords++;
            }
        }
        assertThat(matchingCodeRecords).isEqualTo(1);

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        dimensionedResultJson(
                                                UUID.randomUUID(),
                                                ContentType.QUOTE,
                                                TypingLanguage.ES,
                                                ErrorPolicy.NORMAL)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        dimensionedResultJson(
                                                UUID.randomUUID(),
                                                ContentType.CODE,
                                                TypingLanguage.EN,
                                                ErrorPolicy.NORMAL)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void everyCodeLanguageRoundTripsThroughTheResultApi() throws Exception {
        Client client = registeredClient("code_languages");

        for (CodeLanguage language : CodeLanguage.values()) {
            client.perform(
                            post("/api/results")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            dimensionedResultJson(
                                                    UUID.randomUUID(),
                                                    ContentType.CODE,
                                                    TypingLanguage.EN,
                                                    language,
                                                    ErrorPolicy.NORMAL)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.contentType").value("CODE"))
                    .andExpect(jsonPath("$.language").value("EN"))
                    .andExpect(jsonPath("$.codeLanguage").value(language.name()))
                    .andExpect(jsonPath("$.wordListVersion").value("code-v4"));
        }
    }

    @Test
    void corpusVersionsPartitionOtherwiseIdenticalCodeRecords() throws Exception {
        Client client = registeredClient("code_versions");
        UUID legacyResult = UUID.randomUUID();
        String legacyBody =
                dimensionedResultJson(
                                legacyResult,
                                ContentType.CODE,
                                TypingLanguage.EN,
                                CodeLanguage.PYTHON3,
                                ErrorPolicy.NORMAL)
                        .replace(
                                "\"wordListVersion\":\"code-v4\"",
                                "\"wordListVersion\":\"code-v1\"");

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(legacyBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.wordListVersion").value("code-v1"));

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        dimensionedResultJson(
                                                legacyResult,
                                                ContentType.CODE,
                                                TypingLanguage.EN,
                                                CodeLanguage.PYTHON3,
                                                ErrorPolicy.NORMAL)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESULT_IDEMPOTENCY_CONFLICT"));

        String previousBody =
                dimensionedResultJson(
                                UUID.randomUUID(),
                                ContentType.CODE,
                                TypingLanguage.EN,
                                CodeLanguage.PYTHON3,
                                ErrorPolicy.NORMAL)
                        .replace(
                                "\"wordListVersion\":\"code-v4\"",
                                "\"wordListVersion\":\"code-v2\"");

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(previousBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.wordListVersion").value("code-v2"));

        String contextualBody =
                dimensionedResultJson(
                                UUID.randomUUID(),
                                ContentType.CODE,
                                TypingLanguage.EN,
                                CodeLanguage.PYTHON3,
                                ErrorPolicy.NORMAL)
                        .replace(
                                "\"wordListVersion\":\"code-v4\"",
                                "\"wordListVersion\":\"code-v3\"");

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(contextualBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.wordListVersion").value("code-v3"));

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        dimensionedResultJson(
                                                UUID.randomUUID(),
                                                ContentType.CODE,
                                                TypingLanguage.EN,
                                                CodeLanguage.PYTHON3,
                                                ErrorPolicy.NORMAL)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.wordListVersion").value("code-v4"));

        client.perform(get("/api/results/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records.length()").value(4))
                .andExpect(
                        jsonPath(
                                "$.records[*].key.wordListVersion",
                                org.hamcrest.Matchers.containsInAnyOrder(
                                        "code-v1", "code-v2", "code-v3", "code-v4")));

        String invalidVersion =
                dimensionedResultJson(
                                UUID.randomUUID(),
                                ContentType.CODE,
                                TypingLanguage.EN,
                                CodeLanguage.PYTHON3,
                                ErrorPolicy.NORMAL)
                        .replace(
                                "\"wordListVersion\":\"code-v4\"",
                                "\"wordListVersion\":\"en-v1\"");
        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(invalidVersion))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        Client legacyClient = registeredClient("code_version_omitted");
        String omittedVersion =
                dimensionedResultJson(
                                UUID.randomUUID(),
                                ContentType.CODE,
                                TypingLanguage.EN,
                                CodeLanguage.PYTHON3,
                                ErrorPolicy.NORMAL)
                        .replace("\"wordListVersion\":\"code-v4\",", "");
        legacyClient.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(omittedVersion))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.wordListVersion").value("code-v1"));
    }

    @Test
    void corpusVersionsPartitionOtherwiseIdenticalQuoteRecords() throws Exception {
        Client client = registeredClient("quote_versions");

        for (String version : List.of("quote-v1", "quote-v2", "quote-v3")) {
            String body =
                    dimensionedResultJson(
                                    UUID.randomUUID(),
                                    ContentType.QUOTE,
                                    TypingLanguage.EN,
                                    null,
                                    ErrorPolicy.NORMAL)
                            .replace(
                                    "\"wordListVersion\":\"quote-v3\"",
                                    "\"wordListVersion\":\"" + version + "\"");
            client.perform(
                            post("/api/results")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.wordListVersion").value(version));
        }

        client.perform(get("/api/results/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records.length()").value(3))
                .andExpect(
                        jsonPath(
                                "$.records[*].key.wordListVersion",
                                org.hamcrest.Matchers.containsInAnyOrder(
                                        "quote-v1", "quote-v2", "quote-v3")));
    }

    @Test
    void omittedLegacyQuoteVersionUsesOriginalCorpusIdentity() throws Exception {
        Client legacyClient = registeredClient("quote_version_omitted");
        String omittedVersion =
                dimensionedResultJson(
                                UUID.randomUUID(),
                                ContentType.QUOTE,
                                TypingLanguage.EN,
                                null,
                                ErrorPolicy.NORMAL)
                        .replace("\"wordListVersion\":\"quote-v3\",", "");

        legacyClient.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(omittedVersion))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.wordListVersion").value("quote-v1"));
    }

    @Test
    void legacyPaceJsonFallsBackToNoGraphInsteadOfInventingZeroLines()
            throws Exception {
        Client client = registeredClient("legacy_pace");
        UUID resultId = UUID.randomUUID();

        MvcResult created =
                client.perform(
                                post("/api/results")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(resultJson(resultId, 7, 6, 1)))
                        .andExpect(status().isCreated())
                        .andReturn();
        double persistedConsistency =
                json.readTree(created.getResponse().getContentAsString())
                        .get("consistency")
                        .doubleValue();
        jdbc.update(
                "UPDATE typing_result SET pace_buckets_json = ?"
                        + " WHERE client_result_id = ?",
                """
                [{"durationMs":1000,"typedCharacters":7}]
                """,
                resultId);

        client.perform(get("/api/results").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].wpm").value(12.0))
                .andExpect(
                        jsonPath("$.items[0].consistency")
                                .value(persistedConsistency))
                .andExpect(jsonPath("$.items[0].paceBuckets").isEmpty());
    }

    @Test
    void populatedV1SchemaUpgradesWithoutRewritingLegacyResultCounters() {
        String schema =
                "upgrade_" + UUID.randomUUID().toString().replace("-", "");
        UUID userId = UUID.randomUUID();
        UUID legacyInvalidResultId = UUID.randomUUID();
        UUID subsecondResultId = UUID.randomUUID();
        UUID boundaryResultId = UUID.randomUUID();
        try {
            jdbc.execute("CREATE SCHEMA " + schema);
            Flyway.configure()
                    .dataSource(dataSource)
                    .defaultSchema(schema)
                    .schemas(schema)
                    .locations("classpath:db/migration")
                    .target(MigrationVersion.fromVersion("1"))
                    .load()
                    .migrate();
            jdbc.update(
                    """
                    INSERT INTO %s.app_user (
                        id, username, username_normalized, password_hash, created_at
                    ) VALUES (?, 'legacy_user', 'legacy_user', '{bcrypt}legacy', now())
                    """
                            .formatted(schema),
                    userId);
            jdbc.update(
                    """
                    -- This row is valid under V1 but deliberately violates both
                    -- richer retained-scoring checks added as NOT VALID later.
                    INSERT INTO %s.typing_result (
                        id, user_id, client_result_id, mode, mode_value,
                        punctuation, numbers, duration_ms, typed_characters,
                        correct_attempts, incorrect_attempts, correct_characters,
                        missing_characters, extra_attempts, corrected_errors,
                        wpm, raw_wpm, accuracy, consistency, pace_buckets_json,
                        completed_at
                    ) VALUES (
                        ?, ?, ?, 'WORDS', 10, false, false, 1000, 2,
                        1, 1, 2, 0, 1, 2, 23, 23, 49, 80,
                        '[{"durationMs":1000,"typedCharacters":2}]', now()
                    )
                    """
                            .formatted(schema),
                    legacyInvalidResultId,
                    userId,
                    UUID.randomUUID());
            jdbc.update(
                    """
                    -- V1 through V8 accepted this result. V9 must remove it
                    -- before validating the one-second persistence boundary.
                    INSERT INTO %s.typing_result (
                        id, user_id, client_result_id, mode, mode_value,
                        punctuation, numbers, duration_ms, typed_characters,
                        correct_attempts, incorrect_attempts, correct_characters,
                        missing_characters, extra_attempts, corrected_errors,
                        wpm, raw_wpm, accuracy, consistency, pace_buckets_json,
                        completed_at
                    ) VALUES (
                        ?, ?, ?, 'WORDS', 10, false, false, 990, 2,
                        2, 0, 2, 0, 0, 0, 24, 24, 100, 100,
                        '[]', now()
                    )
                    """
                            .formatted(schema),
                    subsecondResultId,
                    userId,
                    UUID.randomUUID());
            jdbc.update(
                    """
                    INSERT INTO %s.typing_result (
                        id, user_id, client_result_id, mode, mode_value,
                        punctuation, numbers, duration_ms, typed_characters,
                        correct_attempts, incorrect_attempts, correct_characters,
                        missing_characters, extra_attempts, corrected_errors,
                        wpm, raw_wpm, accuracy, consistency, pace_buckets_json,
                        completed_at
                    ) VALUES (
                        ?, ?, ?, 'TIME', 15, false, false, 15000, 2,
                        1, 1, 2, 0, 0, 0, 1.6, 1.6, 50, 100,
                        '[{"durationMs":1000,"typedCharacters":2}]', now()
                    )
                    """
                            .formatted(schema),
                    UUID.randomUUID(),
                    userId,
                    UUID.randomUUID());
            jdbc.update(
                    """
                    INSERT INTO %s.typing_result (
                        id, user_id, client_result_id, mode, mode_value,
                        punctuation, numbers, duration_ms, typed_characters,
                        correct_attempts, incorrect_attempts, correct_characters,
                        missing_characters, extra_attempts, corrected_errors,
                        wpm, raw_wpm, accuracy, consistency, pace_buckets_json,
                        completed_at
                    ) VALUES (
                        ?, ?, ?, 'WORDS', 10, false, false, 3840, 33,
                        33, 0, 33, 0, 0, 0, 103.13, 103.13, 100, 100,
                        '[{"durationMs":1000,"typedCharacters":33}]', now()
                    )
                    """
                            .formatted(schema),
                    boundaryResultId,
                    userId,
                    UUID.randomUUID());

            Flyway.configure()
                    .dataSource(dataSource)
                    .defaultSchema(schema)
                    .schemas(schema)
                    .locations("classpath:db/migration")
                    .load()
                    .migrate();

            assertThat(
                            jdbc.queryForObject(
                                    "SELECT count(*) FROM "
                                            + schema
                                            + ".typing_result",
                                    Integer.class))
                    .isEqualTo(3);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT count(*) FROM "
                                            + schema
                                            + ".typing_result WHERE id = ?",
                                    Integer.class,
                                    subsecondResultId))
                    .isZero();
            assertThat(
                            jdbc.queryForList(
                                    """
                                    SELECT mode, typed_characters, correct_attempts,
                                           incorrect_attempts, correct_characters,
                                           incorrect_characters, missing_characters,
                                           extra_attempts, corrected_errors, completion_reason,
                                           wpm, raw_wpm, accuracy, content_type,
                                           language, word_list_version, error_policy
                                    FROM %s.typing_result
                                    WHERE id <> ?
                                    ORDER BY mode
                                    """
                                            .formatted(schema),
                                    boundaryResultId))
                    .containsExactly(
                            Map.ofEntries(
                                    Map.entry("mode", "TIME"),
                                    Map.entry("typed_characters", 2),
                                    Map.entry("correct_attempts", 1),
                                    Map.entry("incorrect_attempts", 1),
                                    Map.entry("correct_characters", 2),
                                    Map.entry("incorrect_characters", 0),
                                    Map.entry("missing_characters", 0),
                                    Map.entry("extra_attempts", 0),
                                    Map.entry("corrected_errors", 0),
                                    Map.entry("completion_reason", "TIME"),
                                    Map.entry("wpm", new BigDecimal("1.60")),
                                    Map.entry("raw_wpm", new BigDecimal("1.60")),
                                    Map.entry("accuracy", new BigDecimal("50.00")),
                                    Map.entry("content_type", "WORDS"),
                                    Map.entry("language", "EN"),
                                    Map.entry("word_list_version", "en-v1"),
                                    Map.entry("error_policy", "NORMAL")),
                            Map.ofEntries(
                                    Map.entry("mode", "WORDS"),
                                    Map.entry("typed_characters", 2),
                                    Map.entry("correct_attempts", 1),
                                    Map.entry("incorrect_attempts", 1),
                                    Map.entry("correct_characters", 2),
                                    Map.entry("incorrect_characters", 0),
                                    Map.entry("missing_characters", 0),
                                    Map.entry("extra_attempts", 1),
                                    Map.entry("corrected_errors", 2),
                                    Map.entry("completion_reason", "FINISHED"),
                                    Map.entry("wpm", new BigDecimal("24.00")),
                                    Map.entry("raw_wpm", new BigDecimal("24.00")),
                                    Map.entry("accuracy", new BigDecimal("50.00")),
                                    Map.entry("content_type", "WORDS"),
                                    Map.entry("language", "EN"),
                                    Map.entry("word_list_version", "en-v1"),
                                    Map.entry("error_policy", "NORMAL")));
            assertThat(
                            jdbc.queryForMap(
                                    """
                                    SELECT wpm, raw_wpm, accuracy
                                    FROM %s.typing_result
                                    WHERE id = ?
                                    """
                                            .formatted(schema),
                                    boundaryResultId))
                    .containsEntry("wpm", new BigDecimal("103.12"))
                    .containsEntry("raw_wpm", new BigDecimal("103.12"))
                    .containsEntry("accuracy", new BigDecimal("100.00"));
            assertThat(
                            jdbc.queryForObject(
                                    """
                                    SELECT convalidated
                                    FROM pg_constraint
                                    WHERE conname = 'ck_typing_result_duration'
                                      AND conrelid = ?::regclass
                                    """,
                                    Boolean.class,
                                    schema + ".typing_result"))
                    .isTrue();
            assertThatThrownBy(
                            () ->
                                    jdbc.update(
                                            "UPDATE "
                                                    + schema
                                                    + ".typing_result SET duration_ms = 990 WHERE id = ?",
                                            boundaryResultId))
                    .hasMessageContaining("ck_typing_result_duration");
            assertThat(
                            jdbc.update(
                                    "UPDATE "
                                            + schema
                                            + ".typing_result SET duration_ms = 1000 WHERE id = ?",
                                    boundaryResultId))
                    .isEqualTo(1);
            assertThat(
                            jdbc.queryForObject(
                                    """
                                    SELECT convalidated
                                    FROM pg_constraint
                                    WHERE conname = 'ck_typing_result_character_ranges'
                                      AND conrelid = ?::regclass
                                    """,
                                    Boolean.class,
                                    schema + ".typing_result"))
                    .isFalse();
            assertThat(
                            jdbc.queryForObject(
                                    """
                                    SELECT convalidated
                                    FROM pg_constraint
                                    WHERE conname = 'ck_typing_result_corrected_error_attempts'
                                      AND conrelid = ?::regclass
                                    """,
                                    Boolean.class,
                                    schema + ".typing_result"))
                    .isFalse();
        } finally {
            jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
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
    void maximumPersistableCharacterCountProducesBoundedSpeed() throws Exception {
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
                                          "contentType":"WORDS",
                                          "language":"EN",
                                          "errorPolicy":"NORMAL",
                                          "durationMs":1000,
                                          "typedCharacters":50000,
                                          "correctAttempts":50000,
                                          "incorrectAttempts":0,
                                          "correctCharacters":50000,
                                          "incorrectCharacters":0,
                                          "missingCharacters":0,
                                          "extraAttempts":0,
                                          "correctedErrors":0,
                                          "paceBuckets":[{
                                            "durationMs":1000,
                                            "typedCharacters":50000,
                                            "correctCharacters":50000,
                                            "rawCharacters":50000,
                                            "errors":0
                                          }]
                                        }
                                        """
                                                .formatted(UUID.randomUUID())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.wpm").value(600000.0))
                .andExpect(jsonPath("$.rawWpm").value(600000.0));
    }

    @Test
    void impossibleResultAndPaceCounterRelationsAreRejected() throws Exception {
        Client client = registeredClient("counter_bounds");
        String baseline = resultJson(UUID.randomUUID(), 7, 6, 1);
        List<String> invalidPayloads =
                List.of(
                        baseline.replace(
                                "\"typedCharacters\": 7",
                                "\"typedCharacters\": 8"),
                        baseline.replace(
                                "\"incorrectCharacters\": 1",
                                "\"incorrectCharacters\": 3"),
                        baseline.replace("\"errors\": 1", "\"errors\": 8"),
                        baseline.replace(
                                "\"rawCharacters\": 7",
                                "\"rawCharacters\": 4"),
                        baseline.replaceFirst(
                                "\"typedCharacters\": 7",
                                "\"typedCharacters\": 6"));

        for (String payload : invalidPayloads) {
            client.perform(
                            post("/api/results")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(payload))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
    }

    @Test
    void cumulativePaceCannotExceedInsertionsSeenByThatBucket() throws Exception {
        Client client = registeredClient("pace_prefix");
        List<ResultDtos.PaceBucket> buckets =
                List.of(
                        new ResultDtos.PaceBucket(1000, 1, 2, 2, 0),
                        new ResultDtos.PaceBucket(1000, 2, 3, 3, 0));

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        metricResultJson(
                                                UUID.randomUUID(),
                                                2000,
                                                3,
                                                3,
                                                0,
                                                3,
                                                0,
                                                buckets)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void cumulativePaceMayDecreaseAfterBackspacing() throws Exception {
        Client client = registeredClient("pace_backspace");
        List<ResultDtos.PaceBucket> buckets =
                List.of(
                        new ResultDtos.PaceBucket(1000, 3, 3, 3, 0),
                        new ResultDtos.PaceBucket(1000, 1, 1, 1, 0));

        client.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        metricResultJson(
                                                UUID.randomUUID(),
                                                2000,
                                                1,
                                                4,
                                                0,
                                                1,
                                                0,
                                                buckets)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.paceBuckets[0].rawCharacters").value(3))
                .andExpect(jsonPath("$.paceBuckets[1].rawCharacters").value(1));
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
                ContentType.WORDS,
                TypingLanguage.EN,
                null,
                "en-v1",
                ErrorPolicy.NORMAL,
                5_000,
                7,
                correct,
                incorrect,
                5,
                1,
                2,
                0,
                1,
                null,
                List.of(
                        new ResultDtos.PaceBucket(1_000, 7, 5, 7, incorrect),
                        new ResultDtos.PaceBucket(1_000, 0, 5, 7, 0),
                        new ResultDtos.PaceBucket(1_000, 0, 5, 7, 0),
                        new ResultDtos.PaceBucket(1_000, 0, 5, 7, 0),
                        new ResultDtos.PaceBucket(1_000, 0, 5, 7, 0)));
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

    private String completionResultJson(
            UUID clientResultId, CompletionCase completion) {
        return completionResultJson(clientResultId, completion, null);
    }

    private String completionResultJson(
            UUID clientResultId,
            CompletionCase completion,
            Double finalBucketDurationOverride) {
        int bucketCount = completion.durationMs() / 1000;
        if (completion.mode() == TestMode.WORDS
                && completion.durationMs() % 1000 >= 500) {
            bucketCount += 1;
        }
        List<Map<String, Object>> buckets = new ArrayList<>(bucketCount);
        for (int index = 0; index < bucketCount; index++) {
            Map<String, Object> bucket = new LinkedHashMap<>();
            int bucketDuration =
                    index == bucketCount - 1 && completion.durationMs() % 1000 != 0
                            ? completion.durationMs() % 1000
                            : 1000;
            bucket.put(
                    "durationMs",
                    index == bucketCount - 1 && finalBucketDurationOverride != null
                            ? finalBucketDurationOverride
                            : (double) bucketDuration);
            bucket.put("typedCharacters", index == 0 ? 3 : 0);
            bucket.put("correctCharacters", 3);
            bucket.put("rawCharacters", 3);
            bucket.put("errors", 0);
            buckets.add(bucket);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clientResultId", clientResultId);
        body.put("mode", completion.mode().name());
        body.put("modeValue", completion.modeValue());
        body.put("punctuation", false);
        body.put("numbers", false);
        body.put("contentType", ContentType.WORDS.name());
        body.put("language", TypingLanguage.EN.name());
        body.put("errorPolicy", ErrorPolicy.NORMAL.name());
        body.put("durationMs", completion.durationMs());
        body.put("typedCharacters", 3);
        body.put("correctAttempts", 3);
        body.put("incorrectAttempts", 0);
        body.put("correctCharacters", 3);
        body.put("incorrectCharacters", 0);
        body.put("missingCharacters", 0);
        body.put("extraAttempts", 0);
        body.put("correctedErrors", 0);
        body.put("completionReason", completion.reason().name());
        body.put("paceBuckets", buckets);
        return json.writeValueAsString(body);
    }

    private String resultJson(UUID clientResultId, int typed, int correct, int incorrect) {
        return """
                {
                  "clientResultId": "%s",
                  "mode": "WORDS",
                  "modeValue": 10,
                  "punctuation": false,
                  "numbers": false,
                  "contentType": "WORDS",
                  "language": "EN",
                  "errorPolicy": "NORMAL",
                  "durationMs": 5000,
                  "typedCharacters": %d,
                  "correctAttempts": %d,
                  "incorrectAttempts": %d,
                  "correctCharacters": 5,
                  "incorrectCharacters": 1,
                  "missingCharacters": 2,
                  "extraAttempts": 0,
                  "correctedErrors": 1,
                  "paceBuckets": [
                    {
                      "durationMs": 1000,
                      "typedCharacters": %d,
                      "correctCharacters": 5,
                      "rawCharacters": 7,
                      "errors": %d
                    },
                    {
                      "durationMs": 1000,
                      "typedCharacters": 0,
                      "correctCharacters": 5,
                      "rawCharacters": 7,
                      "errors": 0
                    },
                    {
                      "durationMs": 1000,
                      "typedCharacters": 0,
                      "correctCharacters": 5,
                      "rawCharacters": 7,
                      "errors": 0
                    },
                    {
                      "durationMs": 1000,
                      "typedCharacters": 0,
                      "correctCharacters": 5,
                      "rawCharacters": 7,
                      "errors": 0
                    },
                    {
                      "durationMs": 1000,
                      "typedCharacters": 0,
                      "correctCharacters": 5,
                      "rawCharacters": 7,
                      "errors": 0
                    }
                  ]
                }
                """
                .formatted(
                        clientResultId,
                        typed,
                        correct,
                        incorrect,
                        typed,
                        incorrect);
    }

    private String metricResultJson(
            UUID clientResultId,
            int durationMs,
            int typedCharacters,
            int correctAttempts,
            int incorrectAttempts,
            int correctCharacters,
            int incorrectCharacters,
            List<ResultDtos.PaceBucket> paceBuckets) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clientResultId", clientResultId);
        body.put("mode", TestMode.WORDS.name());
        body.put("modeValue", 10);
        body.put("punctuation", false);
        body.put("numbers", false);
        body.put("contentType", ContentType.WORDS.name());
        body.put("language", TypingLanguage.EN.name());
        body.put("errorPolicy", ErrorPolicy.NORMAL.name());
        body.put("durationMs", durationMs);
        body.put("typedCharacters", typedCharacters);
        body.put("correctAttempts", correctAttempts);
        body.put("incorrectAttempts", incorrectAttempts);
        body.put("correctCharacters", correctCharacters);
        body.put("incorrectCharacters", incorrectCharacters);
        body.put("missingCharacters", 0);
        body.put("extraAttempts", 0);
        body.put("correctedErrors", 0);
        body.put("completionReason", CompletionReason.FINISHED.name());
        body.put("paceBuckets", paceBuckets);
        return json.writeValueAsString(body);
    }

    private String dimensionedResultJson(
            UUID clientResultId,
            ContentType contentType,
            TypingLanguage language,
            ErrorPolicy errorPolicy) {
        return dimensionedResultJson(
                clientResultId, contentType, language, null, errorPolicy);
    }

    private String dimensionedResultJson(
            UUID clientResultId,
            ContentType contentType,
            TypingLanguage language,
            CodeLanguage codeLanguage,
            ErrorPolicy errorPolicy) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clientResultId", clientResultId);
        body.put("mode", TestMode.WORDS.name());
        body.put("modeValue", 2);
        body.put("punctuation", false);
        body.put("numbers", false);
        body.put("contentType", contentType.name());
        body.put("language", language.name());
        if (codeLanguage != null) {
            body.put("codeLanguage", codeLanguage.name());
        }
        body.put(
                "wordListVersion",
                switch (contentType) {
                    case WORDS -> language == TypingLanguage.ES ? "es-v1" : "en-v1";
                    case QUOTE -> "quote-v3";
                    case CUSTOM -> "custom-v1";
                    case CODE -> "code-v4";
                });
        body.put("errorPolicy", errorPolicy.name());
        body.put("durationMs", 1_000);
        body.put("typedCharacters", 2);
        body.put("correctAttempts", 2);
        body.put("incorrectAttempts", 0);
        body.put("correctCharacters", 2);
        body.put("incorrectCharacters", 0);
        body.put("missingCharacters", 0);
        body.put("extraAttempts", 0);
        body.put("correctedErrors", 0);
        body.put("completionReason", CompletionReason.FINISHED.name());
        body.put(
                "paceBuckets",
                List.of(new ResultDtos.PaceBucket(1_000, 2, 2, 2, 0)));
        return json.writeValueAsString(body);
    }

    private record Credentials(String username, String password) {}

    private record CompletionCase(
            TestMode mode,
            int modeValue,
            int durationMs,
            CompletionReason reason) {}

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
