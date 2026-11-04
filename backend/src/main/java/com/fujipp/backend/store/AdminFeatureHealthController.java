package com.fujipp.backend.store;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
import java.util.Map;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/admin/bots/{botId}")
@PreAuthorize("hasRole('ADMIN')")
public class AdminFeatureHealthController {
    private final FeatureHealthService service;
    public AdminFeatureHealthController(FeatureHealthService service) { this.service=service; }
    @GetMapping("/feature-health")
    public List<FeatureHealthResponse> list(@PathVariable UUID botId) { return service.listAsAdmin(botId); }
    @PostMapping("/installations/{installationId}/retry")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void retry(@PathVariable UUID botId,@PathVariable UUID installationId) { service.retryAsAdmin(botId,installationId); }
    @PutMapping("/installations/{installationId}/enabled")
    public Map<String,String> setEnabled(@PathVariable UUID botId,@PathVariable UUID installationId,
            @Valid @RequestBody SetFeatureEnabledRequest request) {
        return Map.of("status",service.setEnabledAsAdmin(botId,installationId,request.enabled()));
    }
}
