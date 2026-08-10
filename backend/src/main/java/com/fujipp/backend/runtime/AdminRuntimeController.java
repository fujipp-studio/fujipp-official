package com.fujipp.backend.runtime;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/runtime")
@PreAuthorize("hasRole('ADMIN')")
public class AdminRuntimeController {
    private final AdminRuntimeService service;
    public AdminRuntimeController(AdminRuntimeService service){this.service=service;}
    @GetMapping("/plans") public List<AdminRuntimeResponses.Plan> plans(){return service.plans();}
    @PutMapping("/plans/{id}") public AdminRuntimeResponses.Plan updatePlan(@PathVariable UUID id,@Valid @RequestBody AdminRuntimeRequests.UpdatePlanRequest request){return service.updatePlan(id,request);}
    @GetMapping("/subscriptions") public List<AdminRuntimeResponses.Subscription> subscriptions(@RequestParam(required=false) UUID ownerUserId){return service.subscriptions(ownerUserId);}
    @PostMapping("/subscriptions") @ResponseStatus(HttpStatus.CREATED)
    public AdminRuntimeResponses.Subscription grant(@Valid @RequestBody AdminRuntimeRequests.GrantRequest request){return service.grant(request);}
    @PutMapping("/subscriptions/{id}") public AdminRuntimeResponses.Subscription update(@PathVariable UUID id,@Valid @RequestBody AdminRuntimeRequests.UpdateSubscriptionRequest request){return service.update(id,request);}
}
