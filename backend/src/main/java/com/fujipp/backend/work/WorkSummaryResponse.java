package com.fujipp.backend.work;

import java.time.LocalDate;
import java.util.List;

public record WorkSummaryResponse(
        String slug,
        String name,
        String shortDescription,
        String status,
        LocalDate startedOn,
        LocalDate completedOn,
        boolean featured,
        WorkRepository.Category category,
        List<WorkRepository.Position> positions,
        List<WorkRepository.Technology> technologies,
        WorkRepository.Media cover
) {
}
