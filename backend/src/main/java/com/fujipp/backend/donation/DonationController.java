package com.fujipp.backend.donation;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/donations")
class DonationController {
    private final DonationService service;

    DonationController(DonationService service) {
        this.service = service;
    }

    @GetMapping("/campaign")
    DonationResponses.Campaign campaign() {
        return service.campaign();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    DonationResponses.Donation create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody DonationRequests.Create request
    ) {
        return service.create(jwt.getSubject(), request);
    }

    @GetMapping("/{donationId}")
    DonationResponses.Donation get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID donationId
    ) {
        return service.get(jwt.getSubject(), donationId);
    }
}
