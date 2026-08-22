package com.typethock.typing.auth;

import com.typethock.typing.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

public final class TypeThockPrincipalResolver {
    private TypeThockPrincipalResolver() {}

    public static TypeThockPrincipal find(Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof TypeThockPrincipal value
                ? value
                : null;
    }

    public static TypeThockPrincipal require(Authentication authentication) {
        TypeThockPrincipal principal = find(authentication);
        if (principal == null) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "AUTHENTICATION_REQUIRED",
                    "Authentication required",
                    "Sign in to continue.");
        }
        return principal;
    }
}
