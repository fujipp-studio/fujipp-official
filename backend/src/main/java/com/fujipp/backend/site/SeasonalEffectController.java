package com.fujipp.backend.site;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/site/seasonal-effects")
class SeasonalEffectController {
    private final SeasonalEffectRepository repository;

    SeasonalEffectController(SeasonalEffectRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    ResponseEntity<SeasonalEffectSettings> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.noCache()).body(repository.get());
    }
}
