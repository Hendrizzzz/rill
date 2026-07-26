package com.rill.typing.auth;

import com.rill.typing.common.ApiException;
import com.rill.typing.config.RillProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionService {

    private final AuthSessionRepository sessions;
    private final UserAccountRepository users;
    private final RillProperties properties;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    SessionService(
            AuthSessionRepository sessions,
            UserAccountRepository users,
            RillProperties properties,
            Clock clock) {
        this.sessions = sessions;
        this.users = users;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public IssuedSession create(UserAccount user) {
        UserAccount lockedUser =
                users.findByIdForUpdate(user.getId())
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.UNAUTHORIZED,
                                                "AUTHENTICATION_REQUIRED",
                                                "Authentication required",
                                                "Sign in to continue."));
        Instant now = clock.instant();
        byte[] tokenBytes = new byte[32];
        random.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        AuthSession session =
                AuthSession.create(
                        lockedUser,
                        hashToken(token),
                        now,
                        now.plus(properties.cookie().maxAge()));
        sessions.save(session);

        List<AuthSession> all = sessions.findAllByUserIdOrderByCreatedAtAsc(user.getId());
        int overflow = all.size() - properties.maxSessionsPerAccount();
        if (overflow > 0) {
            sessions.deleteAllInBatch(all.subList(0, overflow));
        }
        return new IssuedSession(token, session.getExpiresAt());
    }

    @Transactional
    public Optional<RillPrincipal> authenticate(String token) {
        if (token == null || token.length() < 40 || token.length() > 64) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        Optional<AuthSession> found = sessions.findByTokenHash(hashToken(token));
        if (found.isEmpty()) {
            return Optional.empty();
        }
        AuthSession session = found.get();
        if (!session.getExpiresAt().isAfter(now)) {
            sessions.delete(session);
            return Optional.empty();
        }
        if (!session.getLastSeenAt().plus(properties.cookie().touchInterval()).isAfter(now)) {
            session.touch(now);
        }
        return Optional.of(RillPrincipal.from(session.getUser()));
    }

    @Transactional
    public void revoke(String token) {
        if (token != null && token.length() >= 40 && token.length() <= 64) {
            sessions.findByTokenHash(hashToken(token)).ifPresent(sessions::delete);
        }
    }

    @Scheduled(fixedDelayString = "PT1H")
    @Transactional
    public void deleteExpired() {
        sessions.deleteByExpiresAtLessThanEqual(clock.instant());
    }

    private static String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of()
                    .formatHex(digest.digest(token.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public record IssuedSession(String token, Instant expiresAt) {}
}
