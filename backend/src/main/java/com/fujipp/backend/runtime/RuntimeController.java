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

@RestController
@RequestMapping("/internal/v1/runtime")
public class RuntimeController {

    private final RuntimeService runtimeService;

    public RuntimeController(RuntimeService runtimeService) {
        this.runtimeService = runtimeService;
    }

    @GetMapping("/bootstrap")
    public ResponseEntity<RuntimeBootstrapResponse> bootstrap() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(runtimeService.bootstrap());
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
