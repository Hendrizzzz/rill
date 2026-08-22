package com.typethock.typing.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.typethock.typing.common.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

class TypeThockPrincipalResolverTest {

    @Test
    void findsOnlyTheExpectedPrincipalType() {
        TypeThockPrincipal principal =
                new TypeThockPrincipal(UUID.randomUUID(), "river", Instant.EPOCH);
        var authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        principal, null, List.of());

        assertThat(TypeThockPrincipalResolver.find(authentication)).isSameAs(principal);
        assertThat(TypeThockPrincipalResolver.find(null)).isNull();
        assertThat(
                        TypeThockPrincipalResolver.find(
                                new AnonymousAuthenticationToken(
                                        "key", "anonymous", List.of(() -> "ROLE_ANONYMOUS"))))
                .isNull();
    }

    @Test
    void requireRejectsMissingOrUnexpectedPrincipals() {
        assertThatThrownBy(() -> TypeThockPrincipalResolver.require(null))
                .isInstanceOf(ApiException.class)
                .extracting("code")
                .isEqualTo("AUTHENTICATION_REQUIRED");
    }
}
