package com.rill.typing.auth;

import com.rill.typing.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final Pattern USERNAME = Pattern.compile("[A-Za-z0-9_]{3,24}");
    private static final String DUMMY_HASH =
            "{bcrypt}$2a$12$4R51VSPvRCcY.Q8x/OgtieaVlYTnRBeOGvw2j0/83D0HRCI9vQpzu";

    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationRateLimiter authenticationRateLimiter;
    private final LoginRateLimiter rateLimiter;
    private final AccountDeletionRateLimiter deletionRateLimiter;
    private final Clock clock;

    AuthService(
            UserAccountRepository users,
            PasswordEncoder passwordEncoder,
            AuthenticationRateLimiter authenticationRateLimiter,
            LoginRateLimiter rateLimiter,
            AccountDeletionRateLimiter deletionRateLimiter,
            Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.authenticationRateLimiter = authenticationRateLimiter;
        this.rateLimiter = rateLimiter;
        this.deletionRateLimiter = deletionRateLimiter;
        this.clock = clock;
    }

    @Transactional
    public UserAccount register(String username, String password) {
        Credentials credentials = validate(username, password);
        authenticationRateLimiter.checkRegistration();
        if (users.existsByUsernameNormalized(credentials.normalizedUsername())) {
            throw usernameUnavailable();
        }
        UserAccount user =
                UserAccount.create(
                        credentials.username(),
                        credentials.normalizedUsername(),
                        passwordEncoder.encode(credentials.password()),
                        clock.instant());
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw usernameUnavailable();
        }
    }

    @Transactional(readOnly = true)
    public UserAccount login(String username, String password) {
        Credentials credentials = validate(username, password);
        authenticationRateLimiter.checkLogin();
        rateLimiter.check(credentials.normalizedUsername());
        Optional<UserAccount> candidate =
                users.findByUsernameNormalized(credentials.normalizedUsername());
        String hash = candidate.map(UserAccount::getPasswordHash).orElse(DUMMY_HASH);
        if (!passwordEncoder.matches(credentials.password(), hash) || candidate.isEmpty()) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS",
                    "Sign in failed",
                    "The username or password is incorrect.");
        }
        rateLimiter.clear(credentials.normalizedUsername());
        return candidate.get();
    }

    @Transactional(readOnly = true)
    public UserAccount requireUser(RillPrincipal principal) {
        return users.findById(principal.id())
                .orElseThrow(
                        () ->
                                new ApiException(
                                        HttpStatus.UNAUTHORIZED,
                                        "AUTHENTICATION_REQUIRED",
                                        "Authentication required",
                                        "Sign in to continue."));
    }

    @Transactional
    public UserAccount requireUserForUpdate(RillPrincipal principal) {
        return users.findByIdForUpdate(principal.id())
                .orElseThrow(
                        () ->
                                new ApiException(
                                        HttpStatus.UNAUTHORIZED,
                                        "AUTHENTICATION_REQUIRED",
                                        "Authentication required",
                                        "Sign in to continue."));
    }

    public void deleteAccount(RillPrincipal principal, String password) {
        deletionRateLimiter.check(principal.id());
        UserAccount user = requireUser(principal);
        if (!validPasswordShape(password)
                || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "PASSWORD_CONFIRMATION_FAILED",
                    "Password confirmation failed",
                    "The supplied password is incorrect.");
        }
        users.deleteById(user.getId());
        deletionRateLimiter.clear(user.getId());
    }

    private static Credentials validate(String username, String password) {
        if (username == null || !USERNAME.matcher(username).matches()) {
            throw validation("username", "must be 3 to 24 ASCII letters, numbers, or underscores");
        }
        if (!validPasswordShape(password)) {
            throw validation(
                    "password", "must be at least 12 characters and at most 72 UTF-8 bytes");
        }
        return new Credentials(username, username.toLowerCase(Locale.ROOT), password);
    }

    private static boolean validPasswordShape(String password) {
        return password != null
                && password.codePointCount(0, password.length()) >= 12
                && password.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    private static ApiException validation(String field, String detail) {
        return new ApiException(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                "Request validation failed",
                field + " " + detail + ".");
    }

    private static ApiException usernameUnavailable() {
        return new ApiException(
                HttpStatus.CONFLICT,
                "USERNAME_UNAVAILABLE",
                "Username unavailable",
                "Choose another username.");
    }

    private record Credentials(String username, String normalizedUsername, String password) {}
}
