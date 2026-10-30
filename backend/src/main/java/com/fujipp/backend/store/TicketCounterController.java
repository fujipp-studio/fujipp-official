package com.fujipp.backend.store;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.access.prepost.PreAuthorize;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bots/{botId}/ticket-counter")
class TicketCounterController {
    private final TicketHistoryService access;
    private final TicketCounterService counters;
    TicketCounterController(TicketHistoryService access,TicketCounterService counters) { this.access=access;this.counters=counters; }
    record Reset(@NotNull @Min(0) @Max(99999) Integer nextNumber) {}
    @GetMapping ResponseEntity<TicketCounterService.Counter> read(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId) {
        access.authorizeBot(jwt.getSubject(),botId,false);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(counters.read(botId));
    }
    @PutMapping ResponseEntity<TicketCounterService.Counter> reset(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId,@Valid @RequestBody Reset request) {
        access.authorizeBot(jwt.getSubject(),botId,false);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(counters.reset(botId,request.nextNumber()));
    }
}

@RestController
@RequestMapping("/api/v1/admin/bots/{botId}/ticket-counter")
@PreAuthorize("hasRole('ADMIN')")
class AdminTicketCounterController {
    private final TicketHistoryService access;
    private final TicketCounterService counters;
    AdminTicketCounterController(TicketHistoryService access,TicketCounterService counters) { this.access=access;this.counters=counters; }
    @GetMapping ResponseEntity<TicketCounterService.Counter> read(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId) {
        access.authorizeBot(jwt.getSubject(),botId,true);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(counters.read(botId));
    }
    @PutMapping ResponseEntity<TicketCounterService.Counter> reset(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId,@Valid @RequestBody TicketCounterController.Reset request) {
        access.authorizeBot(jwt.getSubject(),botId,true);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(counters.reset(botId,request.nextNumber()));
    }
}
