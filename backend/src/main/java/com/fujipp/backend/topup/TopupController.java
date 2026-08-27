package com.fujipp.backend.topup;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wallet/topups")
class TopupController {
    private final TopupService service;
    TopupController(TopupService service) { this.service=service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    TopupResponses.Invoice create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody TopupRequests.Create request) {
        return service.create(jwt.getSubject(),request);
    }

    @GetMapping("/{invoiceId}")
    TopupResponses.Invoice get(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID invoiceId) {
        return service.get(jwt.getSubject(),invoiceId);
    }

    @PostMapping(path="/{invoiceId}/slip",consumes="multipart/form-data")
    TopupResponses.Invoice verify(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID invoiceId,
            @RequestParam("file") MultipartFile file) {
        return service.verify(jwt.getSubject(),invoiceId,file);
    }
}
