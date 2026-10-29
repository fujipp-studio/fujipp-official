package com.fujipp.backend.store;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/v1/bots/{botId}/tickets")
class TicketHistoryController {
    private final TicketHistoryService service;
    TicketHistoryController(TicketHistoryService service) { this.service=service; }
    @GetMapping
    ResponseEntity<List<TicketHistoryService.Ticket>> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID botId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(jwt.getSubject(), botId, false));
    }
    @GetMapping("/{channelId}/messages")
    ResponseEntity<TicketHistoryService.Messages> messages(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID botId,
            @PathVariable String channelId, @RequestParam(required=false) String before, @RequestParam(defaultValue="50") int limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.messages(jwt.getSubject(), botId, false, channelId, before, limit));
    }
}
