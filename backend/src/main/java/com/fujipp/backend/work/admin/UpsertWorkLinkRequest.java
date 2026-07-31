package com.fujipp.backend.work.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpsertWorkLinkRequest(
        @NotNull WorkLinkType type,
        @NotBlank @Size(max = 100) String label,
        @NotBlank @Pattern(regexp = "^https://.+") String url,
        @PositiveOrZero int sortOrder
) {
}
