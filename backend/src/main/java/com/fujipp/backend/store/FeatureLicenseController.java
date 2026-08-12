package com.fujipp.backend.store;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/feature-licenses")
public class FeatureLicenseController {

    private final StoreService storeService;

    public FeatureLicenseController(StoreService storeService) {
        this.storeService = storeService;
    }

    @GetMapping
    public List<LicenseResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return storeService.listLicenses(jwt.getSubject());
    }

    @PostMapping("/{licenseId}/installations")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> install(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID licenseId,
            @Valid @RequestBody InstallFeatureRequest request
    ) {
        return Map.of("installationId", storeService.install(
                jwt.getSubject(), licenseId, request
        ));
    }

    @PostMapping("/{licenseId}/upgrade")
    public LicenseResponse upgrade(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID licenseId) {
        return storeService.upgradeLicense(jwt.getSubject(),licenseId);
    }

    @DeleteMapping("/installations/{installationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID installationId
    ) {
        storeService.removeInstallation(jwt.getSubject(), installationId);
    }

    @GetMapping("/{licenseId}/configuration")
    public FeatureConfigurationResponse getConfiguration(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID licenseId
    ) {
        return storeService.getConfiguration(jwt.getSubject(), licenseId);
    }

    @PutMapping("/{licenseId}/configuration")
    public FeatureConfigurationResponse updateConfiguration(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID licenseId,
            @Valid @RequestBody UpdateFeatureConfigurationRequest request
    ) {
        return storeService.updateConfiguration(jwt.getSubject(), licenseId, request);
    }
}
