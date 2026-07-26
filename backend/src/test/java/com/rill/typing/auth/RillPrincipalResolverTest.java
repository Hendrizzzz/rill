package com.rill.typing.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rill.typing.common.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

class RillPrincipalResolverTest {

    @Test
    void findsOnlyTheExpectedPrincipalType() {
        RillPrincipal principal =
                new RillPrincipal(UUID.randomUUID(), "river", Instant.EPOCH);
        var authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        principal, null, List.of());

        assertThat(RillPrincipalResolver.find(authentication)).isSameAs(principal);
        assertThat(RillPrincipalResolver.find(null)).isNull();
        assertThat(
                        RillPrincipalResolver.find(
                                new AnonymousAuthenticationToken(
                                        "key", "anonymous", List.of(() -> "ROLE_ANONYMOUS"))))
                .isNull();
    }

    @Test
    void requireRejectsMissingOrUnexpectedPrincipals() {
        assertThatThrownBy(() -> RillPrincipalResolver.require(null))
                .isInstanceOf(ApiException.class)
                .extracting("code")
                .isEqualTo("AUTHENTICATION_REQUIRED");
    }
}
