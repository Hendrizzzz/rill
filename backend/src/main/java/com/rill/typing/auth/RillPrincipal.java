package com.rill.typing.auth;

import java.time.Instant;
import java.util.UUID;

public record RillPrincipal(UUID id, String username, Instant createdAt) {

    static RillPrincipal from(UserAccount user) {
        return new RillPrincipal(user.getId(), user.getUsername(), user.getCreatedAt());
    }
}
