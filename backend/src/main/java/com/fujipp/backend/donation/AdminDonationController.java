package com.fujipp.backend.donation;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/donations")
@PreAuthorize("hasRole('ADMIN')")
class AdminDonationController {
    private final DonationService service;

    AdminDonationController(DonationService service) {
        this.service = service;
    }

    @PatchMapping("/settings")
    DonationResponses.Campaign updateSettings(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody DonationRequests.UpdateSettings request
    ) {
        return service.updateSettings(jwt.getSubject(), request);
    }
}
