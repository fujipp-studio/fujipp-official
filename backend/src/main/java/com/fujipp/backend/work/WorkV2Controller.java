package com.fujipp.backend.work;

import com.fujipp.backend.pagination.CursorPage;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/api/v2/works")
public class WorkV2Controller {
    private final WorkService service;
    public WorkV2Controller(WorkService service){this.service=service;}
    @GetMapping public CursorPage<WorkSummaryResponse> list(
            @RequestParam(defaultValue="th") WorkLocale locale,@RequestParam(required=false) String category,
            @RequestParam(required=false) Boolean featured,
            @RequestParam(defaultValue="50") @Min(1) @Max(100) int limit,
            @RequestParam(required=false) String cursor){return service.listPublishedV2(locale,category,featured,limit,cursor);}
}
