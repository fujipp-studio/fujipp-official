package com.fujipp.backend.work;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/works")
public class WorkController {

    private final WorkService workService;

    public WorkController(WorkService workService) {
        this.workService = workService;
    }

    @GetMapping
    public List<WorkSummaryResponse> listWorks(
            @RequestParam(defaultValue = "th") WorkLocale locale,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean featured
    ) {
        return workService.listPublished(locale, category, featured);
    }

    @GetMapping("/{slug}")
    public WorkDetailResponse getWork(
            @PathVariable String slug,
            @RequestParam(defaultValue = "th") WorkLocale locale
    ) {
        return workService.getPublished(slug, locale);
    }
}
