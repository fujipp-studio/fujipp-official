package com.fujipp.backend.store;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
public class PriceReaderTestController {
    private final PriceReaderTestService service;
    PriceReaderTestController(PriceReaderTestService service) { this.service=service; }
    record Request(@Size(max=512) String apiKey, @NotBlank @Size(max=107) String model,
                   @Size(max=13981016) String imageBase64, @Size(max=100) String mimeType) {
        @Override public String toString() { return "PriceReaderTestRequest[redacted]"; }
    }
    @PostMapping("/api/v1/feature-licenses/{licenseId}/price-reader/test")
    PriceReaderGeminiClient.Result test(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID licenseId,
                                       @Valid @RequestBody Request request) {
        return service.test(jwt.getSubject(),licenseId,request);
    }
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/api/v1/admin/bots/{botId}/licenses/{licenseId}/price-reader/test")
    PriceReaderGeminiClient.Result testAdmin(@PathVariable UUID botId, @PathVariable UUID licenseId,
                                            @Valid @RequestBody Request request) {
        return service.testAdmin(botId,licenseId,request);
    }
}
