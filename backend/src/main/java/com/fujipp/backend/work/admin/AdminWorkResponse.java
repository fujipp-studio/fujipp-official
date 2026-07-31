package com.fujipp.backend.work.admin;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminWorkResponse(
        UUID id,
        String slug,
        String categoryCode,
        String categoryName,
        String status,
        String publicationStatus,
        LocalDate startedOn,
        LocalDate completedOn,
        boolean featured,
        Integer featuredOrder,
        OffsetDateTime publishedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<String> positions,
        List<String> technologies,
        List<Translation> translations
) {
    public record Translation(
            String locale,
            String name,
            String shortDescription,
            String overview,
            String feasibility,
            String targetUsers
    ) {
    }
}
