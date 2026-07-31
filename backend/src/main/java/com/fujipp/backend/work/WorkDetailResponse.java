package com.fujipp.backend.work;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record WorkDetailResponse(
        String slug,
        String name,
        String shortDescription,
        String overview,
        String feasibility,
        String targetUsers,
        String status,
        LocalDate startedOn,
        LocalDate completedOn,
        boolean featured,
        OffsetDateTime publishedAt,
        WorkRepository.Category category,
        List<WorkRepository.Position> positions,
        List<WorkRepository.Technology> technologies,
        List<WorkRepository.Media> gallery,
        WorkRepository.Media architecture,
        List<WorkRepository.Link> links,
        List<WorkRepository.ContentItem> features,
        List<WorkRepository.ContentItem> challenges,
        List<WorkRepository.ContentItem> learnings
) {
}
