package com.fujipp.backend.work;

import java.util.List;

public record WorkOverviewResponse(long total, List<CategoryCount> categories, List<WorkSummaryResponse> featured) {
    public record CategoryCount(String code, String name, long total) {}
}
