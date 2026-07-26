package com.rill.typing.auth;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

final class AuthDtos {
    private AuthDtos() {}

    record CredentialsRequest(@NotNull String username, @NotNull String password) {}

    record PasswordRequest(@NotNull String password) {}

    record UserResponse(UUID id, String username, Instant createdAt) {
        static UserResponse from(RillPrincipal principal) {
            return new UserResponse(principal.id(), principal.username(), principal.createdAt());
        }

        static UserResponse from(UserAccount user) {
            return new UserResponse(user.getId(), user.getUsername(), user.getCreatedAt());
        }
    }

    record SessionResponse(boolean authenticated, UserResponse user, String csrfToken) {
        static SessionResponse guest(String csrfToken) {
            return new SessionResponse(false, null, csrfToken);
        }
    }
}
