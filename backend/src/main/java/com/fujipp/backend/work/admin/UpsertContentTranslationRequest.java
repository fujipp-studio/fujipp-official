package com.fujipp.backend.work.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpsertContentTranslationRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 4000) String description
) {
}
