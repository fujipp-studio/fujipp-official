package com.fujipp.backend.roleshop;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/internal/v1/role-shop")
class RoleShopController {
    private final RoleShopService service;
    RoleShopController(RoleShopService service) { this.service=service; }
    @PostMapping("/purchases") RoleShopPurchase begin(@Valid @RequestBody RoleShopRequests.Begin body) { return service.begin(body); }
    @PostMapping("/purchases/{id}/claim") RoleShopPurchase claim(@RequestParam UUID botId,@PathVariable UUID id) { return service.claim(botId,id); }
    @PostMapping("/purchases/{id}/complete") RoleShopPurchase complete(@RequestParam UUID botId,@PathVariable UUID id,@Valid @RequestBody RoleShopRequests.Complete body) { return service.complete(botId,id,body.claimToken()); }
    @PostMapping("/purchases/{id}/refund") RoleShopPurchase refund(@RequestParam UUID botId,@PathVariable UUID id,@Valid @RequestBody RoleShopRequests.Refund body) { return service.refund(botId,id,body); }
    @GetMapping("/purchases/recoverable") List<RoleShopPurchase> recoverable(@RequestParam UUID botId) { return service.recoverable(botId); }
}
