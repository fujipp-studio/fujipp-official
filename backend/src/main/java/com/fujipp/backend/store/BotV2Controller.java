package com.fujipp.backend.store;

import com.fujipp.backend.pagination.CursorPage;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v2/bots")
public class BotV2Controller {
    private final StoreService service;
    public BotV2Controller(StoreService service) { this.service = service; }

    @GetMapping
    public CursorPage<BotResponse> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit,
            @RequestParam(required = false) String cursor) {
        return service.listBotsV2(jwt.getSubject(), limit, cursor);
    }
}
