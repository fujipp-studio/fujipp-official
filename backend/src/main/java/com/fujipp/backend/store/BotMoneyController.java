package com.fujipp.backend.store;

import com.fujipp.backend.pagination.CursorPage;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bots/{botId}/money")
class BotMoneyController {
    private final BotMoneyService service;
    BotMoneyController(BotMoneyService service) { this.service=service; }
    @GetMapping("/overview")
    ResponseEntity<BotMoneyService.Overview> overview(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId) {
        return response(service.overview(jwt.getSubject(),botId,false));
    }
    @GetMapping("/customers")
    ResponseEntity<CursorPage<BotMoneyService.Customer>> customers(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId,
            @RequestParam(required=false) String member,@RequestParam(required=false) String cursor,@RequestParam(defaultValue="25") int limit) {
        return response(service.customers(jwt.getSubject(),botId,false,member,cursor,limit));
    }
    @GetMapping("/topups")
    ResponseEntity<CursorPage<BotMoneyService.Topup>> topups(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID botId,
            @RequestParam(required=false) String member,@RequestParam(required=false) String provider,
            @RequestParam(defaultValue="false") boolean review,@RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="25") int limit) {
        return response(service.topups(jwt.getSubject(),botId,false,member,provider,review,cursor,limit));
    }
    private <T> ResponseEntity<T> response(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
}
