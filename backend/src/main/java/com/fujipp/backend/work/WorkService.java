package com.fujipp.backend.work;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class WorkService {

    private final WorkRepository workRepository;

    public WorkService(WorkRepository workRepository) {
        this.workRepository = workRepository;
    }

    @Transactional(readOnly = true)
    public List<WorkSummaryResponse> listPublished(
            WorkLocale locale,
            String category,
            Boolean featured
    ) {
        String normalizedCategory = category == null || category.isBlank()
                ? null
                : category.trim().toLowerCase(java.util.Locale.ROOT);
        return workRepository.findPublished(locale.name(), normalizedCategory, featured);
    }

    @Transactional(readOnly = true)
    public WorkDetailResponse getPublished(String slug, WorkLocale locale) {
        String normalizedSlug = slug.trim().toLowerCase(java.util.Locale.ROOT);
        return workRepository.findPublishedBySlug(normalizedSlug, locale.name())
                .orElseThrow(WorkNotFoundException::new);
    }
}
