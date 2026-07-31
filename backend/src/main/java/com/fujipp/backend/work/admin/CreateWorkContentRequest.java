package com.fujipp.backend.work.admin;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record CreateWorkContentRequest(
        @NotNull WorkContentType type,
        @PositiveOrZero int sortOrder
) {
}
