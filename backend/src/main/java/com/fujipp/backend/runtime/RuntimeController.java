package com.fujipp.backend.runtime;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;

@RestController
@RequestMapping("/internal/v1/runtime")
public class RuntimeController {

    private final RuntimeService runtimeService;

    public RuntimeController(RuntimeService runtimeService) {
        this.runtimeService = runtimeService;
    }

    @GetMapping("/bootstrap")
    public ResponseEntity<RuntimeBootstrapResponse> bootstrap(
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch
    ) {
        RuntimeService.CachedBootstrap bootstrap = runtimeService.bootstrap();
        if (matches(ifNoneMatch, bootstrap.etag())) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .eTag(bootstrap.etag())
                    .cacheControl(CacheControl.noCache())
                    .build();
        }
        return ResponseEntity.ok()
                .eTag(bootstrap.etag())
                .cacheControl(CacheControl.noCache())
                .body(bootstrap.response());
    }

    private boolean matches(String ifNoneMatch, String etag) {
        return ifNoneMatch != null && java.util.Arrays.stream(ifNoneMatch.split(","))
                .map(String::trim)
                .map(value -> value.startsWith("W/") ? value.substring(2) : value)
                .map(value -> value.replace("\"", ""))
                .anyMatch(value -> value.equals(etag) || value.equals("*"));
    }

    @PostMapping("/status")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateStatus(@Valid @RequestBody RuntimeStatusRequest request) {
        runtimeService.updateStatus(request);
    }

    @PutMapping("/state")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateState(@Valid @RequestBody RuntimeStateRequest request) {
        runtimeService.updateState(request);
    }
}
