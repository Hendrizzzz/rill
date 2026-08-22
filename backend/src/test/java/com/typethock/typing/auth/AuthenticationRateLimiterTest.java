package com.typethock.typing.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.typethock.typing.common.ApiException;
import com.typethock.typing.config.TypeThockProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthenticationRateLimiterTest {

    @Test
    void boundsGlobalAuthenticationAndRegistrationWork() {
        MutableClock clock = new MutableClock();
        AuthenticationRateLimiter limiter =
                new AuthenticationRateLimiter(clock, properties(2, 1));

        limiter.checkRegistration();
        assertRateLimited(limiter::checkRegistration);

        limiter.checkLogin();
        assertRateLimited(limiter::checkLogin);

        clock.advance(Duration.ofHours(1));
        limiter.checkRegistration();
        limiter.checkLogin();
    }

    @Test
    void authServiceChecksTheGlobalLimiterBeforeDatabaseOrBcryptWork() {
        UserAccountRepository users = mock(UserAccountRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        AuthenticationRateLimiter authenticationLimiter =
                mock(AuthenticationRateLimiter.class);
        LoginRateLimiter loginLimiter = mock(LoginRateLimiter.class);
        AccountDeletionRateLimiter deletionLimiter =
                mock(AccountDeletionRateLimiter.class);
        AuthService service =
                new AuthService(
                        users,
                        passwordEncoder,
                        authenticationLimiter,
                        loginLimiter,
                        deletionLimiter,
                        Clock.systemUTC());
        ApiException limited = rateLimited();

        doThrow(limited).when(authenticationLimiter).checkRegistration();
        assertThatThrownBy(() -> service.register("writer", "correct horse battery"))
                .isSameAs(limited);
        verifyNoInteractions(users, passwordEncoder, loginLimiter);

        doThrow(limited).when(authenticationLimiter).checkLogin();
        assertThatThrownBy(() -> service.login("reader", "correct horse battery"))
                .isSameAs(limited);
        verifyNoInteractions(users, passwordEncoder, loginLimiter);
    }

    @Test
    void rejectedAuthenticationDoesNotConsumeTheLongerRegistrationBudget() {
        MutableClock clock = new MutableClock();
        AuthenticationRateLimiter limiter =
                new AuthenticationRateLimiter(clock, properties(1, 1));

        limiter.checkLogin();
        assertRateLimited(limiter::checkRegistration);

        clock.advance(Duration.ofMinutes(1));
        limiter.checkRegistration();
        assertRateLimited(limiter::checkRegistration);
    }

    private static void assertRateLimited(Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOf(ApiException.class)
                .satisfies(
                        exception -> {
                            ApiException apiException = (ApiException) exception;
                            org.assertj.core.api.Assertions.assertThat(
                                            apiException.getStatus())
                                    .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                            org.assertj.core.api.Assertions.assertThat(apiException.getCode())
                                    .isEqualTo("RATE_LIMITED");
                        });
    }

    private static ApiException rateLimited() {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many attempts",
                "Please wait before trying again.");
    }

    private static TypeThockProperties properties(
            int maxAuthAttempts, int maxRegistrations) {
        return new TypeThockProperties(
                new TypeThockProperties.Cookie(
                        "TYPETHOCK_SESSION",
                        false,
                        Duration.ofDays(7),
                        Duration.ofMinutes(15)),
                List.of(),
                1000,
                10,
                120,
                240,
                maxAuthAttempts,
                maxRegistrations);
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-07-30T00:00:00Z");

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }
    }
}
