package com.fujipp.backend.store;

import com.fujipp.backend.pagination.CursorPage;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/api/v2/admin/bots")
@PreAuthorize("hasRole('ADMIN')")
public class AdminBotV2Controller {
    private final AdminBotService service;
    public AdminBotV2Controller(AdminBotService service){this.service=service;}
    @GetMapping public CursorPage<AdminStoreResponses.Bot> list(
            @RequestParam(required=false) String query,
            @RequestParam(defaultValue="50") @Min(1) @Max(100) int limit,
            @RequestParam(required=false) String cursor){return service.listV2(query,limit,cursor);}
}
