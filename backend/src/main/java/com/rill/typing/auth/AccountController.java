package com.rill.typing.auth;

import com.rill.typing.auth.AuthDtos.PasswordRequest;
import com.rill.typing.auth.AuthDtos.UserResponse;
import com.rill.typing.result.ResultDtos.TypingResultResponse;
import com.rill.typing.result.TypingResultService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/account")
public class AccountController {

    private final AuthService authService;
    private final AuthController authController;
    private final TypingResultService resultService;
    private final AccountExportRateLimiter exportRateLimiter;
    private final Clock clock;

    AccountController(
            AuthService authService,
            AuthController authController,
            TypingResultService resultService,
            AccountExportRateLimiter exportRateLimiter,
            Clock clock) {
        this.authService = authService;
        this.authController = authController;
        this.resultService = resultService;
        this.exportRateLimiter = exportRateLimiter;
        this.clock = clock;
    }

    @GetMapping("/export")
    ResponseEntity<AccountExport> export(Authentication authentication) {
        RillPrincipal principal = RillPrincipalResolver.require(authentication);
        exportRateLimiter.check(principal.id());
        Instant now = clock.instant();
        List<TypingResultResponse> results = resultService.export(principal);
        String filename =
                "rill-export-"
                        + LocalDate.ofInstant(now, ZoneOffset.UTC)
                        + ".json";
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(
                        new AccountExport(
                                1, now, UserResponse.from(principal), results));
    }

    @DeleteMapping
    ResponseEntity<Void> delete(
            Authentication authentication,
            @Valid @RequestBody PasswordRequest request,
            HttpServletResponse response) {
        RillPrincipal principal = RillPrincipalResolver.require(authentication);
        authService.deleteAccount(principal, request.password());
        authController.clearCookies(response);
        return ResponseEntity.noContent().build();
    }

    record AccountExport(
            int schemaVersion,
            Instant exportedAt,
            UserResponse account,
            List<TypingResultResponse> results) {}
}
