package com.fujipp.backend.auth;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {
    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public List<AdminUserResponses.UserSummary> listUsers(@RequestParam(required = false) String query) {
        return adminUserService.listUsers(query);
    }

    @PostMapping("/{customerId}/wallet/adjust")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void adjustWallet(
            @PathVariable UUID customerId,
            @Valid @RequestBody AdminUserRequests.AdjustWalletRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminUserService.adjustWallet(customerId, request, jwt != null ? jwt.getSubject() : null);
    }

    @GetMapping("/{customerId}/wallet/history")
    public AdminUserResponses.WalletHistoryResponse getWalletHistory(@PathVariable UUID customerId) {
        return adminUserService.getWalletHistory(customerId);
    }

    @PutMapping("/{userId}")
    public AdminUserResponses.UserSummary updateAccount(@PathVariable UUID userId,
            @Valid @RequestBody AdminUserRequests.UpdateAccountRequest request) {
        return adminUserService.updateAccount(userId, request);
    }

    @GetMapping("/{userId}/features")
    public List<AdminUserResponses.FeatureLicense> features(@PathVariable UUID userId) {
        return adminUserService.features(userId);
    }

    @PostMapping("/{userId}/features")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminUserResponses.FeatureLicense grantFeature(@PathVariable UUID userId,
            @Valid @RequestBody AdminUserRequests.GrantFeatureRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return adminUserService.grantFeature(userId, request, jwt != null ? jwt.getSubject() : null);
    }

    @PutMapping("/{userId}/features/{licenseId}")
    public AdminUserResponses.FeatureLicense updateFeature(@PathVariable UUID userId,@PathVariable UUID licenseId,
            @Valid @RequestBody AdminUserRequests.UpdateFeatureLicenseRequest request) {
        return adminUserService.updateFeature(userId, licenseId, request);
    }
}
