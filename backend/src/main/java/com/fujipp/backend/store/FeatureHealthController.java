package com.fujipp.backend.store;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
import java.util.Map;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/bots/{botId}")
public class FeatureHealthController {
    private final FeatureHealthService service;
    public FeatureHealthController(FeatureHealthService service) { this.service=service; }
    @GetMapping("/feature-health")
    public List<FeatureHealthResponse> list(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId) { return service.list(jwt.getSubject(),botId); }
    @PostMapping("/installations/{installationId}/retry")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void retry(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId,@PathVariable UUID installationId) { service.retry(jwt.getSubject(),botId,installationId); }
    @PutMapping("/installations/{installationId}/enabled")
    public Map<String,String> setEnabled(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId,
            @PathVariable UUID installationId,@Valid @RequestBody SetFeatureEnabledRequest request) {
        return Map.of("status",service.setEnabled(jwt.getSubject(),botId,installationId,request.enabled()));
    }
}
