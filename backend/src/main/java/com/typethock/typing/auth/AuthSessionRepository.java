package com.typethock.typing.auth;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthSessionRepository extends JpaRepository<AuthSession, UUID> {

    @EntityGraph(attributePaths = "user")
    Optional<AuthSession> findByTokenHash(String tokenHash);

    List<AuthSession> findAllByUserIdOrderByCreatedAtAsc(UUID userId);

    long countByUserId(UUID userId);

    long deleteByExpiresAtLessThanEqual(Instant now);
}
