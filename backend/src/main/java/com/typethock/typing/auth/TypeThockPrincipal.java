package com.typethock.typing.auth;

import java.time.Instant;
import java.util.UUID;

public record TypeThockPrincipal(UUID id, String username, Instant createdAt) {

    static TypeThockPrincipal from(UserAccount user) {
        return new TypeThockPrincipal(user.getId(), user.getUsername(), user.getCreatedAt());
    }
}
