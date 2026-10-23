package com.fujipp.backend.site;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/site/seasonal-effects")
@PreAuthorize("hasRole('ADMIN')")
class AdminSeasonalEffectController {
    private final SeasonalEffectRepository repository;

    AdminSeasonalEffectController(SeasonalEffectRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    ResponseEntity<SeasonalEffectSettings> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(repository.get());
    }

    @PutMapping
    ResponseEntity<SeasonalEffectSettings> update(@AuthenticationPrincipal Jwt jwt,
                                                @Valid @RequestBody UpdateRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(repository.update(request.effect(), UUID.fromString(jwt.getSubject())));
    }

    record UpdateRequest(@NotNull SeasonalEffect effect) {}
}
