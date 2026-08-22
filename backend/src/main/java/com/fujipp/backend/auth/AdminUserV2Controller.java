package com.fujipp.backend.auth;

import com.fujipp.backend.pagination.CursorPage;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v2/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserV2Controller {
    private final AdminUserService service;
    public AdminUserV2Controller(AdminUserService service){this.service=service;}
    @GetMapping public CursorPage<AdminUserResponses.UserSummary> list(
            @RequestParam(required=false) String query,
            @RequestParam(defaultValue="50") @Min(1) @Max(100) int limit,
            @RequestParam(required=false) String cursor){return service.listUsersV2(query,limit,cursor);}
    @GetMapping("/{customerId}/wallet/history")
    public CursorPage<AdminUserResponses.WalletHistoryEntry> history(@PathVariable UUID customerId,
            @RequestParam(defaultValue="50") @Min(1) @Max(100) int limit,
            @RequestParam(required=false) String cursor){return service.getWalletHistoryV2(customerId,limit,cursor);}
}
