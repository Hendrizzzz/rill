package com.rill.typing.result;

import com.rill.typing.auth.RillPrincipal;
import com.rill.typing.auth.RillPrincipalResolver;
import com.rill.typing.result.ResultDtos.CreateResultRequest;
import com.rill.typing.result.ResultDtos.ResultPage;
import com.rill.typing.result.ResultDtos.ResultSummary;
import com.rill.typing.result.ResultDtos.TypingResultResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/results")
public class TypingResultController {

    private final TypingResultService service;

    TypingResultController(TypingResultService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<TypingResultResponse> create(
            Authentication authentication, @Valid @RequestBody CreateResultRequest request) {
        RillPrincipal principal = RillPrincipalResolver.require(authentication);
        TypingResultService.CreateOutcome outcome = service.create(principal, request);
        return ResponseEntity.status(outcome.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(outcome.response());
    }

    @GetMapping
    ResultPage page(
            Authentication authentication,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String cursor) {
        return service.page(RillPrincipalResolver.require(authentication), limit, cursor);
    }

    @GetMapping("/summary")
    ResultSummary summary(Authentication authentication) {
        return service.summary(RillPrincipalResolver.require(authentication));
    }
}
