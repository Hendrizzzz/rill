package com.typethock.typing.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_user")
public class UserAccount {

    @Id
    private UUID id;

    @Column(nullable = false, length = 24)
    private String username;

    @Column(name = "username_normalized", nullable = false, length = 24, unique = true)
    private String usernameNormalized;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected UserAccount() {}

    private UserAccount(
            UUID id,
            String username,
            String usernameNormalized,
            String passwordHash,
            Instant createdAt) {
        this.id = id;
        this.username = username;
        this.usernameNormalized = usernameNormalized;
        this.passwordHash = passwordHash;
        this.createdAt = createdAt;
    }

    public static UserAccount create(
            String username, String usernameNormalized, String passwordHash, Instant createdAt) {
        return new UserAccount(
                UUID.randomUUID(), username, usernameNormalized, passwordHash, createdAt);
    }

    public UUID getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getUsernameNormalized() {
        return usernameNormalized;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
