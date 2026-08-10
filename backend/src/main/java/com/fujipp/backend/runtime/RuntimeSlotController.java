package com.fujipp.backend.runtime;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/runtime")
public class RuntimeSlotController {
    private final RuntimeSlotService service;
    public RuntimeSlotController(RuntimeSlotService service){this.service=service;}
    @GetMapping("/plans") public List<RuntimePlanResponse> plans(){return service.plans();}
    @GetMapping("/availability") public RuntimeAvailabilityResponse availability(){return service.availability();}
    @GetMapping("/subscriptions") public List<RuntimeSubscriptionResponse> subscriptions(@AuthenticationPrincipal Jwt jwt){return service.subscriptions(jwt.getSubject());}
    @PostMapping("/subscriptions") @ResponseStatus(HttpStatus.CREATED)
    public RuntimeSubscriptionResponse purchase(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody PurchaseRuntimeRequest request){return service.purchase(jwt.getSubject(),request.planId());}
    @PutMapping("/subscriptions/{id}/bot") public RuntimeSubscriptionResponse assign(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody AssignRuntimeRequest request){return service.assign(jwt.getSubject(),id,request.botId());}
    @PutMapping("/subscriptions/{id}/auto-renew") public RuntimeSubscriptionResponse autoRenew(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@RequestBody UpdateAutoRenewRequest request){return service.autoRenew(jwt.getSubject(),id,request.autoRenew());}
    @PostMapping("/subscriptions/{id}/renew") public RuntimeSubscriptionResponse renew(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.renew(jwt.getSubject(),id);}
}
