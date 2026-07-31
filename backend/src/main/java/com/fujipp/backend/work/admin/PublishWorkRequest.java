package com.fujipp.backend.work.admin;

import jakarta.validation.constraints.PositiveOrZero;

public record PublishWorkRequest(
        boolean featured,
        @PositiveOrZero Integer featuredOrder
) {
}
