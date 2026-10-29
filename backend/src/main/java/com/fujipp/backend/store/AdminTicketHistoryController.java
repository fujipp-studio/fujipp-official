package com.fujipp.backend.store;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/bots/{botId}/tickets")
@PreAuthorize("hasRole('ADMIN')")
class AdminTicketHistoryController {
    private final TicketHistoryService service;
    AdminTicketHistoryController(TicketHistoryService service) { this.service=service; }
    @GetMapping
    ResponseEntity<List<TicketHistoryService.Ticket>> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID botId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(jwt.getSubject(), botId, true));
    }
    @GetMapping("/{channelId}/messages")
    ResponseEntity<TicketHistoryService.Messages> messages(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID botId,
            @PathVariable String channelId, @RequestParam(required=false) String before, @RequestParam(defaultValue="50") int limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.messages(jwt.getSubject(), botId, true, channelId, before, limit));
    }
}
