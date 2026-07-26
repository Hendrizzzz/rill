package com.rill.typing.auth;

import com.rill.typing.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

public final class RillPrincipalResolver {
    private RillPrincipalResolver() {}

    public static RillPrincipal find(Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof RillPrincipal value
                ? value
                : null;
    }

    public static RillPrincipal require(Authentication authentication) {
        RillPrincipal principal = find(authentication);
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
