package com.fujipp.backend.runtime;

import com.fujipp.backend.pagination.CursorPage;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v2/admin/runtime")
@PreAuthorize("hasRole('ADMIN')")
public class AdminRuntimeV2Controller {
    private final AdminRuntimeService service;
    public AdminRuntimeV2Controller(AdminRuntimeService service){this.service=service;}
    @GetMapping("/subscriptions") public CursorPage<AdminRuntimeResponses.Subscription> subscriptions(
            @RequestParam(required=false) UUID ownerUserId,
            @RequestParam(defaultValue="50") @Min(1) @Max(100) int limit,
            @RequestParam(required=false) String cursor){return service.subscriptionsV2(ownerUserId,limit,cursor);}
}
