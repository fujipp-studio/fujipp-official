package com.fujipp.backend.work.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateWorkRequest(
        @NotBlank
        @Size(max = 100)
        @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$")
        String slug,

        @NotBlank
        @Size(max = 50)
        @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$")
        String categoryCode,

        @NotNull
        WorkStatus status,

        LocalDate startedOn,
        LocalDate completedOn
) {
}
