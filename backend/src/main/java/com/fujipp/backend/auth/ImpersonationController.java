package com.fujipp.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping(ImpersonationService.PATH)
@PreAuthorize("hasRole('ADMIN')")
public class ImpersonationController {
    private final ImpersonationService service;
    public ImpersonationController(ImpersonationService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<ImpersonationService.Started> start(@AuthenticationPrincipal Jwt actor,
            @Valid @RequestBody StartRequest body, HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.start(actor, body.userId(), request));
    }

    @DeleteMapping
    public ResponseEntity<Void> stop(@AuthenticationPrincipal Jwt actor,
            @RequestHeader(ImpersonationService.HEADER) String token, HttpServletRequest request) {
        service.stop(actor, token, request);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    public record StartRequest(@NotNull UUID userId) {}
}
